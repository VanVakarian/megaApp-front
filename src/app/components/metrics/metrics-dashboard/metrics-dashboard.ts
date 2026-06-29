import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { MetricsService } from '@app/services/metrics.service';
import { metricAggregation } from '@app/shared/metrics-aggregation';
import {
  METRICS_GRANULARITY_STEP_SECONDS,
  METRICS_GRANULARITY_WINDOW_PERIODS,
} from '@app/shared/chart-config';
import { formatMetricUnitValue, metricUnit, MetricUnit } from '@app/shared/metric-units';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { metricDescription } from '@app/shared/metrics-descriptions';
import {
  metricChartMode,
  metricLabel,
  metricsServiceDefinition,
  metricsServiceDefinitions,
  metricsServiceLabel,
} from '@app/shared/metrics-labels';
import {
  buildMetricPointsIndex,
  buildMetricWindow,
  buildCollapsedMetricWindow,
  filterMetricPointsByWindow,
  MinuteMetricCollapseCache,
  buildServiceMetricWindow,
  buildSparseBarSeriesFromPoints,
  buildSparseLineSeriesFromPoints,
  metricPointsIndexKey,
  MetricSeriesPoint,
  previousCompletedBucket,
} from '@app/shared/metrics-series';
import { clearMetricSyncCrosshair } from '@app/shared/metrics-sync-crosshair';
import { severityColor } from '@app/shared/metrics-severity';
import { MetricGranularity, MetricPoint } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import {
  DEFAULT_CARD_WIDTH_PX,
  DEFAULT_CHART_HEIGHT_PX,
  MetricChartCard,
} from '../metric-chart-card/metric-chart-card';

