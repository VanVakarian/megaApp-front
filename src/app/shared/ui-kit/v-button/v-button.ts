import { Component, ElementRef, inject, input, output } from '@angular/core';

export enum ButtonStyle {
  Flat = 'flat',
  Raised = 'raised',
  Primary = 'primary',
}

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
    '[style.width]': 'width()',
    '[attr.flat]': 'isFlat ? "" : null',
    '[attr.raised]': 'isRaised ? "" : null',
    '[attr.primary]': 'isPrimary ? "" : null',
  },
})
export class VButton {
  public readonly buttonStyle = input<ButtonStyle>();

  public readonly width = input<string>();

  public readonly onClick = output<MouseEvent>();

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
