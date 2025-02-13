import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, effect, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { catchError, firstValueFrom, map, of } from 'rxjs';

import { RequestStatus, SettingsService } from '@app/services/settings.service';
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
  height: FormControl<string>;
}

type FormFields = keyof SettingsForm;

enum Labels {
  MAIN_SETTINGS = 'Основные настройки',
  CHAPTERS_SELECTION = 'Выбор разделов:',
  FOOD_DIARY = 'Дневник питания',
  MONEY_DIARY = 'Дневник финансов',
  DARK_THEME = 'Тёмная тема:',
  FOOD_DIARY_SETTINGS = 'Настройки дневника питания',
  HEIGHT = 'Рост',
  HEIGHT_SUFFIX = 'см',
  TEMP_SETTINGS = 'Временные настройки', // TODO[066]: Delete this sometime
  TEMP_GET_OLD_DATA = 'Получить старые данные', // TODO[066]: Delete this sometime
}

enum ErrorLabels {
  HEIGHT = 'XXX',
}

@Component({
  selector: 'app-settings-form',
  templateUrl: './settings-form.component.html',
  styleUrl: './settings-form.component.scss',
  standalone: true,
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
  });

  public heightFieldState: AnimationState = AnimationState.IDLE;
  private heightPreviousValue: number = 0;
  private heightSubmitDelay: ReturnType<typeof setTimeout> | null = null;
  private heightFieldAnimationStateManager = new AnimationStateManager(AnimationState.IDLE, (state) => {
    this.heightFieldState = state;
  });

  constructor(
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
  ) {
    effect(() => {
      this.blockFieldsOnRequestsStatusChanges();
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

    const requestIsSuccess = await this.settingsService.saveSelectedChapter(setting);
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

    const requestIsSuccess = await this.settingsService.saveSelectedChapter(setting);
    if (!requestIsSuccess) {
      this.settingsForm.patchValue({ darkTheme: currentValue }, { emitEvent: false });
      this.settingsService.applyTheme(currentValue);
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

    const isSuccess = await this.settingsService.saveSelectedChapter(setting);
    if (isSuccess) {
      this.heightPreviousValue = Number(height);
    } else {
      this.settingsForm.patchValue({ height: String(this.heightPreviousValue) }, { emitEvent: false });
    }
  }

  private async applySettingsToForm(): Promise<void> {
    const settings = await this.settingsService.initLoadSettings();
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
      },
      { emitEvent: false },
    );
  }

  private blockFieldsOnRequestsStatusChanges(): void {
    const selectedChapterFoodRequestStatus = this.settingsService.requestStatus.selectedChapterFood();
    if (selectedChapterFoodRequestStatus === RequestStatus.IN_PROGRESS) {
      this.settingsForm.controls.selectedChapterFood.disable();
    } else {
      this.settingsForm.controls.selectedChapterFood.enable();
    }

    const selectedChapterMoneyRequestStatus = this.settingsService.requestStatus.selectedChapterMoney();
    if (selectedChapterMoneyRequestStatus === RequestStatus.IN_PROGRESS) {
      this.settingsForm.controls.selectedChapterMoney.disable();
    } else {
      this.settingsForm.controls.selectedChapterMoney.enable();
    }

    const darkThemeRequestStatus = this.settingsService.requestStatus.darkTheme();
    if (darkThemeRequestStatus === RequestStatus.IN_PROGRESS) {
      this.settingsForm.controls.darkTheme.disable();
    } else {
      this.settingsForm.controls.darkTheme.enable();
    }

    const heightRequestStatus = this.settingsService.requestStatus.height();
    if (heightRequestStatus === RequestStatus.IN_PROGRESS) {
      this.settingsForm.controls.height.disable();
      this.heightFieldAnimationStateManager.toSubmitting();
    } else if (heightRequestStatus === RequestStatus.SUCCESS) {
      this.settingsForm.controls.height.enable();
      this.heightFieldAnimationStateManager.toSuccess();
    } else if (heightRequestStatus === RequestStatus.ERROR) {
      this.settingsForm.controls.height.enable();
      this.heightFieldAnimationStateManager.toError();
    }
  }

  // TODO[066]: Delete this sometime
  public isTempGetOldDataButtonDisabled = false;
  public async onTempGetOldDataButtonClick(): Promise<void> {
    this.isTempGetOldDataButtonDisabled = true;
    const res = await firstValueFrom(
      this.http.get<any>('/api/debug/transfer/').pipe(
        catchError(() => of(false)),
        map((response) => !!response),
      ),
    );
    this.isTempGetOldDataButtonDisabled = false;
  }
}
