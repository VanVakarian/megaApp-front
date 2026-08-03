import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
    class: 'grid gap-3',
    '[style.grid-template-columns]': 'gridTemplateColumns$$()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodStatsColumns {
  public readonly columnCountInput = input.required<number>();

  protected readonly gridTemplateColumns$$ = computed(() => `repeat(${this.columnCountInput()}, minmax(0, 1fr))`);
}
