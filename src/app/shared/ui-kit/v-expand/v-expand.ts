import { Component, effect, input, signal } from '@angular/core';
import { CssUnitValue } from '../types';

@Component({
  selector: 'v-expand',
  templateUrl: './v-expand.html',
  styleUrl: './v-expand.css',
  host: {
    '[style.--v-expand-border-radius]': 'expandBorderRadius',
    '[style.--v-expand-padding]': 'expandPadding',
  },
})
export class VExpand {
  public readonly borderRadius = input<CssUnitValue>(2);
  public readonly padding = input<CssUnitValue>(2);
  public readonly expanded = input<boolean>(false);

  private readonly _isExpanded = signal(false);

  public get expandBorderRadius(): string {
    return `var(--unit-${this.borderRadius()})`;
  }

  public get expandPadding(): string {
    return `var(--unit-${this.padding()})`;
  }

  public isExpanded(): boolean {
    return this._isExpanded();
  }

  public toggle(): void {
    this._isExpanded.set(!this._isExpanded());
  }

  public setExpanded(expanded: boolean): void {
    this._isExpanded.set(expanded);
  }

  constructor() {
    effect(() => {
      this._isExpanded.set(this.expanded());
    });
  }
}
