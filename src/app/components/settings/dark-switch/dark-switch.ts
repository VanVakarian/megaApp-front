import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SettingsService } from '@app/services/settings.service';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ButtonStyle } from '@ui-kit/types';

@Component({
  selector: 'dark-switch',
  templateUrl: './dark-switch.html',
  imports: [CommonModule, VButton, VIcon],
})
export class DarkSwitch {
  protected readonly ButtonStyle = ButtonStyle;

  protected readonly settingsService = inject(SettingsService);

  protected readonly iconName$$ = computed(() => {
    return this.settingsService.settings$$().darkTheme ? IconName.LightMode : IconName.DarkMode;
  });

  protected async switchTheme(): Promise<void> {
    const setting = { darkTheme: !this.settingsService.settings$$().darkTheme };
    this.settingsService.applyTheme(setting.darkTheme);
    const requestIsSuccess = await this.settingsService.saveSetting(setting);

    if (!requestIsSuccess) this.settingsService.applyTheme(!setting.darkTheme);
  }
}
