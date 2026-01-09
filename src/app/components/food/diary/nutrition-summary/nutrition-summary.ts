import { Component, computed, inject } from '@angular/core';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { DayTotals } from '@app/shared/interfaces';
import { ProgressBarStyle, VProgress, VProgressConfig } from '@app/shared/ui-kit/components/v-progress/v-progress';

export enum NutrientType {
  Protein = 'protein',
  Fat = 'fat',
  Carbs = 'carbs',
  Fiber = 'fiber',
}

@Component({
  selector: 'nutrition-summary',
  templateUrl: './nutrition-summary.html',
  imports: [VProgress],
})
export class NutritionSummary {
  private readonly foodDiaryService = inject(FoodDiaryService);

  protected readonly NutrientType = NutrientType;

  protected readonly totals$$ = computed(() => this.foodDiaryService.selectedDayTotals$$());

  private readonly NUTRIENT_KEYS: Record<NutrientType, { consumed: keyof DayTotals; target: keyof DayTotals }> = {
    [NutrientType.Protein]: { consumed: 'consumedProtein', target: 'targetProtein' },
    [NutrientType.Fat]: { consumed: 'consumedFat', target: 'targetFat' },
    [NutrientType.Carbs]: { consumed: 'consumedCarbs', target: 'targetCarbs' },
    [NutrientType.Fiber]: { consumed: 'consumedFiber', target: 'targetFiber' },
  };

  protected readonly proteinBarConfig$$ = computed(() => this.calculateBarConfig(NutrientType.Protein));
  protected readonly fatBarConfig$$ = computed(() => this.calculateBarConfig(NutrientType.Fat));
  protected readonly carbsBarConfig$$ = computed(() => this.calculateBarConfig(NutrientType.Carbs));
  protected readonly fiberBarConfig$$ = computed(() => this.calculateBarConfig(NutrientType.Fiber));

  protected readonly proteinPercentFormatted$$ = computed(() => this.calculatePercentFormatted(NutrientType.Protein));
  protected readonly fatPercentFormatted$$ = computed(() => this.calculatePercentFormatted(NutrientType.Fat));
  protected readonly carbsPercentFormatted$$ = computed(() => this.calculatePercentFormatted(NutrientType.Carbs));
  protected readonly fiberPercentFormatted$$ = computed(() => this.calculatePercentFormatted(NutrientType.Fiber));

  private calculateBarConfig(nutrient: NutrientType): VProgressConfig {
    const totals = this.totals$$();
    const { consumed: consumedKey, target: targetKey } = this.NUTRIENT_KEYS[nutrient];

    const consumed = totals[consumedKey] as number;
    const target = totals[targetKey] as number;

    const percent = target > 0 ? (consumed / target) * 100 : 0;

    return {
      barGap: 1,
      value: percent,
      barStyle: ProgressBarStyle.Raised,
      barColor: this.calculateBarColor(percent),
    };
  }

  /**
   * Calculates the progress bar color based on nutrient percentage.
   * - 0-100%: Transitions from low (blue) to target (green)
   * - 100%+: Transitions from target (green) to high (red), capped at 200%
   */
  private calculateBarColor(percent: number): string {
    if (percent <= 100) {
      return `color-mix(in srgb, var(--color-nutrient-target) ${percent}%, var(--color-nutrient-low))`;
    } else {
      const redPercent = Math.min(percent - 100, 100);
      return `color-mix(in srgb, var(--color-nutrient-high) ${redPercent}%, var(--color-nutrient-target))`;
    }
  }

  private calculatePercentFormatted(nutrient: NutrientType): string {
    const totals = this.totals$$();
    const { consumed: consumedKey, target: targetKey } = this.NUTRIENT_KEYS[nutrient];

    const consumed = totals[consumedKey] as number;
    const target = totals[targetKey] as number;

    if (target === 0) return '0%';

    const percent = Math.round((consumed / target) * 100);
    return `${percent}%`;
  }
}
