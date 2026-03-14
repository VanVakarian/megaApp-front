import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { BodyWeightInterface } from '@app/shared/types';
import { VInput, VInputAutoSubmitResult } from '@ui-kit/components/v-input/v-input';

interface BodyWeightForm {
  bodyWeight: FormControl<string | null>;
}

enum FormLabels {
  WEIGHT = 'Вес',
  WEIGHT_UNIT = 'кг',
}

enum FormErrors {
  WEIGHT = 'ХХ.Х или ХХ',
}

@Component({
  selector: 'body-weight',
  templateUrl: './body-weight.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, VInput],
})
export class BodyWeight {
  protected readonly bodyWeightInput = viewChild.required(VInput);

  protected readonly FormLabels = FormLabels;
  protected readonly FormErrors = FormErrors;

  protected form = new FormGroup<BodyWeightForm>({
    bodyWeight: new FormControl('', {
      validators: [Validators.required, Validators.pattern(/^\d{2,3}([.,]\d)?$/)],
    }),
  });

  protected readonly autoSubmitResult$$ = signal<VInputAutoSubmitResult | null>(null);

  private readonly foodDiaryService = inject(FoodDiaryService);

  protected get isFormValid(): boolean {
    return this.form.valid || this.form.disabled || this.form.pristine;
  }

  public onAutoSubmit(): void {
    if (!this.form.valid) return;
    this.submitValue();
  }

  private async submitValue(): Promise<void> {
    const selectedDateISO = this.foodDiaryService.selectedDayIso$$();
    const bodyWeightValue = this.form.controls.bodyWeight.value;

    if (!bodyWeightValue) return;

    this.form.disable();

    try {
      const normalizedBodyWeight = String(bodyWeightValue).replace(',', '.');
      const bodyWeight: BodyWeightInterface = {
        bodyWeight: normalizedBodyWeight,
        dateISO: selectedDateISO,
      };

      const result = await this.foodDiaryService.setUserBodyWeight(bodyWeight);

      if (!result) throw new Error();

      this.autoSubmitResult$$.set(VInputAutoSubmitResult.Success);
      this.bodyWeightInput().blur();
    } catch {
      this.autoSubmitResult$$.set(VInputAutoSubmitResult.Error);
    } finally {
      this.form.enable();
      setTimeout(() => this.autoSubmitResult$$.set(null), 1);
    }
  }

  public focusInput(): void {
    this.bodyWeightInput().focus();
  }

  private readonly applyWeightEffect$$ = effect(() => {
    const selectedDateISO = this.foodDiaryService.selectedDayIso$$();
    const weight = this.foodDiaryService.diary$$()?.[selectedDateISO]?.totals.bodyWeight;

    if (!weight) {
      this.form.patchValue({ bodyWeight: null });
      return;
    }

    this.form.patchValue({ bodyWeight: String(weight) });
  });

  public focusIfEmpty(): void {
    const control = this.form.controls.bodyWeight;
    if (!control.value || control.value === '') {
      setTimeout(() => {
        this.bodyWeightInput().focus();
      }, 100); // Waiting for expansion panel to open
    }
  }
}
