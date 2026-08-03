import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FOOD_STATS_BLOCK_ORDER, FoodStatsBlock } from '@app/components/food/stats/food-stats-block';
import { FoodStatsCharts } from '@app/components/food/stats/food-stats-charts/food-stats-charts';
import { HeatmapStrip } from '@app/components/food/stats/heatmap-strip/heatmap-strip';
import { Milestones } from '@app/components/food/stats/milestones/milestones';
import { Streak } from '@app/components/food/stats/streak/streak';
import { TopProducts } from '@app/components/food/stats/top-products/top-products';

@Component({
  selector: 'food-stats-columns',
  templateUrl: './food-stats-columns.html',
  imports: [HeatmapStrip, Streak, TopProducts, Milestones, FoodStatsCharts],
  host: {
    class: 'flex gap-3',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodStatsColumns {
  public readonly columnCountInput = input.required<number>();

  protected readonly Block = FoodStatsBlock;

  // Round-robin: block i goes to column i % columnCount, spreading the fixed blocks as evenly as possible.
  // No block ever spans more than one column.
  protected readonly columns$$ = computed<FoodStatsBlock[][]>(() => {
    const columnCount = this.columnCountInput();
    const columns: FoodStatsBlock[][] = Array.from({ length: columnCount }, () => []);
    FOOD_STATS_BLOCK_ORDER.forEach((block, index) => columns[index % columnCount].push(block));
    return columns;
  });
}
