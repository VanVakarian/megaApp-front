import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

@Component({
  selector: 'v-expand',
  templateUrl: './v-expand.html',
  styleUrl: './v-expand.css',
  host: {
    '[style.--v-expand-padding]': 'paddingString$$()',
    '[style.--v-expand-border-radius]': 'borderRadiusString$$()',
    '[class.no-transition]': 'isWithoutAnimation()',
  },
})
export class VExpand {
  public readonly padding = input<CssUnitValue>(2);
  public readonly borderRadius = input<CssUnitValue>(2);
  public readonly isExpanded = input<boolean>(false);
  public readonly isWithoutAnimation = input<boolean>(false);

  public readonly onOpened = output<CustomEvent<boolean>>();

  public readonly paddingString$$ = computed(() => {
    return `var(--unit-${this.padding()})`;
  });

  public readonly borderRadiusString$$ = computed(() => {
    return `var(--unit-${this.borderRadius()})`;
  });

  private readonly _isExpanded$$ = signal(false);

  private readonly onExpandedChangeEmitEffect$$ = effect(() => {
    const current = this._isExpanded$$();
    this.onOpened.emit(new CustomEvent('opened', { detail: current }));
  });

  private readonly syncIsExpandedEffect$$ = effect(() => {
    const external = this.isExpanded();
    this._isExpanded$$.set(external);
  });

  public setExpanded(state: boolean): void {
    this._isExpanded$$.set(state);
  }

  public isPanelExpanded(): boolean {
    return this._isExpanded$$();
  }

  protected toggle(): void {
    this._isExpanded$$.set(!this._isExpanded$$());
  }
}
