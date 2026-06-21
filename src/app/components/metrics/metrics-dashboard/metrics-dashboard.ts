import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MetricsService } from '@app/services/metrics.service';
import { METRICS_CHART_CONFIG, METRICS_SERIES_PALETTE } from '@app/shared/chart-config';
import { MetricPoint } from '@app/shared/types';
import {
  CategoryScale,
  Chart,
  ChartDataset,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend);

@Component({
  selector: 'metrics-dashboard',
  templateUrl: './metrics-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboard implements AfterViewInit, OnDestroy {
  protected readonly chartCanvasElem = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly metricsService = inject(MetricsService);

  protected readonly chart$$ = signal<Chart | null>(null);

  protected readonly metricNames$$ = computed(() => {
    const names = new Set(this.metricsService.points$$().map((point) => point.name));
    return Array.from(names).sort();
  });

  private readonly chartUpdateEffect = effect(() => {
    const points = this.metricsService.points$$();
    const chart = this.chart$$();
    if (!chart) return;
    this.rebuildChart(chart, points);
  });

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvasElem().nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart$$.set(new Chart(ctx, METRICS_CHART_CONFIG));
    this.metricsService.subscribe();
  }

  public ngOnDestroy(): void {
    this.metricsService.unsubscribe();
    this.chart$$()?.destroy();
  }

  private rebuildChart(chart: Chart, points: MetricPoint[]): void {
    const buckets = Array.from(new Set(points.map((point) => point.bucket))).sort((a, b) => a - b);
    const names = this.metricNames$$();

    const datasets: ChartDataset<'line'>[] = names.map((name, index) => {
      const valueByBucket = new Map(
        points.filter((point) => point.name === name).map((point) => [point.bucket, point.value]),
      );
      const color = METRICS_SERIES_PALETTE[index % METRICS_SERIES_PALETTE.length];
      return {
        label: name,
        data: buckets.map((bucket) => valueByBucket.get(bucket) ?? 0),
        borderColor: color,
        backgroundColor: color,
      };
    });

    chart.data.labels = buckets.map((bucket) => this.formatBucketLabel(bucket));
    chart.data.datasets = datasets;
    chart.update('none');
  }

  private formatBucketLabel(bucketSeconds: number): string {
    const date = new Date(bucketSeconds * 1000);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
