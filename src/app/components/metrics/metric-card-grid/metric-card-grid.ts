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
} from '@angular/core';
import { DeviceInfoService } from '@app/services/device-info.service';
import { MetricUnit } from '@app/shared/metric-units';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { MetricSeriesPoint } from '@app/shared/metrics-series';
import { MetricGranularity } from '@app/shared/types';
import { MetricChartCard } from '../metric-chart-card/metric-chart-card';

export interface MetricChartCardSeriesDisplay {
  series: MetricSeriesPoint[];
  windowStartBucket: number;
  windowEndBucket: number;
  displayStepSeconds: number;
}

export interface MetricChartCardData {
  key: string;
  label: string;
  technicalName: string;
  value: number;
  displayValue: string;
  unit: MetricUnit;
  granularity: MetricGranularity;
  color: string;
  chartMode: MetricChartMode;
  description: string;
  // Two independently-computed series: the normal card width may fall below the
  // minute-collapse threshold while the expanded (Large) width sits above it, or
  // vice versa — each display size gets the series that matches its own width.
  display: MetricChartCardSeriesDisplay;
  expandedDisplay: MetricChartCardSeriesDisplay;
  isDashboardEnabled: boolean;
  dashboardOrder: number;
}

interface RenderItem {
  card: MetricChartCardData;
  isExpanded: boolean;
}

@Component({
  selector: 'metric-card-grid',
  templateUrl: './metric-card-grid.html',
  imports: [MetricChartCard],
  host: {
    class: 'flex flex-wrap gap-3',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCardGrid implements OnInit, OnDestroy {
  public readonly cardsInput = input.required<MetricChartCardData[]>();
  public readonly cardWidthPxInput = input.required<number>();
  public readonly cardHeightPxInput = input.required<number>();
  public readonly expandedWidthPxInput = input.required<number>();
  public readonly expandedHeightPxInput = input.required<number>();
  public readonly syncCrosshairEnabledInput = input<boolean>(false);
  public readonly forceZeroBaselineInput = input<boolean>(false);
  public readonly isEditModeInput = input<boolean>(false);
  public readonly hideDashboardControlsInput = input<boolean>(false);
  public readonly isSelectionDisabledInput = input<boolean>(false);

  public readonly cardDashboardEnabledChangeOutput = output<{ technicalName: string; enabled: boolean }>();
  public readonly cardDashboardOrderChangeOutput = output<{ technicalName: string; order: number }>();

  private readonly deviceInfoService = inject(DeviceInfoService);
  private readonly hostElement: HTMLElement;
  private readonly expandedKey$$ = signal<string | null>(null);
  private readonly containerWidthPx$$ = signal(0);
  private readonly gapPx$$ = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  // Expanding only means something when the expanded size actually differs from
  // the normal one — e.g. when every card is already shown at Large size (the
  // global "expanded" mode), a card and its "expanded" copy would be identical,
  // so the whole interaction turns itself off instead of taking an external flag.
  protected readonly canExpand$$ = computed(
    () =>
      this.deviceInfoService.isDesktopScreen$$() &&
      (this.cardWidthPxInput() !== this.expandedWidthPxInput() ||
        this.cardHeightPxInput() !== this.expandedHeightPxInput()),
  );

  // The single source of truth for "which card is highlighted/expanded right
  // now" — null whenever expanding isn't possible, so callers never need to
  // re-check canExpand$$ themselves.
  protected readonly selectedKey$$ = computed(() => (this.canExpand$$() ? this.expandedKey$$() : null));

  private readonly resetExpandedOnDisableEffect = effect(() => {
    if (this.canExpand$$()) return;
    this.expandedKey$$.set(null);
  });

  // How many cards fit on one visual row, derived purely from measured container
  // width and the fixed per-card width — no DOM position reads needed since every
  // card in a row shares the same width.
  private readonly cardsPerRow$$ = computed(() => {
    const cardWidth = this.cardWidthPxInput();
    const containerWidth = this.containerWidthPx$$();
    const gap = this.gapPx$$();
    if (cardWidth <= 0 || containerWidth <= 0) return 1;
    return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
  });

  // Inserts the expanded card right after the last card of the row that contains
  // it, so it always lands as a new row directly under the clicked card's row,
  // regardless of how many cards fit per row at the current width.
  protected readonly renderItems$$ = computed<RenderItem[]>(() => {
    const cards = this.cardsInput();
    const items: RenderItem[] = cards.map((card) => ({ card, isExpanded: false }));

    const expandedKey = this.selectedKey$$();
    const expandedIndex = expandedKey === null ? -1 : cards.findIndex((card) => card.key === expandedKey);
    if (expandedIndex === -1) return items;

    const perRow = this.cardsPerRow$$();
    const rowIndex = Math.floor(expandedIndex / perRow);
    const insertAt = Math.min((rowIndex + 1) * perRow, cards.length);
    items.splice(insertAt, 0, { card: cards[expandedIndex], isExpanded: true });
    return items;
  });

  public constructor(elementRef: ElementRef<HTMLElement>) {
    this.hostElement = elementRef.nativeElement;
  }

  public ngOnInit(): void {
    this.gapPx$$.set(parseFloat(getComputedStyle(this.hostElement).columnGap) || 0);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.containerWidthPx$$.set(entry.contentRect.width);
    });
    this.resizeObserver.observe(this.hostElement);
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  protected trackRenderItem(item: RenderItem): string {
    return item.isExpanded ? `expanded:${item.card.key}` : item.card.key;
  }

  protected onCardToggle(key: string): void {
    if (!this.canExpand$$()) return;
    this.expandedKey$$.update((current) => (current === key ? null : key));
  }

  protected onCardDashboardEnabledChange(technicalName: string, enabled: boolean): void {
    this.cardDashboardEnabledChangeOutput.emit({ technicalName, enabled });
  }

  protected onCardDashboardOrderChange(technicalName: string, order: number): void {
    this.cardDashboardOrderChangeOutput.emit({ technicalName, order });
  }
}
