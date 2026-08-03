import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { FoodStatsInsightsService, FoodStatsTopProductShare } from '@app/services/food/food-stats-insights.service';
import { VCard } from '@ui-kit/components/v-card/v-card';

@Component({
  selector: 'food-stats-top-products',
  templateUrl: './top-products.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopProducts {
  private readonly insightsService = inject(FoodStatsInsightsService);

  protected readonly products$$: Signal<FoodStatsTopProductShare[]> = this.insightsService.topProductsWithShare$$;

  // Bar width is relative to the top product's kcal (not an absolute % of the day) — the list is
  // already sorted descending by kcal, so products()[0] is the max.
  protected barWidthPercent(product: FoodStatsTopProductShare): number {
    const products = this.products$$();
    const maxKcal = products.length > 0 ? products[0].kcal : 0;
    if (maxKcal <= 0) return 0;
    return Math.round((product.kcal / maxKcal) * 100);
  }
}
