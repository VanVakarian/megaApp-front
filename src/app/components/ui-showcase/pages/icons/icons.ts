import { Component } from '@angular/core';
import { VCard } from '@app/shared/ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@app/shared/ui-kit/components/v-icon/v-icon';

@Component({
  selector: 'icons',
  templateUrl: './icons.html',
  imports: [VCard, VIcon],
})
export class Icons {
  protected readonly iconNames = Object.values(IconName);

  protected getIconKey(iconName: IconName): string {
    return Object.keys(IconName).find((key) => IconName[key as keyof typeof IconName] === iconName) || iconName;
  }

  protected async copyIconName(iconName: IconName): Promise<void> {
    try {
      const iconKey = this.getIconKey(iconName);
      await navigator.clipboard.writeText(iconKey);
    } catch {}
  }
}
