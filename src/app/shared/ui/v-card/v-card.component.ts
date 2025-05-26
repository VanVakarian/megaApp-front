import { Component, HostBinding, input, output } from '@angular/core';
import { CssUnitValue } from '../types';

@Component({
  selector: 'v-card',
  templateUrl: './v-card.component.html',
  styleUrl: './v-card.component.css',
  standalone: true,
})
export class VCardComponent {
  public readonly borderRadius = input<CssUnitValue>(2);
  public readonly padding = input<CssUnitValue>(2);

  public readonly onCardclick = output<MouseEvent>();

  @HostBinding('style.--v-card-border-radius')
  get cardBorderRadius() {
    return `var(--unit-${this.borderRadius()})`;
  }

  @HostBinding('style.--v-card-padding')
  get cardPadding() {
    return `var(--unit-${this.padding()})`;
  }

  onClick(event: MouseEvent): void {
    this.onCardclick.emit(event);
  }
}
