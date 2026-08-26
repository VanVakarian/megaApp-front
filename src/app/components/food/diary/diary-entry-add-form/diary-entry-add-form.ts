import { AfterViewInit, Component, computed, inject, OnDestroy, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
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
export class DiaryEntryAddForm implements AfterViewInit, OnDestroy {
  protected readonly Icon = IconName;

  // Mirrors the day's kcal-percent counter shown everywhere else (top bar, nutrition-summary) —
  // draft-aware via FoodDiaryService.setDraftEntryWeight, so this and the top bar are always the
  // same number, and it's already the exact figure the server will confirm on save.
  protected readonly projectedSelectedDaysConsumedPercentNum$$ = computed(
    () => this.foodDiaryService.selectedDayTotals$$().kcalsPercent,
  );
  protected readonly projectedSelectedDaysConsumedPercentPadded$$ = computed(() =>
    this.projectedSelectedDaysConsumedPercentNum$$().toFixed(1),
  );

  protected readonly foodWeightInput = viewChild.required(VInput);

  protected readonly foodCatalogueService = inject(FoodCatalogueService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodStatsService = inject(FoodStatsService);

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

  public ngOnDestroy(): void {
    this.foodDiaryService.clearDraftEntryWeight(null);
  }

  protected isFormValid(): boolean {
    return this.diaryEntryForm.valid;
  }

  protected onFoodWeightInput(): void {
    const weight = Number(this.foodWeightControl.value) || 0;
    const product = this.foodAddModalService.selectedProduct$$();
    if (product && weight > 0) {
      this.foodDiaryService.setDraftEntryWeight(this.foodDiaryService.selectedDayIso$$(), null, product.id, weight);
    } else {
      this.foodDiaryService.clearDraftEntryWeight(null);
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
    this.foodDiaryService.clearDraftEntryWeight(null);

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
