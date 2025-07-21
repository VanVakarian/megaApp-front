import { Component, HostBinding, input, output } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

@Component({
  selector: 'v-card',
  templateUrl: './v-card.html',
  styleUrl: './v-card.css',
})
export class VCard {
  public readonly borderRadius = input<CssUnitValue>(2);
  public readonly padding = input<CssUnitValue>(2);

  public readonly onCardclick = output<MouseEvent>();

  @HostBinding('style.--v-card-border-radius')
  get cardBorderRadius(): string {
    return `var(--unit-${this.borderRadius()})`;
  }

  @HostBinding('style.--v-card-padding')
  get cardPadding(): string {
    return `var(--unit-${this.padding()})`;
  }

  protected onClick(event: MouseEvent): void {
    this.onCardclick.emit(event);
  }
}
