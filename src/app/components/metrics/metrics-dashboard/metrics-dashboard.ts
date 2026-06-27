import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { MetricsService } from '@app/services/metrics.service';
import {
  METRICS_GRANULARITY_STEP_SECONDS,
  METRICS_GRANULARITY_WINDOW_PERIODS,
} from '@app/shared/chart-config';
import { formatMetricUnitValue, metricUnit, MetricUnit } from '@app/shared/metric-units';
import { MetricChartMode, pickDynamicMetricChartMode } from '@app/shared/metrics-chart-mode';
import { metricDescription } from '@app/shared/metrics-descriptions';
import {
  metricLabel,
  metricsServiceDefinition,
  metricsServiceDefinitions,
  metricsServiceLabel,
} from '@app/shared/metrics-labels';
import {
  buildMetricPointsIndex,
  buildMetricsWindowBuckets,
  buildSparseBarSeriesFromPoints,
  buildSparseLineSeriesFromPoints,
  metricPointsIndexKey,
  MetricSeriesPoint,
  previousCompletedBucket,
} from '@app/shared/metrics-series';
import { severityColor } from '@app/shared/metrics-severity';
import { MetricGranularity } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import {
  DEFAULT_CARD_WIDTH_PX,
  DEFAULT_CHART_HEIGHT_PX,
  MetricChartCard,
} from '../metric-chart-card/metric-chart-card';

const NOW_TICK_INTERVAL_MS = 30_000;
const EXPANDED_SERVICES_STORAGE_KEY = 'metrics_expanded_services';
const CARD_WIDTH_STORAGE_KEY = 'metrics_card_width_px';
const CARD_HEIGHT_STORAGE_KEY = 'metrics_card_height_px';
const GRANULARITY_STORAGE_KEY = 'metrics_granularity';
const SETTINGS_PANEL_KEY = '__settings__';
const GRANULARITY_OPTIONS: MetricGranularity[] = ['minute', 'hour', 'day'];

interface MetricChartCardData {
  key: string;
  label: string;
  technicalName: string;
  value: number;
  displayValue: string;
  unit: MetricUnit;
  granularity: MetricGranularity;
  color: string;
  series: MetricSeriesPoint[];
  chartMode: MetricChartMode;
  windowStartBucket: number;
  windowEndBucket: number;
  description: string;
}

interface MetricGroupData {
  id: string;
  label: string;
  cards: MetricChartCardData[];
}

interface MetricsServiceOption {
  service: string;
  label: string;
}

