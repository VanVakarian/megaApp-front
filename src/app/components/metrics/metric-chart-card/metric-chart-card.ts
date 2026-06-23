import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { createMetricSparklineConfig, METRICS_TICK_INTERVAL_MINUTES } from '@app/shared/chart-config';
import { buildRoundTickIndices, formatMetricBucketLabel, MetricSeriesPoint } from '@app/shared/metrics-series';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { CategoryScale, Chart, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip);

@Component({
  selector: 'metric-chart-card',
  templateUrl: './metric-chart-card.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricChartCard implements AfterViewInit, OnDestroy {
  public readonly labelInput = input.required<string>();
  public readonly valueInput = input<number>(0);
  public readonly colorInput = input.required<string>();
  public readonly seriesInput = input.required<MetricSeriesPoint[]>();

  private readonly chartCanvasElem = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;

  private readonly chartUpdateEffect = effect(() => {
    this.updateChart(this.seriesInput());
  });

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvasElem().nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart = new Chart(ctx, createMetricSparklineConfig(this.colorInput()));
    this.updateChart(this.seriesInput());
  }

  public ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private updateChart(series: MetricSeriesPoint[]): void {
    if (!this.chart) return;
    const buckets = series.map((point) => point.bucket);
    const tickIndices = buildRoundTickIndices(buckets, METRICS_TICK_INTERVAL_MINUTES);

    this.chart.data.labels = buckets.map((bucket) => formatMetricBucketLabel(bucket));
    this.chart.data.datasets[0].data = series.map((point) => point.value);
    this.chart.options.scales!['x']!.afterBuildTicks = (axis) => {
      axis.ticks = tickIndices.map((index) => ({ value: index }));
    };
    this.chart.update('none');
  }
}
