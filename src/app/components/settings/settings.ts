import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthForm } from '@app/components/settings/auth-form/auth-form';
import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';
import { KeyOfUserSettings, UserSettings } from '@app/shared/interfaces';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VInput, VInputAutoSubmitResult } from '@ui-kit/components/v-input/v-input';

interface SettingsForm {
  selectedChapterFood: FormControl<boolean>;
  selectedChapterMoney: FormControl<boolean>;
  darkTheme: FormControl<boolean>;
  height: FormControl<string>;
}

type FormFields = keyof SettingsForm;

@Component({
  selector: 'settings',
  templateUrl: './settings.html',
  imports: [CommonModule, ReactiveFormsModule, AuthForm, VCard, VCheckbox, VInput],
})
export class Settings {
  protected readonly KeyOfSettings = KeyOfUserSettings;

  protected readonly heightInputElem = viewChild.required(VInput);

  protected readonly isHeightEditing$$ = signal(false);

  protected readonly settingsForm = new FormGroup<SettingsForm>({
    selectedChapterFood: new FormControl(false, { nonNullable: true }),
    selectedChapterMoney: new FormControl(false, { nonNullable: true }),
    darkTheme: new FormControl(false, { nonNullable: true }),
    height: new FormControl('', {
      validators: [Validators.required, Validators.pattern(/^\d{3}$/)],
      nonNullable: true,
    }),
  });

  private readonly heightPreviousValue$$ = signal<number>(0);

  protected readonly heightAutoSubmitResult$$ = signal<VInputAutoSubmitResult | null>(null);

  protected readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

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
    this.heightInputElem().focus();
  }

  protected onHeightFocus(): void {
    this.isHeightEditing$$.set(true);
  }

  protected onHeightBlur(): void {
    this.isHeightEditing$$.set(false);
  }

  protected onHeightAutoSubmit(): void {
    if (!this.settingsForm.controls.height.valid) return;
    this.submitHeightValue();
  }

  private async submitHeightValue(): Promise<void> {
    const height = this.settingsForm.controls.height.value;
    const setting = { height: Number(height) };

    const isSuccess = await this.settingsService.saveSetting(setting);
    if (isSuccess) {
      this.heightPreviousValue$$.set(Number(height));
      this.heightAutoSubmitResult$$.set(VInputAutoSubmitResult.Success);
      this.heightInputElem().blur();
    } else {
      this.settingsForm.patchValue({ height: String(this.heightPreviousValue$$()) }, { emitEvent: false });
      this.heightAutoSubmitResult$$.set(VInputAutoSubmitResult.Error);
    }
    setTimeout(() => this.heightAutoSubmitResult$$.set(null), 1);
  }

  private applySettingsToForm(): void {
    const settings = this.settingsService.settings$$();
    this.applySettingstoForm(settings);
    if (!this.isHeightEditing$$()) {
      this.heightPreviousValue$$.set(Number(settings.height));
    }
  }

  private applySettingstoForm(settings: UserSettings): void {
    const nextValues: Partial<{
      selectedChapterFood: boolean;
      selectedChapterMoney: boolean;
      darkTheme: boolean;
      height: string;
    }> = {
      selectedChapterFood: settings.selectedChapterFood,
      selectedChapterMoney: settings.selectedChapterMoney,
      darkTheme: settings.darkTheme,
    };

    if (!this.isHeightEditing$$()) {
      nextValues.height = String(settings.height);
    }

    this.settingsForm.patchValue(nextValues, { emitEvent: false });
  }
}
