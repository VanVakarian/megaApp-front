import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { MetricsService } from '@app/services/metrics.service';
import { METRICS_SERIES_PALETTE, METRICS_WINDOW_MINUTES } from '@app/shared/chart-config';
import {
  metricsServiceDefinition,
  metricsServiceDefinitions,
  metricsServiceLabel,
  metricLabel,
  MetricsServiceDefinition,
} from '@app/shared/metrics-labels';
import { buildMetricsWindowBuckets, MetricSeriesPoint, previousMinuteBucket, zeroFillMetricSeries } from '@app/shared/metrics-series';
import { severityDotClass, severityLabel } from '@app/shared/metrics-severity';
import { MetricsHealthSeverity } from '@app/shared/types';
import { MetricCard } from '../metric-card/metric-card';
import { MetricChartCard } from '../metric-chart-card/metric-chart-card';

const NOW_TICK_INTERVAL_MS = 30_000;

interface MetricChartCardData {
  key: string;
  label: string;
  value: number;
  color: string;
  series: MetricSeriesPoint[];
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
  imports: [MetricCard, MetricChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboard implements OnInit, OnDestroy {
  protected readonly metricsService = inject(MetricsService);
  protected readonly metricsHealthService = inject(MetricsHealthService);

  private readonly now$$ = signal(Date.now());
  private readonly selectedService$$ = signal<string | null>(null);
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

    return Array.from(discoveredServices).map((service) => ({
      service,
      label: metricsServiceLabel(service),
    }));
  });

  protected readonly selectedServiceDefinition$$ = computed<MetricsServiceDefinition | null>(() =>
    metricsServiceDefinition(this.selectedService$$()),
  );

  protected readonly metricGroups$$ = computed<MetricGroupData[]>(() => {
    const definition = this.selectedServiceDefinition$$();
    const selectedService = this.selectedService$$();
    if (!definition || !selectedService) return [];

    const latestBucket = previousMinuteBucket(this.now$$());
    const buckets = buildMetricsWindowBuckets(latestBucket, METRICS_WINDOW_MINUTES);
    const points = this.metricsService.points$$();

    let colorIndex = 0;
    return definition.groups.map((group) => ({
      id: group.id,
      label: group.label,
      cards: group.metrics.map((name) => {
        const series = zeroFillMetricSeries(points, selectedService, name, buckets);
        const value = series[series.length - 1]?.value ?? 0;
        const color = METRICS_SERIES_PALETTE[colorIndex % METRICS_SERIES_PALETTE.length];
        colorIndex++;
        return {
          key: `${selectedService}:${name}`,
          label: metricLabel(selectedService, name),
          value,
          color,
          series,
        };
      }),
    }));
  });

  private readonly syncSelectedServiceEffect = effect(() => {
    const options = this.serviceOptions$$();
    const selected = this.selectedService$$();

    if (selected && options.some((option) => option.service === selected)) {
      return;
    }

    this.selectedService$$.set(options[0]?.service ?? null);
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

  protected serviceDotClass(severity: MetricsHealthSeverity): string {
    return severityDotClass(severity);
  }

  protected serviceSeverityLabel(severity: MetricsHealthSeverity): string {
    return severityLabel(severity);
  }

  protected serviceLabel(service: string): string {
    return metricsServiceLabel(service);
  }

  protected selectService(service: string): void {
    this.selectedService$$.set(service);
  }

  protected isServiceSelected(service: string): boolean {
    return this.selectedService$$() === service;
  }
}