@Component({
  selector: 'metrics-dashboard',
  templateUrl: './metrics-dashboard.html',
  imports: [VButton, VExpand, VInput, VIcon, MetricChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboard implements OnInit, OnDestroy {
  protected readonly metricsService = inject(MetricsService);
  protected readonly metricsHealthService = inject(MetricsHealthService);
  protected readonly Icon = IconName;
  protected readonly settingsPanelKey = SETTINGS_PANEL_KEY;

  private readonly localStorageService = inject(LocalStorageService);

  private readonly now$$ = signal(Date.now());
  private readonly expandedServices$$ = signal<Set<string>>(this.loadExpandedServices());
  protected readonly cardWidthPx$$ = signal<number>(
    this.localStorageService.getUserScoped<number>(CARD_WIDTH_STORAGE_KEY) ?? DEFAULT_CARD_WIDTH_PX,
  );
  protected readonly cardHeightPx$$ = signal<number>(
    this.localStorageService.getUserScoped<number>(CARD_HEIGHT_STORAGE_KEY) ?? DEFAULT_CHART_HEIGHT_PX,
  );
  protected readonly granularityOptions = GRANULARITY_OPTIONS;
  protected readonly selectedGranularity$$ = signal<MetricGranularity>(
    this.loadGranularity(),
  );
  private nowTickIntervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly serviceOptions$$ = computed<MetricsServiceOption[]>(() => {
    const discoveredServices = new Set<string>();
    for (const definition of metricsServiceDefinitions()) {
      discoveredServices.add(definition.service);
    }
    for (const service of this.metricsHealthService.services$$()) {
      discoveredServices.add(service.service);
    }
    for (const point of this.metricsService.points$$()) {
      discoveredServices.add(point.service);
    }

    return Array.from(discoveredServices)
      .map((service) => ({
        service,
        label: metricsServiceLabel(service),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  });

  protected readonly metricGroupsByService$$ = computed<Map<string, MetricGroupData[]>>(() => {
    const granularity = this.selectedGranularity$$();
    const stepSeconds = METRICS_GRANULARITY_STEP_SECONDS[granularity];
    const latestBucket = previousCompletedBucket(this.now$$(), stepSeconds);
    const buckets = buildMetricsWindowBuckets(latestBucket, METRICS_GRANULARITY_WINDOW_PERIODS[granularity], stepSeconds);
    const windowStartBucket = buckets[0];
    const points = this.metricsService.points$$().filter((point) => point.granularity === granularity);
    const pointsIndex = buildMetricPointsIndex(points, windowStartBucket, latestBucket);
    const windowBucketCount = buckets.length;

    const result = new Map<string, MetricGroupData[]>();
    for (const option of this.serviceOptions$$()) {
      const definition = metricsServiceDefinition(option.service);
      if (!definition) {
        result.set(option.service, []);
        continue;
      }

      const groups = definition.groups.map((group) => ({
        id: group.id,
        label: group.label,
        cards: group.metrics.map((name) => {
          const key = metricPointsIndexKey(option.service, name);
          const metricPoints = pointsIndex.get(key) ?? [];
          const chartMode = pickDynamicMetricChartMode(metricPoints.length, windowBucketCount);
          const series =
            chartMode === 'bar'
              ? buildSparseBarSeriesFromPoints(metricPoints)
              : buildSparseLineSeriesFromPoints(metricPoints, stepSeconds);
          const rawValue = metricPoints[metricPoints.length - 1]?.value ?? 0;
          const color = definition.metricColors[name] ?? '#578f92';
          const unit = metricUnit(name);
          return {
            key,
            label: metricLabel(option.service, name),
            technicalName: name,
            value: rawValue,
            displayValue: formatMetricUnitValue(unit, rawValue),
            unit,
            granularity,
            color,
            series,
            chartMode,
            windowStartBucket,
            windowEndBucket: latestBucket,
            description: metricDescription(option.service, name),
          };
        }),
      }));
      result.set(option.service, groups);
    }
    return result;
  });

  public ngOnInit(): void {
    this.metricsService.subscribe();
    this.nowTickIntervalId = setInterval(() => this.now$$.set(Date.now()), NOW_TICK_INTERVAL_MS);
  }

  public ngOnDestroy(): void {
    this.metricsService.unsubscribe();
    if (this.nowTickIntervalId !== null) {
      clearInterval(this.nowTickIntervalId);
    }
  }

  protected serviceLabel(service: string): string {
    return metricsServiceLabel(service);
  }

  protected serviceColor(service: string): string {
    const severity =
      this.metricsHealthService.services$$().find((entry) => entry.service === service)?.severity ?? null;
    return severityColor(severity);
  }

  protected granularityLabel(granularity: MetricGranularity): string {
    switch (granularity) {
      case 'hour':
        return 'Часы';
      case 'day':
        return 'Дни';
      default:
        return 'Минуты';
    }
  }

  protected selectGranularity(granularity: MetricGranularity): void {
    this.selectedGranularity$$.set(granularity);
    this.localStorageService.setUserScoped(GRANULARITY_STORAGE_KEY, granularity);
  }

  protected isServiceExpanded(service: string): boolean {
    return this.expandedServices$$().has(service);
  }

  protected toggleServiceExpanded(service: string): void {
    const expanded = new Set(this.expandedServices$$());
    if (expanded.has(service)) {
      expanded.delete(service);
    } else {
      expanded.add(service);
    }
    this.expandedServices$$.set(expanded);
    this.localStorageService.setUserScoped(EXPANDED_SERVICES_STORAGE_KEY, Array.from(expanded));
  }

  protected onCardWidthChange(value: string): void {
    const widthPx = Number(value);
    if (!Number.isFinite(widthPx) || widthPx <= 0) return;
    this.cardWidthPx$$.set(widthPx);
    this.localStorageService.setUserScoped(CARD_WIDTH_STORAGE_KEY, widthPx);
  }

  protected onCardHeightChange(value: string): void {
    const heightPx = Number(value);
    if (!Number.isFinite(heightPx) || heightPx <= 0) return;
    this.cardHeightPx$$.set(heightPx);
    this.localStorageService.setUserScoped(CARD_HEIGHT_STORAGE_KEY, heightPx);
  }

  private loadExpandedServices(): Set<string> {
    return new Set(this.localStorageService.getUserScoped<string[]>(EXPANDED_SERVICES_STORAGE_KEY) ?? []);
  }

  private loadGranularity(): MetricGranularity {
    const stored = this.localStorageService.getUserScoped<MetricGranularity>(GRANULARITY_STORAGE_KEY);
    return stored && GRANULARITY_OPTIONS.includes(stored) ? stored : 'minute';
  }
}
