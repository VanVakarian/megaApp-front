import { AfterViewInit, Component, effect, inject, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodPersonalKcalsService } from '@app/services/food/food-personal-kcals.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { DiaryEntry, HistoryEntryAction } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { UiProgressIcon } from '@ui-kit/progress-icon/progress-icon.component';

@Component({
  selector: 'diary-entry-add-form',
  templateUrl: './diary-entry-add-form.html',
  imports: [ReactiveFormsModule, UiProgressIcon, VButton, VIcon, VInput],
})
export class DiaryEntryAddForm implements AfterViewInit {
  protected readonly Icon = IconName;

  private selectedDaysTargerKcals = 0;
  private selectedDaysConsumedPercent = 0;
  private selectedFoodPersonalKcalsPer100g = 0;
  protected projectedSelectedDaysConsumedPercentNum = 0;
  protected projectedSelectedDaysConsumedPercentPadded = '0';

  protected readonly foodWeightInput = viewChild.required(VInput);

  protected readonly foodCatalogueService = inject(FoodCatalogueService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodPersonalKcalsService = inject(FoodPersonalKcalsService);
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

    this.selectedFoodPersonalKcalsPer100g =
      this.foodPersonalKcalsService.personalKcals$$()?.[product.id] ?? product.kcals;
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
    if (!this.selectedFoodPersonalKcalsPer100g) {
      this.projectedSelectedDaysConsumedPercentNum = this.selectedDaysConsumedPercent;
      this.projectedSelectedDaysConsumedPercentPadded = this.selectedDaysConsumedPercent.toFixed(1);
      return;
    }

    if (this.selectedDaysTargerKcals) {
      const weightKcalsTotal = (weightValue / 100) * this.selectedFoodPersonalKcalsPer100g;

      const deltaInPercent = (weightKcalsTotal / this.selectedDaysTargerKcals) * 100;
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
      kcals: 0,
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
