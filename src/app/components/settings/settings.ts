import { Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { SettingsService } from '@app/services/settings.service';
import { KeyOfUserSettings, UserSettings } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';

interface SettingsForm {
  selectedChapterFood: FormControl<boolean>;
  selectedChapterMoney: FormControl<boolean>;
  darkTheme: FormControl<boolean>;
}

type FormFields = keyof SettingsForm;

@Component({
  selector: 'settings',
  templateUrl: './settings.html',
  imports: [ReactiveFormsModule, VButton, VCard, VCheckbox],
})
export class Settings {
  protected readonly KeyOfSettings = KeyOfUserSettings;

  protected readonly settingsForm = new FormGroup<SettingsForm>({
    selectedChapterFood: new FormControl(false, { nonNullable: true }),
    selectedChapterMoney: new FormControl(false, { nonNullable: true }),
    darkTheme: new FormControl(false, { nonNullable: true }),
  });

  protected readonly authService = inject(AuthService);
  protected readonly deviceInfoService = inject(DeviceInfoService);
  protected readonly settingsService = inject(SettingsService);

  private readonly syncSettingsEffect = effect(() => {
    this.applySettingsToForm(this.settingsService.settings$$(), this.settingsService.darkTheme$$());
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

  protected onThemeToggleChange(newValue: boolean): void {
    const currentValue = this.settingsForm.controls.darkTheme.value;
    if (currentValue === newValue) return;

    this.settingsForm.patchValue({ darkTheme: newValue }, { emitEvent: false });
    this.settingsService.setDarkTheme(newValue);
  }

  private applySettingsToForm(settings: UserSettings, darkTheme: boolean): void {
    this.settingsForm.patchValue(
      {
        selectedChapterFood: settings.selectedChapterFood,
        selectedChapterMoney: settings.selectedChapterMoney,
        darkTheme,
      },
      { emitEvent: false },
    );
  }
}
