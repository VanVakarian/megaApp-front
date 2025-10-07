import { AfterViewInit, Component, effect, inject, input, output, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodCoefficientsService } from '@app/services/food/food-coefficients.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { CatalogueEntry, DiaryEntry, HistoryEntryAction } from '@app/shared/interfaces';
import { UiProgressIcon } from '@app/shared/ui-kit/progress-icon/progress-icon.component';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';

@Component({
  selector: 'diary-entry-add-form',
  templateUrl: './diary-entry-add-form.component.html',
  imports: [ReactiveFormsModule, UiProgressIcon, VButton, VIcon, VInput],
})
export class DiaryEntryAddFormComponent implements AfterViewInit {
  public readonly selectedProduct = input.required<CatalogueEntry>();

  public readonly onGoBack = output<void>();

  public readonly onSubmit = output<void>();

  protected readonly Icon = IconName;

  private selectedDaysTargerKcals = 0;
  private selectedDaysEatenPercent = 0;
  private selectedFoodKcals = 0;
  private diaryEntriesCoefficient = 1;
  protected projectedSelectedDaysEatenPercentNum = 0;
  protected projectedSelectedDaysEatenPercentPadded = '0';

  protected readonly foodWeightInput = viewChild.required(VInput);

  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodCoefficientsService = inject(FoodCoefficientsService);
  private readonly foodStatsService = inject(FoodStatsService);

  private readonly selectedDayTotalsEffect = effect(() => {
    const totals = this.foodDiaryService.selectedDayTotals$$();
    this.selectedDaysTargerKcals = totals.targetKcals;
    this.selectedDaysEatenPercent = totals.kcalsPercent;
    this.updateProjectedDaysEatenPercent(0);
  });

  private readonly selectedProductEffect = effect(() => {
    const product = this.selectedProduct();
    this.selectedFoodKcals = product.kcals;
    this.diaryEntriesCoefficient = this.foodCoefficientsService.coefficients$$()?.[product.id] ?? 1;
    this.updateProjectedDaysEatenPercent(this.foodWeightControl.value || 0);
  });

  protected diaryEntryForm: FormGroup = new FormGroup({
    foodWeight: new FormControl<number | null>(null, [Validators.required, Validators.pattern(/^\d+$/)]),
  });

  protected get foodWeightControl() {
    return this.diaryEntryForm.get('foodWeight') as FormControl<number | null>;
  }

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this.foodWeightInput().focus();
    }, 100);
  }

  protected isFormValid(): boolean {
    return this.diaryEntryForm.valid;
  }

  protected onFoodWeightInput(): void {
    const weightValue = this.foodWeightControl.value || 0;
    this.updateProjectedDaysEatenPercent(weightValue);
  }

  private updateProjectedDaysEatenPercent(weightValue: number): void {
    if (!this.selectedFoodKcals) {
      this.projectedSelectedDaysEatenPercentNum = this.selectedDaysEatenPercent;
      this.projectedSelectedDaysEatenPercentPadded = this.selectedDaysEatenPercent.toFixed(1);
      return;
    }

    if (this.selectedDaysTargerKcals) {
      const weightKcalsPerHundredGrams = this.selectedFoodKcals;
      const weightKcalsTotal = (weightValue / 100) * weightKcalsPerHundredGrams;
      const weightKcalsWithCoefficient = weightKcalsTotal * this.diaryEntriesCoefficient;

      const deltaInPercent = (weightKcalsWithCoefficient / this.selectedDaysTargerKcals) * 100;
      const totalPercent = this.selectedDaysEatenPercent + deltaInPercent;

      this.projectedSelectedDaysEatenPercentNum = totalPercent;
      this.projectedSelectedDaysEatenPercentPadded = totalPercent.toFixed(1);
    }
  }

  protected async submitForm(): Promise<void> {
    if (!this.diaryEntryForm.valid) return;

    this.diaryEntryForm.disable();
    const { foodWeight } = this.diaryEntryForm.value;
    const product = this.selectedProduct();

    const entry: DiaryEntry = {
      id: 0,
      dateISO: this.foodDiaryService.selectedDayIso$$(),
      foodCatalogueId: product.id,
      foodWeight: foodWeight || 0,
      history: [{ action: HistoryEntryAction.INIT, value: foodWeight || 0 }],
    };

    const response = await this.foodDiaryService.createDiaryEntry(entry);

    if (response?.result) {
      if (response.diaryId) {
        this.onSubmit.emit();
      }
    }

    this.diaryEntryForm.enable();
  }

  protected goBack(): void {
    this.onGoBack.emit();
  }
}
