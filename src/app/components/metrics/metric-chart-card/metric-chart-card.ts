import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ChartThemeService } from '@app/services/chart-theme.service';
import { TooltipMode } from '@app/services/metrics-settings.service';
import {
  ChartColors,
  createMetricBarConfig,
  createMetricSparseLineConfig,
  MetricTooltipInteractionMode,
} from '@app/shared/chart-config';
import { formatMetricUnitValue, MetricUnit } from '@app/shared/metric-units';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import {
  buildPaddedTickBuckets,
  buildRoundDayTickBuckets,
  buildRoundTickBuckets,
  findNearestSeriesPoint,
  formatMetricBucketLabel,
  MetricSeriesPoint,
} from '@app/shared/metrics-series';
import {
  hoverBucket$$,
  MetricSyncCrosshairOptions,
  metricSyncCrosshairPlugin,
} from '@app/shared/metrics-sync-crosshair';
import { MetricGranularity } from '@app/shared/types';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
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

export const DEFAULT_CHART_HEIGHT_PX = 112;

// How many display steps away from the hovered time a real point may still be
// and get shown as "the value at this time" — e.g. 3 on a 5-minute-step chart
// captures a point up to 15 minutes to either side. Hardcoded on purpose, not a
// user setting.
const CROSSHAIR_CAPTURE_STEP_MULTIPLIER = 3;

// On a full-width chart, ticks land on round time values instead of being evenly
// spaced across the window: round hours for minute granularity, local day starts
// (00:00) for hour/day granularity.
const ROUND_HOUR_TICK_INTERVAL_SECONDS = 3600;
// Only used to estimate on-screen tick spacing for the day-tick thinning below —
// actual tick positions still come from buildRoundDayTickBuckets, which steps by
// calendar day (not a flat 86400s) so DST doesn't drift them off local midnight.
const ROUND_DAY_TICK_INTERVAL_SECONDS = 86400;

// Canvas text can't be measured without a real render, so tick label width is
// estimated instead of measured: both "HH:MM" and "DD.MM" are 4 digits plus one
// separator, so one estimate covers both. Gap is the minimum breathing room
// wanted between two adjacent labels before they start to crowd.
const TICK_LABEL_WIDTH_PX = 33;
const TICK_LABEL_GAP_PX = 13;
const TICK_LABEL_SLOT_PX = TICK_LABEL_WIDTH_PX + TICK_LABEL_GAP_PX;

// Shown while hovering when no point falls within the capture window above.
const HOVER_NO_VALUE_PLACEHOLDER = '—';

