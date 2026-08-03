import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { FoodDiary } from '@app/components/food/diary/food-diary';
import { FoodStatsAccordion } from '@app/components/food/stats/food-stats-accordion/food-stats-accordion';
import { FoodStatsColumns } from '@app/components/food/stats/food-stats-columns/food-stats-columns';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { VButton } from '@ui-kit/components/v-button/v-button';

// Safety bound against pathological inputs — mirrors metric-card-grid's column-fit algorithm.
const MAX_COLUMN_SEARCH = 64;
// Same target width as the diary/stats columns already use elsewhere on this screen.
const TARGET_COLUMN_WIDTH_PX = 394;
const COLUMN_GAP_PX = 8;

const FoodScreenMobileTab = {
  Stats: 'stats',
  Diary: 'diary',
} as const;

type FoodScreenMobileTab = (typeof FoodScreenMobileTab)[keyof typeof FoodScreenMobileTab];

@Component({
  selector: 'food-screen',
  templateUrl: './food-screen.html',
  imports: [FoodDiary, FoodStatsAccordion, FoodStatsColumns, VButton],
  host: {
    class: 'mx-auto mt-2 flex w-full max-w-[1198px] items-stretch justify-center gap-2',
    '[class.flex-row]': 'totalColumnCount$$() >= 2',
    '[class.flex-col]': 'totalColumnCount$$() === 1',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodScreen implements OnInit, OnDestroy {
  private readonly hostElement: HTMLElement;
  private readonly containerWidthPx$$: WritableSignal<number> = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  private readonly foodDiaryService = inject(FoodDiaryService);

  // Total columns on screen, diary included — 1 means only the diary fits (stats go into the
  // accordion below it), 2+ means diary plus (totalColumnCount - 1) stats columns beside it.
  // Same fit-N-columns-to-target-width algorithm as metric-card-grid's columnCount$$.
  protected readonly totalColumnCount$$: Signal<number> = computed(() => {
    const containerWidth = this.containerWidthPx$$();
    if (containerWidth <= 0) return 1;

    const fittedWidth = (columns: number) => (containerWidth - COLUMN_GAP_PX * (columns - 1)) / columns;
    let bestColumns = 1;
    let bestDelta = Math.abs(fittedWidth(1) - TARGET_COLUMN_WIDTH_PX);
    for (let columns = 2; columns <= MAX_COLUMN_SEARCH; columns++) {
      const width = fittedWidth(columns);
      if (width <= 0) break;
      const delta = Math.abs(width - TARGET_COLUMN_WIDTH_PX);
      if (delta >= bestDelta) break;
      bestColumns = columns;
      bestDelta = delta;
    }
    return bestColumns;
  });

  protected readonly statsColumnCount$$: Signal<number> = computed(() => this.totalColumnCount$$() - 1);

  protected readonly MobileTab = FoodScreenMobileTab;
  protected readonly mobileTab$$: WritableSignal<FoodScreenMobileTab> = signal(FoodScreenMobileTab.Diary);

  public constructor(elementRef: ElementRef<HTMLElement>) {
    this.hostElement = elementRef.nativeElement;
  }

  public ngOnInit(): void {
    this.foodDiaryService.loadAllFoodData();

    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.containerWidthPx$$.set(entry.contentRect.width);
    });
    this.resizeObserver.observe(this.hostElement);
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  protected selectMobileTab(tab: FoodScreenMobileTab): void {
    this.mobileTab$$.set(tab);
  }
}
