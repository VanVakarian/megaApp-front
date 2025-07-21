import { Component, computed, input } from '@angular/core';
import { CssUnitValue, IconName } from '@app/shared/ui-kit/types';

@Component({
  selector: 'v-icon',
  templateUrl: './v-icon.html',
  styleUrl: './v-icon.css',
  host: {
    '[style.--v-icon-size]': 'getIconSize()',
    '[style.--v-icon-background]': 'getIconBackground()',
    '[style.--v-icon-color]': 'color()',
  },
})
export class VIcon {
  public readonly name = input.required<IconName>();

  public readonly size = input<CssUnitValue>(4);

  public readonly color = input<string>('var(--color-text-default)');

  public readonly iconPath = computed(() => {
    return `assets/icons/${this.name()}.svg`;
  });

  public getIconSize(): string {
    return `var(--unit-${this.size()})`;
  }

  public getIconBackground(): string {
    return `url(${this.iconPath()})`;
  }
}