@Component({
  selector: 'metric-chart-card',
  templateUrl: './metric-chart-card.html',
  imports: [VCard, VCheckbox, VInput, VTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricChartCard implements OnInit, OnDestroy {
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
  public readonly isFullWidthInput = input<boolean>(false);
  public readonly syncCrosshairEnabledInput = input<boolean>(false);
  public readonly forceZeroBaselineInput = input<boolean>(false);
  public readonly tooltipModeInput = input<TooltipMode>(TooltipMode.Nearest);
  public readonly descriptionInput = input<string>('');
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

  // Widest formatted value across the currently visible window (whatever unit —
  // money, count, ratio, durations all vary wildly in digit count). Padding every
  // header value out to this width up front means scrubbing across a card whose
  // series spans e.g. "20" through "24480" never reflows the header (or the time
  // label and title next to it) as the digit count changes underfoot.
  private readonly headerValuePadWidth$$ = computed(() => {
    const unit = this.unitInput();
    let maxLength = (this.displayValueInput() || String(this.valueInput())).length;
    for (const point of this.seriesInput()) {
      if (point.value === null) continue;
      maxLength = Math.max(maxLength, formatMetricUnitValue(unit, point.value).length);
    }
    return maxLength;
  });

  // While the synced crosshair is active, the header tracks the highlighted time
  // instead of the series' last value — a dash when nothing falls within the
  // capture window, back to the static value the instant the crosshair clears
  // (hoverBucket$$ going null), for every card at once, since it's one shared signal.
  // Left-padded with non-breaking spaces (plain spaces would collapse in the DOM)
  // to headerValuePadWidth$$ so the monospace value column never resizes.
  protected readonly headerDisplayValue$$ = computed(() => {
    const padWidth = this.headerValuePadWidth$$();
    const hoverBucket = hoverBucket$$();
    if (hoverBucket === null || !this.syncCrosshairEnabledInput()) {
      return (this.displayValueInput() || String(this.valueInput())).padStart(padWidth, ' ');
    }

    const nearest = findNearestSeriesPoint(this.seriesInput(), hoverBucket);
    const captureWindowSeconds = CROSSHAIR_CAPTURE_STEP_MULTIPLIER * this.displayStepSecondsInput();
    if (!nearest || nearest.value === null || Math.abs(nearest.bucket - hoverBucket) > captureWindowSeconds) {
      return HOVER_NO_VALUE_PLACEHOLDER.padStart(padWidth, ' ');
    }

    return formatMetricUnitValue(this.unitInput(), nearest.value).padStart(padWidth, ' ');
  });

  // Bucket the header value above corresponds to, formatted per granularity
  // (time for minute, date+time for hour, date for day) — replaces the chart's
  // own popup tooltip, which showed the same label on hover. Empty (and hidden
  // in the template) outside a hover, since "this is the current value" needs
  // no timestamp to be understood.
  protected readonly headerDisplayTime$$ = computed(() => {
    const hoverBucket = hoverBucket$$();
    if (hoverBucket === null || !this.syncCrosshairEnabledInput()) {
      return '';
    }

    const nearest = findNearestSeriesPoint(this.seriesInput(), hoverBucket);
    const captureWindowSeconds = CROSSHAIR_CAPTURE_STEP_MULTIPLIER * this.displayStepSecondsInput();
    if (!nearest || nearest.value === null || Math.abs(nearest.bucket - hoverBucket) > captureWindowSeconds) {
      return '';
    }

    return formatMetricBucketLabel(nearest.bucket, this.granularityInput());
  });

  // OHLC across the currently visible series — seriesInput is already scoped
  // to [windowStartInput, windowEndInput] by the parent, sorted by bucket ascending,
  // so the first/last non-null values double as open/close.
  protected readonly headerOhlcDisplay$$ = computed(() => {
    const values = this.seriesInput()
      .map((point) => point.value)
      .filter((value): value is number => value !== null);
    if (values.length === 0) return null;

    const unit = this.unitInput();
    const open = formatMetricUnitValue(unit, values[0]);
    const high = formatMetricUnitValue(unit, Math.max(...values));
    const low = formatMetricUnitValue(unit, Math.min(...values));
    const close = formatMetricUnitValue(unit, values[values.length - 1]);
    return `O: ${open} — H: ${high} — L: ${low} — C: ${close}`;
  });

  protected onCardClick(): void {
    if (!this.isInteractiveInput()) return;
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

  // The card's own rendered width — not the grid's — decides whether round ticks
  // need thinning, so it's tracked directly on this component's host rather than
  // derived from the grid's column-fitting math.
  private readonly hostElement: HTMLElement;
  private readonly cardWidthPx$$ = signal(0);
  private resizeObserver: ResizeObserver | null = null;
  private readonly chartThemeService = inject(ChartThemeService);

  private readonly chartUpdateEffect = effect(() => {
    const canvasElem = this.chartCanvasElem();
    const chartMode = this.chartModeInput();
    const color = this.colorInput();
    const unit = this.unitInput();
    const granularity = this.granularityInput();
    const tooltipMode = this.tooltipModeInput();
    const series = this.seriesInput();
    this.windowStartInput();
    this.windowEndInput();
    this.displayStepSecondsInput();
    this.isFullWidthInput();
    this.cardWidthPx$$();
    this.syncCrosshairEnabledInput();
    this.forceZeroBaselineInput();
    // This chart's own dataset color comes from colorInput, not the theme — colors$$ is only
    // needed to detect a theme switch and recreate the chart so its grid/tick colors repaint
    // (see createChartConfig/ensureChart: Chart.js doesn't reliably repaint a scale's cached
    // resolved color from an in-place chart.update() alone).
    const colors = this.chartThemeService.colors$$();
    if (!canvasElem) return;
    this.ensureChart(canvasElem.nativeElement, chartMode, color, unit, granularity, tooltipMode, colors);
    this.updateChart(series);
  });

  public constructor(elementRef: ElementRef<HTMLElement>) {
    this.hostElement = elementRef.nativeElement;
  }

  public ngOnInit(): void {
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.cardWidthPx$$.set(entry.contentRect.width);
    });
    this.resizeObserver.observe(this.hostElement);
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.destroy();
    this.chart = null;
    this.chartSignature = '';
  }

  private createChartConfig(
    chartMode: MetricChartMode,
    color: string,
    unit: MetricUnit,
    granularity: MetricGranularity,
    tooltipMode: TooltipMode,
    colors: ChartColors,
  ): ChartConfiguration {
    const tooltipInteractionMode: MetricTooltipInteractionMode =
      tooltipMode === TooltipMode.Vertical ? 'index' : 'nearest';
    if (chartMode === 'bar') {
      return createMetricBarConfig(color, unit, granularity, tooltipInteractionMode, colors);
    }
    return createMetricSparseLineConfig(color, unit, granularity, tooltipInteractionMode, colors);
  }

  private ensureChart(
    canvas: HTMLCanvasElement,
    chartMode: MetricChartMode,
    color: string,
    unit: MetricUnit,
    granularity: MetricGranularity,
    tooltipMode: TooltipMode,
    colors: ChartColors,
  ): void {
    // colors.grid alone uniquely identifies the theme (CHART_COLORS_LIGHT vs _DARK) — included
    // so a theme toggle is treated the same as any other config change: destroy and rebuild,
    // rather than an in-place chart.update() that wouldn't reliably repaint the scale colors.
    const signature = `${chartMode}:${color}:${unit}:${granularity}:${tooltipMode}:${colors.grid}`;
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

    this.chart = new Chart(ctx, this.createChartConfig(chartMode, color, unit, granularity, tooltipMode, colors));
    this.chartSignature = signature;
  }

  private updateChart(series: MetricSeriesPoint[]): void {
    if (!this.chart) return;
    this.updateSparseChart(series);
    this.chart.update('none');
  }

  private buildTickBuckets(windowStart: number, windowEnd: number): number[] {
    if (!this.isFullWidthInput()) {
      return buildPaddedTickBuckets(windowStart, windowEnd);
    }
    if (this.granularityInput() === 'minute') {
      const ticks = buildRoundTickBuckets(windowStart, windowEnd, ROUND_HOUR_TICK_INTERVAL_SECONDS);
      return this.thinTicksToFit(ticks, ROUND_HOUR_TICK_INTERVAL_SECONDS, windowStart, windowEnd);
    }
    const ticks = buildRoundDayTickBuckets(windowStart, windowEnd);
    return this.thinTicksToFit(ticks, ROUND_DAY_TICK_INTERVAL_SECONDS, windowStart, windowEnd);
  }

  // Full-density ticks are evenly spaced by `intervalSeconds`, so their on-screen
  // spacing is derivable from the card's own rendered width without ever touching
  // the canvas: pixels-per-tick = cardWidthPx * intervalSeconds / windowSpanSeconds.
  // The smallest stride whose spacing still clears TICK_LABEL_SLOT_PX is kept —
  // 1 (every tick) when there's room, rising only as far as actually needed.
  private thinTicksToFit(ticks: number[], intervalSeconds: number, windowStart: number, windowEnd: number): number[] {
    const cardWidthPx = this.cardWidthPx$$();
    const windowSpanSeconds = windowEnd - windowStart;
    if (cardWidthPx <= 0 || windowSpanSeconds <= 0) {
      return ticks;
    }

    const fullDensitySpacingPx = (cardWidthPx * intervalSeconds) / windowSpanSeconds;
    const stride = Math.max(1, Math.ceil(TICK_LABEL_SLOT_PX / fullDensitySpacingPx));
    return ticks.filter((_, index) => index % stride === 0);
  }

  private updateSparseChart(series: MetricSeriesPoint[]): void {
    const windowStart = this.windowStartInput();
    const windowEnd = this.windowEndInput();
    const tickBuckets = this.buildTickBuckets(windowStart, windowEnd);

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
