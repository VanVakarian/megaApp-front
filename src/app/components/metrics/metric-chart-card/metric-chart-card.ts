import { ChangeDetectionStrategy, Component, effect, ElementRef, input, OnDestroy, viewChild } from '@angular/core';
import {
  createMetricBarConfig,
  createMetricSparklineConfig,
  createMetricSparseLineConfig,
  METRICS_TICK_INTERVAL_MINUTES,
} from '@app/shared/chart-config';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { MetricUnit } from '@app/shared/metric-units';
import {
  buildRoundTickBuckets,
  buildRoundTickIndices,
  formatMetricBucketLabel,
  MetricSeriesPoint,
} from '@app/shared/metrics-series';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VTooltip } from '@ui-kit/components/v-tooltip/v-tooltip';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Tooltip,
);

export const DEFAULT_CARD_WIDTH_PX = 304;
export const DEFAULT_CHART_HEIGHT_PX = 112;

@Component({
  selector: 'metric-chart-card',
  templateUrl: './metric-chart-card.html',
  imports: [VCard, VIcon, VTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricChartCard implements OnDestroy {
  public readonly labelInput = input.required<string>();
  public readonly technicalNameInput = input<string>('');
  public readonly valueInput = input<number>(0);
  public readonly displayValueInput = input<string>('');
  public readonly colorInput = input.required<string>();
  public readonly unitInput = input<MetricUnit>('count');
  public readonly seriesInput = input.required<MetricSeriesPoint[]>();
  public readonly chartModeInput = input<MetricChartMode>('filled');
  public readonly windowStartInput = input<number>(0);
  public readonly windowEndInput = input<number>(0);
  public readonly descriptionInput = input<string>('');
  public readonly widthPxInput = input<number>(DEFAULT_CARD_WIDTH_PX);
  public readonly heightPxInput = input<number>(DEFAULT_CHART_HEIGHT_PX);

  protected readonly Icon = IconName;

  private readonly chartCanvasElem = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;
  private chartSignature = '';

  private readonly chartUpdateEffect = effect(() => {
    const canvasElem = this.chartCanvasElem();
    const chartMode = this.chartModeInput();
    const color = this.colorInput();
    const unit = this.unitInput();
    const series = this.seriesInput();
    this.windowStartInput();
    this.windowEndInput();
    if (!canvasElem) return;
    this.ensureChart(canvasElem.nativeElement, chartMode, color, unit);
    this.updateChart(series);
  });

  public ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.chartSignature = '';
  }

  private createChartConfig(chartMode: MetricChartMode, color: string, unit: MetricUnit): ChartConfiguration {
    switch (chartMode) {
      case 'bar':
        return createMetricBarConfig(color, unit);
      case 'sparse-line':
        return createMetricSparseLineConfig(color, unit);
      default:
        return createMetricSparklineConfig(color);
    }
  }

  private ensureChart(canvas: HTMLCanvasElement, chartMode: MetricChartMode, color: string, unit: MetricUnit): void {
    const signature = `${chartMode}:${color}:${unit}`;
    if (this.chart && this.chartSignature === signature) {
      return;
    }

    this.chart?.destroy();

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.chart = null;
      this.chartSignature = '';
      return;
    }

    this.chart = new Chart(ctx, this.createChartConfig(chartMode, color, unit));
    this.chartSignature = signature;
  }

  private updateChart(series: MetricSeriesPoint[]): void {
    if (!this.chart) return;
    if (this.chartModeInput() === 'filled') {
      this.updateFilledChart(series);
    } else {
      this.updateSparseChart(series);
    }
    this.chart.update('none');
  }

  private updateFilledChart(series: MetricSeriesPoint[]): void {
    const buckets = series.map((point) => point.bucket);
    const tickIndices = buildRoundTickIndices(buckets, METRICS_TICK_INTERVAL_MINUTES);

    this.chart!.data.labels = buckets.map((bucket) => formatMetricBucketLabel(bucket));
    this.chart!.data.datasets[0].data = series.map((point) => point.value);
    this.chart!.options.scales!['x']!.afterBuildTicks = (axis) => {
      axis.ticks = tickIndices.map((index) => ({ value: index }));
    };
  }

  private updateSparseChart(series: MetricSeriesPoint[]): void {
    const windowStart = this.windowStartInput();
    const windowEnd = this.windowEndInput();
    const tickBuckets = buildRoundTickBuckets(windowStart, windowEnd, METRICS_TICK_INTERVAL_MINUTES);

    this.chart!.data.datasets[0].data = series.map((point) => ({
      x: point.bucket,
      y: point.value,
    })) as unknown as number[];
    this.chart!.options.scales!['x']!.min = windowStart;
    this.chart!.options.scales!['x']!.max = windowEnd;
    this.chart!.options.scales!['x']!.afterBuildTicks = (axis) => {
      axis.ticks = tickBuckets.map((value) => ({ value }));
    };

    const isLine = this.chartModeInput() === 'sparse-line';
    const values = series.map((point) => point.value).filter((value): value is number => value !== null);
    let min = isLine && values.length > 0 ? Math.min(...values) : 0;
    let max = values.length > 0 ? Math.max(...values) : 1;
    if (min === max) {
      min -= 1;
      max += 1;
    }
    this.chart!.options.scales!['y']!.min = min;
    this.chart!.options.scales!['y']!.max = max;
    this.chart!.options.scales!['y']!.afterBuildTicks = (axis) => {
      axis.ticks = [{ value: min }, { value: max }];
    };
  }
}
