import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { FoodDiary } from '@app/components/food/diary/food-diary';
import { FoodModeToggleFab } from '@app/components/food/food-mode-toggle-fab/food-mode-toggle-fab';
import { FoodStatsAccordion } from '@app/components/food/stats/food-stats-accordion/food-stats-accordion';
import { FoodStatsColumns } from '@app/components/food/stats/food-stats-columns/food-stats-columns';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodScreenMobileTab, FoodScreenModeService } from '@app/services/food/food-screen-mode.service';

// Safety bound against pathological inputs — mirrors metric-card-grid's column-fit algorithm.
const MAX_COLUMN_SEARCH = 64;
const TARGET_COLUMN_WIDTH_PX = 400;
const COLUMN_GAP_PX = 8;

@Component({
  selector: 'food-screen',
  templateUrl: './food-screen.html',
  imports: [FoodDiary, FoodStatsAccordion, FoodStatsColumns, FoodModeToggleFab],
  providers: [FoodScreenModeService],
  host: {
    class: 'mt-2 px-2 w-full items-stretch gap-3',
    '[class.flex]': 'totalColumnCount$$() === 1',
    '[class.flex-col]': 'totalColumnCount$$() === 1',
    '[class.grid]': 'totalColumnCount$$() >= 2',
    '[style.grid-template-columns]': 'gridTemplateColumns$$()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodScreen implements OnInit, OnDestroy {
  private readonly hostElement: HTMLElement;
  private readonly containerWidthPx$$: WritableSignal<number> = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  private readonly foodDiaryService = inject(FoodDiaryService);
  protected readonly foodScreenModeService = inject(FoodScreenModeService);
  protected readonly Tab = FoodScreenMobileTab;

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

  // Diary sits in the 2nd grid column once there's room for it plus stats on both sides (3+ total
  // columns); with only 2 columns there's no room left of the diary, so it stays first.
  protected readonly diaryColumnIndex$$: Signal<number> = computed(() => (this.totalColumnCount$$() >= 3 ? 2 : 1));

  // Grid column (1-based) for each of the statsColumnCount stats columns, in order — every grid
  // column except the diary's.
  protected readonly statsGridColumns$$: Signal<number[]> = computed(() => {
    const total = this.totalColumnCount$$();
    const diaryColumn = this.diaryColumnIndex$$();
    const columns: number[] = [];
    for (let column = 1; column <= total; column++) {
      if (column !== diaryColumn) columns.push(column);
    }
    return columns;
  });

  // Columns sized as equal fractions of the container, so each lands close to TARGET_COLUMN_WIDTH_PX
  // without ever being pinned to a fixed pixel width.
  protected readonly gridTemplateColumns$$: Signal<string> = computed(
    () => `repeat(${this.totalColumnCount$$()}, minmax(0, 1fr))`,
  );

  public constructor(elementRef: ElementRef<HTMLElement>) {
    this.hostElement = elementRef.nativeElement;

    effect(() => this.foodScreenModeService.isSingleColumnLayout$$.set(this.totalColumnCount$$() === 1));
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
}
