import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { ButtonStyle, CssUnitValue } from '@app/shared/ui-kit/types';

@Component({
  selector: `
    v-button[flat],
    v-button[raised],
    v-button[primary],
    v-button[buttonStyle]
  `,
  templateUrl: './v-button.html',
  styleUrl: './v-button.css',
  host: {
    '[style.width]': 'width() ? width() : null',
    '[attr.flat]': 'isFlat ? "" : null',
    '[attr.raised]': 'isRaised ? "" : null',
    '[attr.primary]': 'isPrimary ? "" : null',
    '[style.--v-btn-p-y]': 'paddingYString()',
    '[style.--v-btn-p-x]': 'paddingXString()',
  },
})
export class VButton {
  public readonly buttonStyle = input<ButtonStyle>();
  public readonly width = input<string>();
  public readonly isLabelHidden = input<boolean>(false);

  public readonly paddingY = input<CssUnitValue>(2);
  public readonly paddingX = input<CssUnitValue>(4);

  public readonly onClick = output<MouseEvent>();

  protected readonly paddingYString = computed(() => `var(--unit-${this.paddingY()})`);
  protected readonly paddingXString = computed(() => `var(--unit-${this.paddingX()})`);

  public get isFlat(): boolean {
    return this.getActiveStyle() === ButtonStyle.Flat;
  }

  public get isRaised(): boolean {
    return this.getActiveStyle() === ButtonStyle.Raised;
  }

  public get isPrimary(): boolean {
    return this.getActiveStyle() === ButtonStyle.Primary;
  }

  private readonly elementRef = inject(ElementRef);

  constructor() {}

  protected onButtonClick(event: MouseEvent): void {
    this.onClick.emit(event);
  }

  private getActiveStyle(): ButtonStyle | null {
    const styleInput = this.buttonStyle();
    if (styleInput) return styleInput;

    const element = this.elementRef.nativeElement;
    if (element.hasAttribute('flat')) return ButtonStyle.Flat;
    if (element.hasAttribute('raised')) return ButtonStyle.Raised;
    if (element.hasAttribute('primary')) return ButtonStyle.Primary;

    return null;
  }
}
