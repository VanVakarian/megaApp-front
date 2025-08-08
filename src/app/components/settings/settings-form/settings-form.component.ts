import { CommonModule } from '@angular/common';
import { Component, OnInit, effect } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingsService } from '@app/services/settings.service';
import { DEFAULT_INPUT_FIELD_PROGRESS_TIMER } from '@app/shared/const';
import {
  AnimationState,
  AnimationStateManager,
  FieldStateAnimationsDirective,
} from '@app/shared/directives/field-state-animations.directive';
import { KeyOfSettings, Settings } from '@app/shared/interfaces';

interface SettingsForm {
  selectedChapterFood: FormControl<boolean>;
  selectedChapterMoney: FormControl<boolean>;
  darkTheme: FormControl<boolean>;
  liteVersion: FormControl<boolean>;
  height: FormControl<string>;
}

type FormFields = keyof SettingsForm;

enum Labels {
  MAIN_SETTINGS = 'Основные настройки',
  CHAPTERS_SELECTION = 'Выбор разделов:',
  FOOD_DIARY = 'Дневник питания',
  MONEY_DIARY = 'Дневник финансов',
  DARK_THEME = 'Тёмная тема:',
  FOOD_DIARY_SETTINGS = 'Настройки дневника питания',
  LITE_VERSION = 'Упрощённый интерфейс:',
  HEIGHT = 'Рост',
  HEIGHT_SUFFIX = 'см',
}

enum ErrorLabels {
  HEIGHT = 'XXX',
}

@Component({
  selector: 'app-settings-form',
  templateUrl: './settings-form.component.html',
  styleUrl: './settings-form.component.scss',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FieldStateAnimationsDirective,
  ],
})
export class SettingsFormComponent implements OnInit {
  public readonly KeyOfSettings = KeyOfSettings;

  public Labels = Labels;
  public ErrorLabels = ErrorLabels;

  public settingsForm = new FormGroup<SettingsForm>({
    selectedChapterFood: new FormControl(false, { nonNullable: true }),
    selectedChapterMoney: new FormControl(false, { nonNullable: true }),
    darkTheme: new FormControl(false, { nonNullable: true }),
    height: new FormControl('', {
      validators: [Validators.required, Validators.pattern(/^\d{3}$/)],
      nonNullable: true,
    }),
    liteVersion: new FormControl(false, { nonNullable: true }),
  });

  public heightFieldState: AnimationState = AnimationState.IDLE;
  private heightPreviousValue: number = 0;
  private heightSubmitDelay: ReturnType<typeof setTimeout> | null = null;
  private heightFieldAnimationStateManager = new AnimationStateManager(AnimationState.IDLE, (state) => {
    this.heightFieldState = state;
  });

  constructor(private settingsService: SettingsService) {
    effect(() => {
      this.applySettingsToForm();
    });
  }

  public ngOnInit(): void {
    this.applySettingsToForm();
  }

  public async onSelectedChapterChipToggle(chapterName: FormFields): Promise<void> {
    const currentValue = this.settingsForm.controls[chapterName].value;
    const newValue = !currentValue;
    const setting = { [chapterName]: newValue };

    this.settingsForm.patchValue({ [chapterName]: newValue }, { emitEvent: false });

    const requestIsSuccess = await this.settingsService.saveSetting(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ [chapterName]: currentValue }, { emitEvent: false });
    }
  }

  public async onThemeToggle(): Promise<void> {
    const currentValue = this.settingsForm.controls.darkTheme.value;
    const newValue = !currentValue;
    const setting = { darkTheme: newValue };

    this.settingsForm.patchValue({ darkTheme: newValue }, { emitEvent: false });
    this.settingsService.applyTheme(newValue);

    const requestIsSuccess = await this.settingsService.saveSetting(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ darkTheme: currentValue }, { emitEvent: false });
      this.settingsService.applyTheme(currentValue);
    }
  }

  public async onLiteVersionToggle(): Promise<void> {
    const currentValue = this.settingsForm.controls.liteVersion.value;
    const newValue = !currentValue;
    const setting = { liteVersion: newValue };

    this.settingsForm.patchValue({ liteVersion: newValue }, { emitEvent: false });

    const requestIsSuccess = await this.settingsService.saveSetting(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ liteVersion: currentValue }, { emitEvent: false });
    }
  }

  public get isHeightValid(): boolean {
    return this.settingsForm.controls.height.valid || this.settingsForm.controls.height.disabled;
  }

  public onHeightEnter(): void {
    if (!this.settingsForm.controls.height.valid) return;

    if (this.heightFieldState === AnimationState.COUNTDOWN) {
      this.heightFieldAnimationStateManager.toIdle();
    }

    this.submitHeightValue();
  }

  public onHeightInput(): void {
    const control = this.settingsForm.controls.height;
    control.markAsTouched();
    if (control.valid && Number(control.value) !== this.heightPreviousValue) {
      this.heightFieldAnimationStateManager.toIdle();
      setTimeout(() => this.heightFieldAnimationStateManager.toCountdown());

      if (this.heightSubmitDelay) clearTimeout(this.heightSubmitDelay);

      this.heightSubmitDelay = setTimeout(() => {
        if (this.heightFieldState === AnimationState.COUNTDOWN) {
          this.submitHeightValue();
        }
      }, DEFAULT_INPUT_FIELD_PROGRESS_TIMER);
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
      this.heightPreviousValue = Number(height);
    } else {
      this.settingsForm.patchValue({ height: String(this.heightPreviousValue) }, { emitEvent: false });
    }
  }

  private applySettingsToForm(): void {
    const settings = this.settingsService.settings$$();
    this.applySettingstoForm(settings);
    this.heightPreviousValue = Number(settings.height);
  }

  private applySettingstoForm(settings: Settings): void {
    this.settingsForm.patchValue(
      {
        selectedChapterFood: settings.selectedChapterFood,
        selectedChapterMoney: settings.selectedChapterMoney,
        darkTheme: settings.darkTheme,
        height: String(settings.height),
        liteVersion: settings.liteVersion,
      },
      { emitEvent: false },
    );
  }
}
