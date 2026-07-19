import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import {
  createMetricBarConfig,
  createMetricSparseLineConfig,
  pickMetricTickIntervalSeconds,
} from '@app/shared/chart-config';
import { formatMetricUnitValue, MetricUnit } from '@app/shared/metric-units';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { buildRoundTickBuckets, findNearestSeriesPoint, MetricSeriesPoint } from '@app/shared/metrics-series';
import {
  hoverBucket$$,
  MetricSyncCrosshairOptions,
  metricSyncCrosshairPlugin,
} from '@app/shared/metrics-sync-crosshair';
import { MetricGranularity } from '@app/shared/types';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
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
  metricSyncCrosshairPlugin,
);

export const DEFAULT_CARD_WIDTH_PX = 304;
export const DEFAULT_CHART_HEIGHT_PX = 112;

// How many display steps away from the hovered time a real point may still be
// and get shown as "the value at this time" — e.g. 3 on a 5-minute-step chart
// captures a point up to 15 minutes to either side. Hardcoded on purpose, not a
// user setting.
const CROSSHAIR_CAPTURE_STEP_MULTIPLIER = 3;

// Shown while hovering when no point falls within the capture window above.
const HOVER_NO_VALUE_PLACEHOLDER = '—';

@Component({
  selector: 'metric-chart-card',
  templateUrl: './metric-chart-card.html',
  imports: [VCard, VCheckbox, VIcon, VInput, VTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricChartCard implements OnDestroy {
  public readonly labelInput = input.required<string>();
  public readonly technicalNameInput = input<string>('');
  public readonly valueInput = input<number>(0);
  public readonly displayValueInput = input<string>('');
  public readonly colorInput = input.required<string>();
  public readonly unitInput = input<MetricUnit>('count');
  public readonly granularityInput = input<MetricGranularity>('minute');
  public readonly seriesInput = input.required<MetricSeriesPoint[]>();
  public readonly chartModeInput = input<MetricChartMode>('sparse-line');
  public readonly windowStartInput = input<number>(0);
  public readonly windowEndInput = input<number>(0);
  public readonly displayStepSecondsInput = input<number>(60);
  public readonly syncCrosshairEnabledInput = input<boolean>(false);
  public readonly forceZeroBaselineInput = input<boolean>(false);
  public readonly descriptionInput = input<string>('');
  public readonly widthPxInput = input<number>(DEFAULT_CARD_WIDTH_PX);
  public readonly heightPxInput = input<number>(DEFAULT_CHART_HEIGHT_PX);
  public readonly isSelectedInput = input<boolean>(false);
  public readonly isInteractiveInput = input<boolean>(false);
  public readonly isEditModeInput = input<boolean>(false);
  public readonly hideDashboardControlsInput = input<boolean>(false);
  public readonly isDashboardEnabledInput = input<boolean>(false);
  public readonly dashboardOrderInput = input<number>(0);
  public readonly isSelectionDisabledInput = input<boolean>(false);

  public readonly cardClickOutput = output<void>();
  public readonly dashboardEnabledChangeOutput = output<boolean>();
  public readonly dashboardOrderChangeOutput = output<number>();

  protected readonly Icon = IconName;

  // While the synced crosshair is active, the header number tracks the highlighted
  // time instead of the series' last value — a dash when nothing falls within the
  // capture window, back to the static value the instant the crosshair clears
  // (hoverBucket$$ going null), for every card at once, since it's one shared signal.
  protected readonly headerDisplayValue$$ = computed(() => {
    const hoverBucket = hoverBucket$$();
    if (hoverBucket === null || !this.syncCrosshairEnabledInput()) {
      return this.displayValueInput() || String(this.valueInput());
    }

    const nearest = findNearestSeriesPoint(this.seriesInput(), hoverBucket);
    const captureWindowSeconds = CROSSHAIR_CAPTURE_STEP_MULTIPLIER * this.displayStepSecondsInput();
    if (!nearest || nearest.value === null || Math.abs(nearest.bucket - hoverBucket) > captureWindowSeconds) {
      return HOVER_NO_VALUE_PLACEHOLDER;
    }

    return formatMetricUnitValue(this.unitInput(), nearest.value);
  });

  protected onCardClick(event: MouseEvent): void {
    if (!this.isInteractiveInput() || event.target instanceof HTMLCanvasElement) return;
    this.cardClickOutput.emit();
  }

  protected onDashboardEnabledChange(enabled: boolean): void {
    this.dashboardEnabledChangeOutput.emit(enabled);
  }

  protected onDashboardOrderChange(rawValue: string): void {
    const order = Number(rawValue);
    if (!Number.isFinite(order)) return;
    this.dashboardOrderChangeOutput.emit(order);
  }

  private readonly chartCanvasElem = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;
  private chartSignature = '';

  private readonly chartUpdateEffect = effect(() => {
    const canvasElem = this.chartCanvasElem();
    const chartMode = this.chartModeInput();
    const color = this.colorInput();
    const unit = this.unitInput();
    const granularity = this.granularityInput();
    const series = this.seriesInput();
    this.windowStartInput();
    this.windowEndInput();
    this.displayStepSecondsInput();
    this.syncCrosshairEnabledInput();
    this.forceZeroBaselineInput();
    if (!canvasElem) return;
    this.ensureChart(canvasElem.nativeElement, chartMode, color, unit, granularity);
    this.updateChart(series);
  });

  public ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.chartSignature = '';
  }

  private createChartConfig(
    chartMode: MetricChartMode,
    color: string,
    unit: MetricUnit,
    granularity: MetricGranularity,
  ): ChartConfiguration {
    if (chartMode === 'bar') {
      return createMetricBarConfig(color, unit, granularity);
    }
    return createMetricSparseLineConfig(color, unit, granularity);
  }

  private ensureChart(
    canvas: HTMLCanvasElement,
    chartMode: MetricChartMode,
    color: string,
    unit: MetricUnit,
    granularity: MetricGranularity,
  ): void {
    const signature = `${chartMode}:${color}:${unit}:${granularity}`;
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

    this.chart = new Chart(ctx, this.createChartConfig(chartMode, color, unit, granularity));
    this.chartSignature = signature;
  }

  private updateChart(series: MetricSeriesPoint[]): void {
    if (!this.chart) return;
    this.updateSparseChart(series);
    this.chart.update('none');
  }

  private updateSparseChart(series: MetricSeriesPoint[]): void {
    const windowStart = this.windowStartInput();
    const windowEnd = this.windowEndInput();
    const granularity = this.granularityInput();
    const stepSeconds = this.displayStepSecondsInput();
    const windowBucketCount = Math.max(1, Math.floor((windowEnd - windowStart) / stepSeconds) + 1);
    const tickBuckets = buildRoundTickBuckets(
      windowStart,
      windowEnd,
      pickMetricTickIntervalSeconds(granularity, windowBucketCount, stepSeconds),
    );

    this.chart!.data.datasets[0].data = series.map((point) => ({
      x: point.bucket,
      y: point.value,
    })) as unknown as number[];
    this.chart!.options.scales!['x']!.min = windowStart;
    this.chart!.options.scales!['x']!.max = windowEnd;
    this.chart!.options.scales!['x']!.afterBuildTicks = (axis) => {
      axis.ticks = tickBuckets.map((value) => ({ value }));
    };
    // Chart.js resolves `options.plugins` through a scriptable-options Proxy
    // once the chart has rendered — spreading it (`{...chart.options.plugins}`)
    // enumerates its internal symbol keys too, which crashes Chart.js's own
    // `_scriptable(name)` check (expects a string). Setting a single known
    // key in place avoids the enumeration entirely.
    this.chart!.options.plugins ??= {};
    this.chart!.options.plugins.metricSyncCrosshair = this.syncCrosshairOptions();

    const values = series.map((point) => point.value).filter((value): value is number => value !== null);
    const forceZeroBaseline = this.chartModeInput() === 'bar' || this.forceZeroBaselineInput();
    let min = forceZeroBaseline ? 0 : values.length > 0 ? Math.min(...values) : 0;
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

  private syncCrosshairOptions(): MetricSyncCrosshairOptions {
    return {
      enabled: this.syncCrosshairEnabledInput(),
      windowStartBucket: this.windowStartInput(),
      windowEndBucket: this.windowEndInput(),
      displayStepSeconds: this.displayStepSecondsInput(),
    };
  }
}
