import { AfterViewInit, Component, effect, inject, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodCoefficientsService } from '@app/services/food/food-coefficients.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { DiaryEntry, HistoryEntryAction } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/components/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/components/v-input/v-input';
import { UiProgressIcon } from '@app/shared/ui-kit/progress-icon/progress-icon.component';

@Component({
  selector: 'diary-entry-add-form',
  templateUrl: './diary-entry-add-form.html',
  styleUrl: './diary-entry-add-form.scss',
  imports: [ReactiveFormsModule, UiProgressIcon, VButton, VIcon, VInput],
})
export class DiaryEntryAddForm implements AfterViewInit {
  protected readonly Icon = IconName;

  private selectedDaysTargerKcals = 0;
  private selectedDaysConsumedPercent = 0;
  private selectedFoodKcals = 0;
  private diaryEntriesCoefficient = 1;
  protected projectedSelectedDaysConsumedPercentNum = 0;
  protected projectedSelectedDaysConsumedPercentPadded = '0';

  protected readonly foodWeightInput = viewChild.required(VInput);

  protected readonly foodCatalogueService = inject(FoodCatalogueService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodCoefficientsService = inject(FoodCoefficientsService);
  private readonly foodStatsService = inject(FoodStatsService);

  private readonly selectedDayTotalsEffect$$ = effect(() => {
    const totals = this.foodDiaryService.selectedDayTotals$$();
    this.selectedDaysTargerKcals = totals.targetKcals;
    this.selectedDaysConsumedPercent = totals.kcalsPercent;
    this.updateProjectedDaysConsumedPercent(0);
  });

  private readonly selectedProductEffect$$ = effect(() => {
    const product = this.foodAddModalService.selectedProduct$$();
    if (!product) return;

    this.selectedFoodKcals = product.kcals;
    this.diaryEntriesCoefficient = this.foodCoefficientsService.coefficients$$()?.[product.id] ?? 1;
    this.updateProjectedDaysConsumedPercent(this.foodWeightControl.value || 0);
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
    const weightValue = Number(this.foodWeightControl.value) || 0;
    this.updateProjectedDaysConsumedPercent(weightValue);
  }

  private updateProjectedDaysConsumedPercent(weightValue: number): void {
    if (!this.selectedFoodKcals) {
      this.projectedSelectedDaysConsumedPercentNum = this.selectedDaysConsumedPercent;
      this.projectedSelectedDaysConsumedPercentPadded = this.selectedDaysConsumedPercent.toFixed(1);
      return;
    }

    if (this.selectedDaysTargerKcals) {
      const weightKcalsPerHundredGrams = this.selectedFoodKcals;
      const weightKcalsTotal = (weightValue / 100) * weightKcalsPerHundredGrams;
      const weightKcalsWithCoefficient = weightKcalsTotal * this.diaryEntriesCoefficient;

      const deltaInPercent = (weightKcalsWithCoefficient / this.selectedDaysTargerKcals) * 100;
      const totalPercent = this.selectedDaysConsumedPercent + deltaInPercent;

      this.projectedSelectedDaysConsumedPercentNum = totalPercent;
      this.projectedSelectedDaysConsumedPercentPadded = totalPercent.toFixed(1);
    }
  }

  protected async submitForm(): Promise<void> {
    if (!this.diaryEntryForm.valid) return;

    this.diaryEntryForm.disable();
    const { foodWeight } = this.diaryEntryForm.value;
    const product = this.foodAddModalService.selectedProduct$$();
    if (!product) return;

    const entry: DiaryEntry = {
      id: 0,
      dateISO: this.foodDiaryService.selectedDayIso$$(),
      foodCatalogueId: product.id,
      foodWeight: Number(foodWeight) || 0,
      history: [{ action: HistoryEntryAction.INIT, value: Number(foodWeight) || 0 }],
    };

    const response = await this.foodDiaryService.createDiaryEntry(entry);

    if (response?.result && response.diaryId) {
      this.foodAddModalService.submitSuccess();
    }

    this.diaryEntryForm.enable();
  }

  protected goBack(): void {
    this.foodAddModalService.goBackToSearch();
  }

  protected editProduct(): void {
    const product = this.foodAddModalService.selectedProduct$$();
    if (!product) return;

    this.foodAddModalService.editProduct(product);
  }
}
