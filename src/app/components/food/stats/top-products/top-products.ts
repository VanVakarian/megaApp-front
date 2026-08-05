import { ChangeDetectionStrategy, Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { StatsHelpIcon } from '@app/components/food/stats/stats-help-icon/stats-help-icon';
import { FoodStatsInsightsService, FoodStatsTopProductShare } from '@app/services/food/food-stats-insights.service';
import { LocalStorageService } from '@app/services/local-storage.service';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';

export const TopProductsMetric = {
  Kcal: 'kcal',
  Weight: 'weight',
} as const;
export type TopProductsMetric = (typeof TopProductsMetric)[keyof typeof TopProductsMetric];

const METRIC_STORAGE_KEY = 'food-stats-top-products-metric';

@Component({
  selector: 'food-stats-top-products',
  templateUrl: './top-products.html',
  imports: [VCard, StatsHelpIcon, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopProducts {
  private readonly insightsService = inject(FoodStatsInsightsService);
  private readonly localStorageService = inject(LocalStorageService);

  protected readonly metricToggleItems: VToggleItem[] = [
    { id: TopProductsMetric.Kcal, label: 'По калориям' },
    { id: TopProductsMetric.Weight, label: 'По весу' },
  ];

  protected readonly metric$$: WritableSignal<TopProductsMetric> = signal(this.loadMetric());

  protected readonly products$$: Signal<FoodStatsTopProductShare[]> = computed(() =>
    this.metric$$() === TopProductsMetric.Kcal
      ? this.insightsService.topProductsByKcalWithShare$$()
      : this.insightsService.topProductsByWeightWithShare$$(),
  );

  protected metricToggleValue(): string[] {
    return [this.metric$$()];
  }

  protected onMetricToggleChange(value: string[]): void {
    const metric = value[0] === TopProductsMetric.Weight ? TopProductsMetric.Weight : TopProductsMetric.Kcal;
    this.metric$$.set(metric);
    this.localStorageService.setUserScoped(METRIC_STORAGE_KEY, metric);
  }

  private loadMetric(): TopProductsMetric {
    const stored = this.localStorageService.getUserScoped<TopProductsMetric>(METRIC_STORAGE_KEY);
    return stored === TopProductsMetric.Weight ? TopProductsMetric.Weight : TopProductsMetric.Kcal;
  }

  // Bar width is relative to the top product's value for the active metric (not an absolute % of
  // the day) — the list is already sorted descending by that metric, so products()[0] is the max.
  protected barWidthPercent(product: FoodStatsTopProductShare): number {
    const products = this.products$$();
    const maxValue = products.length > 0 ? this.metricValue(products[0]) : 0;
    if (maxValue <= 0) return 0;
    return Math.round((this.metricValue(product) / maxValue) * 100);
  }

  private metricValue(product: FoodStatsTopProductShare): number {
    return this.metric$$() === TopProductsMetric.Kcal ? product.kcal : product.weight;
  }
}
