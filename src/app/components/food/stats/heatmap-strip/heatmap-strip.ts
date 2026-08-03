import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { FoodStatsInsightsService, FoodStatsRibbonDay } from '@app/services/food/food-stats-insights.service';
import { FOOD_DAY_BAND_COLOR_VAR, FOOD_DAY_BAND_LABEL } from '@app/shared/food-day-band';
import { formatDateTicks } from '@app/shared/utils';
import { VCard } from '@ui-kit/components/v-card/v-card';

@Component({
  selector: 'food-stats-heatmap-strip',
  templateUrl: './heatmap-strip.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapStrip {
  private readonly insightsService = inject(FoodStatsInsightsService);

  protected readonly days$$: Signal<FoodStatsRibbonDay[]> = this.insightsService.ribbon30$$;

  protected cellColor(day: FoodStatsRibbonDay): string {
    return FOOD_DAY_BAND_COLOR_VAR[day.band];
  }

  protected cellTitle(day: FoodStatsRibbonDay): string {
    return `${formatDateTicks(day.dateIso)} — ${FOOD_DAY_BAND_LABEL[day.band]}`;
  }
}
