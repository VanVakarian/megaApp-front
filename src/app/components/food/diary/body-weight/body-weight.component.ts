import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { firstValueFrom } from 'rxjs';

import { FoodStatsService } from '@app/services/food-stats.service';
import { FoodService } from '@app/services/food.service';
import { DEFAULT_INPUT_FIELD_PROGRESS_TIMER } from '@app/shared/const';
import {
  AnimationState,
  AnimationStateManager,
  FieldStateAnimationsDirective,
} from '@app/shared/directives/field-state-animations.directive';
import { BodyWeight } from '@app/shared/interfaces';

interface BodyWeightForm {
  bodyWeight: FormControl<string | null>;
}

enum FormLabels {
  WEIGHT = 'Вес',
  KG = 'кг',
}

enum FormErrors {
  WEIGHT = 'ХХ.Х или ХХ',
}

@Component({
  selector: 'app-body-weight',
  templateUrl: './body-weight.component.html',
  styleUrl: './body-weight.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, FieldStateAnimationsDirective],
})
export class BodyWeightComponent {
  public FormLabels = FormLabels;
  public FormErrors = FormErrors;

  public form = new FormGroup<BodyWeightForm>({
    bodyWeight: new FormControl('', {
      validators: [Validators.required, Validators.pattern(/^\d{2,3}([.,]\d)?$/)],
    }),
  });

  public currentState: AnimationState = AnimationState.IDLE;

  private previousValue: string = '';

  private weightSubmitDelay: ReturnType<typeof setTimeout> | null = null;

  private weightFieldAnimationStateManager = new AnimationStateManager(AnimationState.IDLE, (state) => {
    this.currentState = state;
    this.cdRef.detectChanges();
  });

  constructor(
    private foodService: FoodService,
    private foodStatsService: FoodStatsService,
    private cdRef: ChangeDetectorRef,
  ) {
    effect(() => {
      this.applyWeight();
    });
  }

  public get isFormValid(): boolean {
    return this.form.valid || this.form.disabled || this.form.pristine;
  }

  public onEnter(): void {
    if (!this.form.valid) {
      return;
    }

    if (this.currentState === AnimationState.COUNTDOWN) {
      this.weightFieldAnimationStateManager.toIdle();
    }
    this.submitValue();
  }

  public onInput(): void {
    const control = this.form.controls.bodyWeight;
    control.markAsTouched();

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
      this.weightFieldAnimationStateManager.toIdle();
    }
  }

  private async submitValue(): Promise<void> {
    const selectedDateISO = this.foodService.selectedDayIso$$();
    const weightValue = this.form.controls.bodyWeight.value;
    const weightDelta = Number(weightValue) - Number(this.previousValue);
    if (!weightValue) return;

    this.weightFieldAnimationStateManager.toSubmitting();
    this.form.disable();

    try {
      const weight: BodyWeight = {
        bodyWeight: weightValue,
        dateISO: selectedDateISO,
      };

      const result = await firstValueFrom(this.foodService.setUserBodyWeight(weight));
      if (!result) throw new Error();

      this.previousValue = weightValue;
      this.weightFieldAnimationStateManager.toSuccess();

      this.foodStatsService.updateStats(selectedDateISO, weightDelta, 0);
    } catch {
      this.weightFieldAnimationStateManager.toError();
    } finally {
      this.form.enable();
    }
  }

  private applyWeight(): void {
    const selectedDateISO = this.foodService.selectedDayIso$$();
    const weight = this.foodService.diary$$()?.[selectedDateISO]?.['bodyWeight'];

    if (!weight) {
      this.form.patchValue({ bodyWeight: null });
      return;
    }

    this.form.patchValue({ bodyWeight: String(weight) });
    this.previousValue = String(weight);
  }
}
