import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { FoodStatsInsightsService, FoodStatsMilestones } from '@app/services/food/food-stats-insights.service';
import { formatDateTicks, getRuDeclension } from '@app/shared/utils';
import { VCard } from '@ui-kit/components/v-card/v-card';

@Component({
  selector: 'food-stats-milestones',
  templateUrl: './milestones.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Milestones {
  private readonly insightsService = inject(FoodStatsInsightsService);

  protected readonly milestones$$: Signal<FoodStatsMilestones> = this.insightsService.milestones$$;

  protected formatDate(dateIso: string): string {
    return formatDateTicks(dateIso);
  }

  protected daysLabel(days: number): string {
    return getRuDeclension(days, 'день', 'дня', 'дней');
  }

  protected entriesLabel(count: number): string {
    return getRuDeclension(count, 'запись', 'записи', 'записей');
  }

  protected deltaColor(deltaKg: number): string {
    return deltaKg <= 0 ? 'var(--v-color-success)' : 'var(--v-color-danger)';
  }
}
