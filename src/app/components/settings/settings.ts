import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { AuthFormComponent } from '@app/components/settings/auth-form/auth-form.component';
import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';
import { DEFAULT_INPUT_FIELD_PROGRESS_TIMER } from '@app/shared/const';
import {
  AnimationState,
  AnimationStateManager,
  FieldStateAnimationsDirective,
} from '@app/shared/directives/field-state-animations.directive';
import { KeyOfUserSettings, UserSettings } from '@app/shared/interfaces';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VInput } from '@ui-kit/components/v-input/v-input';

interface SettingsForm {
  selectedChapterFood: FormControl<boolean>;
  selectedChapterMoney: FormControl<boolean>;
  darkTheme: FormControl<boolean>;
  height: FormControl<string>;
}

type FormFields = keyof SettingsForm;

@Component({
  selector: 'settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    FieldStateAnimationsDirective,
    AuthFormComponent,
    VCard,
    VCheckbox,
    VInput,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly KeyOfSettings = KeyOfUserSettings;

  protected readonly heightInput = viewChild.required(VInput);

  protected readonly settingsForm = new FormGroup<SettingsForm>({
    selectedChapterFood: new FormControl(false, { nonNullable: true }),
    selectedChapterMoney: new FormControl(false, { nonNullable: true }),
    darkTheme: new FormControl(false, { nonNullable: true }),
    height: new FormControl('', {
      validators: [Validators.required, Validators.pattern(/^\d{3}$/)],
      nonNullable: true,
    }),
  });

  protected readonly heightFieldState = signal<AnimationState>(AnimationState.IDLE);

  protected readonly authService = inject(AuthService);

  private readonly settingsService = inject(SettingsService);
  private readonly heightPreviousValue = signal<number>(0);
  private readonly heightSubmitDelay = signal<ReturnType<typeof setTimeout> | null>(null);
  private readonly heightFieldAnimationStateManager = new AnimationStateManager(AnimationState.IDLE, (state) => {
    this.heightFieldState.set(state);
  });
  private readonly syncSettingsEffect = effect(() => {
    this.applySettingsToForm();
  });

  protected async onSelectedChapterCheckboxChange(chapterName: FormFields, newValue: boolean): Promise<void> {
    const currentValue = this.settingsForm.controls[chapterName].value;
    const setting = { [chapterName]: newValue };

    if (currentValue === newValue) return;

    this.settingsForm.patchValue({ [chapterName]: newValue }, { emitEvent: false });

    const requestIsSuccess = await this.settingsService.saveSetting(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ [chapterName]: currentValue }, { emitEvent: false });
    }
  }

  protected async onThemeToggleChange(newValue: boolean): Promise<void> {
    const currentValue = this.settingsForm.controls.darkTheme.value;
    const setting = { darkTheme: newValue };

    if (currentValue === newValue) return;

    this.settingsForm.patchValue({ darkTheme: newValue }, { emitEvent: false });
    this.settingsService.applyTheme(newValue);

    const requestIsSuccess = await this.settingsService.saveSetting(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ darkTheme: currentValue }, { emitEvent: false });
      this.settingsService.applyTheme(currentValue);
    }
  }

  protected get isHeightValid(): boolean {
    return (
      this.settingsForm.controls.height.valid ||
      this.settingsForm.controls.height.disabled ||
      this.settingsForm.controls.height.pristine
    );
  }

  protected focusHeightInput(): void {
    this.heightInput().focus();
  }

  protected onHeightEnter(): void {
    if (!this.settingsForm.controls.height.valid) return;

    if (this.heightFieldState() === AnimationState.COUNTDOWN) {
      this.heightFieldAnimationStateManager.toIdle();
    }

    this.submitHeightValue();
  }

  protected onHeightInput(): void {
    const control = this.settingsForm.controls.height;
    control.markAsTouched();
    if (control.valid && Number(control.value) !== this.heightPreviousValue()) {
      this.heightFieldAnimationStateManager.toIdle();
      setTimeout(() => this.heightFieldAnimationStateManager.toCountdown());

      const heightSubmitDelay = this.heightSubmitDelay();
      if (heightSubmitDelay) clearTimeout(heightSubmitDelay);

      this.heightSubmitDelay.set(
        setTimeout(() => {
          if (this.heightFieldState() === AnimationState.COUNTDOWN) {
            this.submitHeightValue();
          }
        }, DEFAULT_INPUT_FIELD_PROGRESS_TIMER),
      );
    } else {
      this.heightFieldAnimationStateManager.toIdle();
    }
  }

  private async submitHeightValue(): Promise<void> {
    this.heightFieldAnimationStateManager.toSubmitting();
    const height = this.settingsForm.controls.height.value;
    const setting = { height: Number(height) };

    const isSuccess = await this.settingsService.saveSetting(setting);
    if (isSuccess) {
      this.heightPreviousValue.set(Number(height));
    } else {
      this.settingsForm.patchValue({ height: String(this.heightPreviousValue()) }, { emitEvent: false });
    }
  }

  private applySettingsToForm(): void {
    const settings = this.settingsService.settings$$();
    this.applySettingstoForm(settings);
    this.heightPreviousValue.set(Number(settings.height));
  }

  private applySettingstoForm(settings: UserSettings): void {
    this.settingsForm.patchValue(
      {
        selectedChapterFood: settings.selectedChapterFood,
        selectedChapterMoney: settings.selectedChapterMoney,
        darkTheme: settings.darkTheme,
        height: String(settings.height),
      },
      { emitEvent: false },
    );
  }
}
