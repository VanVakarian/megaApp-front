import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsService } from '@app/services/settings.service';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';

@Component({
  selector: 'dark-switch',
  templateUrl: './dark-switch.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, VButton, VIcon],
})
export class DarkSwitch {
  protected readonly settingsService = inject(SettingsService);

  protected readonly iconName$$ = computed(() => {
    return this.settingsService.darkTheme$$() ? IconName.LightMode : IconName.DarkMode;
  });

  protected switchTheme(): void {
    this.settingsService.setDarkTheme(!this.settingsService.darkTheme$$());
  }
}
