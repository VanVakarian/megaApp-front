import { Component, ElementRef, HostBinding, inject, input, output } from '@angular/core';

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
})
export class VButton {
  public readonly buttonStyle = input<ButtonStyle>();

  public readonly width = input<string>();

  public readonly onClick = output<MouseEvent>();

  private readonly elementRef = inject(ElementRef);

  @HostBinding('style.width')
  get widthStyle() {
    return this.width();
  }

  @HostBinding('attr.flat')
  get flatAttribute() {
    return this.getActiveStyle() === ButtonStyle.Flat ? '' : null;
  }

  @HostBinding('attr.raised')
  get raisedAttribute() {
    return this.getActiveStyle() === ButtonStyle.Raised ? '' : null;
  }

  @HostBinding('attr.primary')
  get primaryAttribute() {
    return this.getActiveStyle() === ButtonStyle.Primary ? '' : null;
  }

  protected onButtonClick(event: MouseEvent): void {
    this.onClick.emit(event);
  }

  private getActiveStyle(): ButtonStyle | null {
    const styleInput = this.buttonStyle();
    if (styleInput) {
      return styleInput;
    }

    const element = this.elementRef.nativeElement;
    if (element.hasAttribute('flat')) return ButtonStyle.Flat;
    if (element.hasAttribute('raised')) return ButtonStyle.Raised;
    if (element.hasAttribute('primary')) return ButtonStyle.Primary;

    return null;
  }
}
