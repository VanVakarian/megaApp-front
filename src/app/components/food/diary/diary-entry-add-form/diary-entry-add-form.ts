import { AfterViewInit, Component, computed, effect, inject, signal, viewChild, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodPersonalKcalsService } from '@app/services/food/food-personal-kcals.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { DiaryEntry, HistoryEntryAction } from '@app/shared/types';
import { projectDaysConsumedPercent } from '@app/shared/utils';
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

  // Base data from the server — legitimately refreshed by any background reload, in-progress
  // draft below is never touched by it, only by the user's own input.
  private readonly selectedDaysTargetKcals$$: WritableSignal<number> = signal(0);
  private readonly selectedDaysConsumedPercent$$: WritableSignal<number> = signal(0);
  private readonly selectedFoodPersonalKcalsPer100g$$: WritableSignal<number> = signal(0);

  // The user's in-progress, unsubmitted draft — set only from onFoodWeightInput.
  private readonly draftFoodWeight$$: WritableSignal<number> = signal(0);

  protected readonly projectedSelectedDaysConsumedPercentNum$$ = computed(() =>
    projectDaysConsumedPercent(
      this.draftFoodWeight$$(),
      this.selectedFoodPersonalKcalsPer100g$$(),
      this.selectedDaysTargetKcals$$(),
      this.selectedDaysConsumedPercent$$(),
    ),
  );
  protected readonly projectedSelectedDaysConsumedPercentPadded$$ = computed(() =>
    this.projectedSelectedDaysConsumedPercentNum$$().toFixed(1),
  );

  protected readonly foodWeightInput = viewChild.required(VInput);

  protected readonly foodCatalogueService = inject(FoodCatalogueService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodPersonalKcalsService = inject(FoodPersonalKcalsService);
  private readonly foodStatsService = inject(FoodStatsService);

  private readonly selectedDayTotalsEffect$$ = effect(() => {
    const totals = this.foodDiaryService.selectedDayTotals$$();
    this.selectedDaysTargetKcals$$.set(totals.targetKcals);
    this.selectedDaysConsumedPercent$$.set(totals.kcalsPercent);
  });

  private readonly selectedProductEffect$$ = effect(() => {
    const product = this.foodAddModalService.selectedProduct$$();
    if (!product) return;

    this.selectedFoodPersonalKcalsPer100g$$.set(
      this.foodPersonalKcalsService.personalKcals$$()?.[product.id] ?? product.kcals,
    );
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
    this.draftFoodWeight$$.set(Number(this.foodWeightControl.value) || 0);
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
