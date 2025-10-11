import { Component, effect, input, output, signal } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

@Component({
  selector: 'v-expand',
  templateUrl: './v-expand.html',
  styleUrl: './v-expand.css',
  // '[style.--v-expand-border-radius]': 'getExpandBorderRadius()',
  host: {
    '[style.--v-expand-padding]': 'getExpandPadding()',
    '[class.no-transition]': 'isWithoutAnimation()',
  },
})
export class VExpand {
  // public readonly borderRadius = input<CssUnitValue>(2);
  public readonly padding = input<CssUnitValue>(2);
  public readonly isExpanded = input<boolean>(false);
  public readonly onOpened = output<CustomEvent<boolean>>();
  public readonly isWithoutAnimation = input<boolean>(false);

  private readonly _isExpanded$$ = signal(false);

  private readonly onExpandedChangeEmitEffect$$ = effect(() => {
    const current = this._isExpanded$$();
    this.onOpened.emit(new CustomEvent('opened', { detail: current }));
  });

  private readonly syncIsExpandedEffect$$ = effect(() => {
    const external = this.isExpanded();
    this._isExpanded$$.set(external);
  });

  // public getExpandBorderRadius(): string {
  //   return `var(--unit-${this.borderRadius()})`;
  // }

  public getExpandPadding(): string {
    return `var(--unit-${this.padding()})`;
  }

  public setExpanded(state: boolean): void {
    this._isExpanded$$.set(state);
  }

  protected isPanelExpanded(): boolean {
    return this._isExpanded$$();
  }

  protected toggle(): void {
    this._isExpanded$$.set(!this._isExpanded$$());
  }
}
