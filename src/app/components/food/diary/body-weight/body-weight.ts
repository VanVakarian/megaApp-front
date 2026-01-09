import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { DEFAULT_INPUT_FIELD_PROGRESS_TIMER } from '@app/shared/const';
import {
  AnimationState,
  AnimationStateManager,
  FieldStateAnimationsDirective,
} from '@app/shared/directives/field-state-animations.directive';
import { BodyWeightInterface as BodyWeightI } from '@app/shared/interfaces';
import { VInput } from '@app/shared/ui-kit/components/v-input/v-input';

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
  styleUrl: './body-weight.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldStateAnimationsDirective, VInput],
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

  protected currentState: AnimationState = AnimationState.IDLE;

  private previousValue: string = '';

  private weightSubmitDelay: ReturnType<typeof setTimeout> | null = null;

  private isSubmitting = false;

  private weightFieldAnimationStateManager = new AnimationStateManager(AnimationState.IDLE, (state) => {
    this.currentState = state;
    this.cdRef.detectChanges();
  });

  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly cdRef = inject(ChangeDetectorRef);

  protected get isFormValid(): boolean {
    return this.form.valid || this.form.disabled || this.form.pristine;
  }

  public onEnter(): void {
    if (!this.form.valid) return;

    if (this.weightSubmitDelay) {
      clearTimeout(this.weightSubmitDelay);
      this.weightSubmitDelay = null;
    }

    if (this.currentState === AnimationState.COUNTDOWN) {
      this.weightFieldAnimationStateManager.toIdle();
    }

    this.submitValue();
  }

  public onInput(): void {
    const control = this.form.controls.bodyWeight;
    control.markAsTouched();

    if (this.isSubmitting) return;

    if (this.form.valid && control.value !== String(this.previousValue)) {
      this.weightFieldAnimationStateManager.toIdle();
      setTimeout(() => {
        this.weightFieldAnimationStateManager.toCountdown();
        this.cdRef.detectChanges();
      });

      if (this.weightSubmitDelay) clearTimeout(this.weightSubmitDelay);

      this.weightSubmitDelay = setTimeout(() => {
        if (this.currentState === AnimationState.COUNTDOWN) this.submitValue();
      }, DEFAULT_INPUT_FIELD_PROGRESS_TIMER);
    } else {
      if (this.currentState !== AnimationState.SUCCESS && this.currentState !== AnimationState.ERROR) {
        this.weightFieldAnimationStateManager.toIdle();
      }
    }
  }

  private async submitValue(): Promise<void> {
    const selectedDateISO = this.foodDiaryService.selectedDayIso$$();
    const bodyWeightValue = this.form.controls.bodyWeight.value;

    if (!bodyWeightValue) return;

    this.isSubmitting = true;
    this.weightFieldAnimationStateManager.toSubmitting();
    this.form.disable();

    try {
      const normalizedBodyWeight = String(bodyWeightValue).replace(',', '.');
      const bodyWeight: BodyWeightI = {
        bodyWeight: normalizedBodyWeight,
        dateISO: selectedDateISO,
      };

      const result = await this.foodDiaryService.setUserBodyWeight(bodyWeight);

      if (!result) throw new Error();

      this.previousValue = bodyWeightValue;
      this.weightFieldAnimationStateManager.toSuccess();
      this.bodyWeightInput().blur();
    } catch {
      this.weightFieldAnimationStateManager.toError();
    } finally {
      this.form.enable();
      this.isSubmitting = false;
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
    this.previousValue = String(weight);
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
