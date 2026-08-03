import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { FoodStatsInsightsService, FoodStatsStreak } from '@app/services/food/food-stats-insights.service';
import { getRuDeclension } from '@app/shared/utils';
import { VCard } from '@ui-kit/components/v-card/v-card';

@Component({
  selector: 'food-stats-streak',
  templateUrl: './streak.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Streak {
  private readonly insightsService = inject(FoodStatsInsightsService);

  protected readonly streak$$: Signal<FoodStatsStreak> = this.insightsService.streak$$;

  protected daysLabel(days: number): string {
    return getRuDeclension(days, 'день', 'дня', 'дней');
  }
}