const NOW_TICK_INTERVAL_MS = 30_000;
const LEGACY_EXPANDED_SERVICES_STORAGE_KEY = 'metrics_expanded_services';
const SELECTED_SERVICE_STORAGE_KEY = 'metrics_selected_service';
const SETTINGS_EXPANDED_STORAGE_KEY = 'metrics_settings_expanded';
const CARD_WIDTH_STORAGE_KEY = 'metrics_card_width_px';
const CARD_HEIGHT_STORAGE_KEY = 'metrics_card_height_px';
const GRANULARITY_STORAGE_KEY = 'metrics_granularity';
const SYNC_CROSSHAIR_ENABLED_STORAGE_KEY = 'metrics_sync_crosshair_enabled';
const SETTINGS_PANEL_KEY = '__settings__';
const GRANULARITY_OPTIONS: MetricGranularity[] = ['minute', 'hour', 'day'];
const MINUTE_COLLAPSE_CARD_WIDTH_THRESHOLD_PX = 600;
const COLLAPSED_MINUTE_STEP_SECONDS = 5 * 60;

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
  displayStepSeconds: number;
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
  imports: [VButton, VCheckbox, VExpand, VInput, VIcon, MetricChartCard],
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
  protected readonly syncCrosshairEnabled$$ = signal<boolean>(this.loadSyncCrosshairEnabled());
  protected readonly useCollapsedMinutes$$ = computed(() => this.cardWidthPx$$() < MINUTE_COLLAPSE_CARD_WIDTH_THRESHOLD_PX);
  private nowTickIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly persistExpandedServicesEffect = effect(() => {
    this.persistExpandedServices();
  });
  private readonly minuteMetricCollapseCache = new MinuteMetricCollapseCache();

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
    const useCollapsedMinutes = granularity === 'minute' && this.useCollapsedMinutes$$();
    const fallbackWindow = buildMetricWindow(
      previousCompletedBucket(this.now$$(), stepSeconds),
      METRICS_GRANULARITY_WINDOW_PERIODS[granularity],
      stepSeconds,
    );
    const points = this.metricsService.points$$().filter((point) => point.granularity === granularity);
    const pointsByService = new Map<string, MetricPoint[]>();
    for (const point of points) {
      const servicePoints = pointsByService.get(point.service);
      if (servicePoints) {
        servicePoints.push(point);
        continue;
      }
      pointsByService.set(point.service, [point]);
    }

    const result = new Map<string, MetricGroupData[]>();
    for (const option of this.serviceOptions$$()) {
      const definition = metricsServiceDefinition(option.service);
      if (!definition) {
        result.set(option.service, []);
        continue;
      }

      const serviceWindow = buildServiceMetricWindow(
        pointsByService.get(option.service) ?? [],
        fallbackWindow.endBucket,
        METRICS_GRANULARITY_WINDOW_PERIODS[granularity],
        stepSeconds,
      );
      const displayWindow = useCollapsedMinutes
        ? buildCollapsedMetricWindow(serviceWindow, COLLAPSED_MINUTE_STEP_SECONDS)
        : serviceWindow;
      const displayStepSeconds = useCollapsedMinutes ? COLLAPSED_MINUTE_STEP_SECONDS : stepSeconds;
      const pointsIndex = buildMetricPointsIndex(
        pointsByService.get(option.service) ?? [],
        serviceWindow.startBucket,
        serviceWindow.endBucket,
      );

      const groups = definition.groups.map((group) => ({
        id: group.id,
        label: group.label,
        cards: group.metrics.map((name) => {
          const key = metricPointsIndexKey(option.service, name);
          const metricPoints = pointsIndex.get(key) ?? [];
          const displayPoints = useCollapsedMinutes
            ? filterMetricPointsByWindow(
                this.minuteMetricCollapseCache.collapse(
                  key,
                  metricPoints,
                  metricAggregation(name),
                  COLLAPSED_MINUTE_STEP_SECONDS,
                ),
                displayWindow.startBucket,
                displayWindow.endBucket,
              )
            : metricPoints;
          const chartMode = metricChartMode(option.service, name);
          const series =
            chartMode === 'bar'
              ? buildSparseBarSeriesFromPoints(displayPoints)
              : buildSparseLineSeriesFromPoints(displayPoints, displayStepSeconds);
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
            windowStartBucket: displayWindow.startBucket,
            windowEndBucket: displayWindow.endBucket,
            displayStepSeconds,
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
        return 'H';
      case 'day':
        return 'D';
      default:
        return 'M';
    }
  }

  protected selectGranularity(granularity: MetricGranularity): void {
    clearMetricSyncCrosshair();
    this.selectedGranularity$$.set(granularity);
    this.localStorageService.setUserScoped(GRANULARITY_STORAGE_KEY, granularity);
  }

  protected isServiceExpanded(service: string): boolean {
    if (service !== SETTINGS_PANEL_KEY) {
      return service === this.selectedService();
    }
    return this.expandedServices$$().has(service);
  }

  protected toggleServiceExpanded(service: string): void {
    const expanded = new Set(this.expandedServices$$());
    const currentSelectedService = Array.from(expanded).find((key) => key !== SETTINGS_PANEL_KEY) ?? null;
    if (service === SETTINGS_PANEL_KEY) {
      if (expanded.has(service)) {
        expanded.delete(service);
      } else {
        expanded.add(service);
      }
      this.expandedServices$$.set(expanded);
      return;
    }

    if (service === this.selectedService() && currentSelectedService === service) {
      return;
    }

    clearMetricSyncCrosshair();
    for (const key of expanded) {
      if (key !== SETTINGS_PANEL_KEY) {
        expanded.delete(key);
      }
    }
    expanded.add(service);
    this.expandedServices$$.set(expanded);
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

  protected onSyncCrosshairEnabledChange(value: boolean): void {
    this.syncCrosshairEnabled$$.set(value);
    this.localStorageService.setUserScoped(SYNC_CROSSHAIR_ENABLED_STORAGE_KEY, value);
    if (!value) {
      clearMetricSyncCrosshair();
    }
  }

  private loadExpandedServices(): Set<string> {
    const expanded = new Set<string>();
    const selectedService = this.localStorageService.getUserScoped<string>(SELECTED_SERVICE_STORAGE_KEY);
    if (typeof selectedService === 'string' && selectedService) {
      expanded.add(selectedService);
    }

    if (this.localStorageService.getUserScoped<boolean>(SETTINGS_EXPANDED_STORAGE_KEY)) {
      expanded.add(SETTINGS_PANEL_KEY);
    }

    const legacyExpanded = this.localStorageService.getUserScoped<string[] | string>(
      LEGACY_EXPANDED_SERVICES_STORAGE_KEY,
    );
    if (expanded.size > 0) {
      return expanded;
    }

    if (Array.isArray(legacyExpanded)) {
      const legacySelectedService = legacyExpanded.find((service) => service !== SETTINGS_PANEL_KEY);
      if (legacySelectedService) {
        expanded.add(legacySelectedService);
      }
      if (legacyExpanded.includes(SETTINGS_PANEL_KEY)) {
        expanded.add(SETTINGS_PANEL_KEY);
      }
      return expanded;
    }

    if (typeof legacyExpanded === 'string' && legacyExpanded) {
      expanded.add(legacyExpanded);
    }

    return expanded;
  }

  private loadGranularity(): MetricGranularity {
    const stored = this.localStorageService.getUserScoped<MetricGranularity>(GRANULARITY_STORAGE_KEY);
    return stored && GRANULARITY_OPTIONS.includes(stored) ? stored : 'minute';
  }

  private loadSyncCrosshairEnabled(): boolean {
    return this.localStorageService.getUserScoped<boolean>(SYNC_CROSSHAIR_ENABLED_STORAGE_KEY) ?? false;
  }

  private selectedService(): string | null {
    const selectedService = Array.from(this.expandedServices$$()).find((service) => service !== SETTINGS_PANEL_KEY);
    if (selectedService && this.serviceOptions$$().some((option) => option.service === selectedService)) {
      return selectedService;
    }
    return this.serviceOptions$$()[0]?.service ?? null;
  }

  private persistExpandedServices(): void {
    const selectedService = this.selectedService();
    if (selectedService) {
      this.localStorageService.setUserScoped(SELECTED_SERVICE_STORAGE_KEY, selectedService);
    } else {
      this.localStorageService.removeUserScoped(SELECTED_SERVICE_STORAGE_KEY);
    }
    this.localStorageService.setUserScoped(
      SETTINGS_EXPANDED_STORAGE_KEY,
      this.expandedServices$$().has(SETTINGS_PANEL_KEY),
    );
  }
}
