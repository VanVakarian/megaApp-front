import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { MetricsService } from '@app/services/metrics.service';
import { METRICS_SERIES_PALETTE, METRICS_WINDOW_MINUTES } from '@app/shared/chart-config';
import { KNOWN_METRIC_NAMES, metricLabel } from '@app/shared/metrics-labels';
import { buildMetricsWindowBuckets, MetricSeriesPoint, previousMinuteBucket, zeroFillMetricSeries } from '@app/shared/metrics-series';
import { severityDotClass, severityLabel } from '@app/shared/metrics-severity';
import { MetricsHealthSeverity } from '@app/shared/types';
import { MetricCard } from '../metric-card/metric-card';
import { MetricChartCard } from '../metric-chart-card/metric-chart-card';

const NOW_TICK_INTERVAL_MS = 30_000;

interface MetricChartCardData {
  name: string;
  label: string;
  total: number;
  color: string;
  series: MetricSeriesPoint[];
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
  private nowTickIntervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly metricCards$$ = computed<MetricChartCardData[]>(() => {
    const latestBucket = previousMinuteBucket(this.now$$());
    const buckets = buildMetricsWindowBuckets(latestBucket, METRICS_WINDOW_MINUTES);
    const points = this.metricsService.points$$();

    return KNOWN_METRIC_NAMES.map((name, index) => {
      const series = zeroFillMetricSeries(points, name, buckets);
      const total = series.reduce((sum, point) => sum + point.value, 0);
      return {
        name,
        label: metricLabel(name),
        total,
        color: METRICS_SERIES_PALETTE[index % METRICS_SERIES_PALETTE.length],
        series,
      };
    });
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
}
