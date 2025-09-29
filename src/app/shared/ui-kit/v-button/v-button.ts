import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { ButtonStyle, CssUnitValue } from '@app/shared/ui-kit/types';

type ButtonType = 'button' | 'submit' | 'reset';

export interface VButtonConfig {
  type?: ButtonType;
  buttonStyle?: ButtonStyle;
  width?: string;
  isLabelHidden?: boolean;
  paddingY?: CssUnitValue;
  paddingX?: CssUnitValue;
  isDisabled?: boolean;
  isWithoutShadow?: boolean;
  bgOpacity?: '0' | '1' | `0.${number}`;
  textAlign?: 'left' | 'center' | 'right';
}

const DEFAULT_V_BUTTON_CONFIG: Required<VButtonConfig> = {
  type: 'button',
  buttonStyle: undefined as unknown as ButtonStyle,
  width: undefined as unknown as string,
  isLabelHidden: false,
  paddingY: 2,
  paddingX: 4,
  isDisabled: false,
  isWithoutShadow: false,
  bgOpacity: '1',
  textAlign: undefined as unknown as 'left' | 'center' | 'right',
};

@Component({
  selector: `
    v-button,
    v-button[primary],
    v-button[raised],
    v-button[flat],
    v-button[danger],
    v-button[buttonStyle],
  `,
  templateUrl: './v-button.html',
  styleUrl: './v-button.css',
  host: {
    '[style.width]': 'width() ? width() : null',
    '[attr.primary]': 'isPrimary ? "" : null',
    '[attr.raised]': 'isRaised ? "" : null',
    '[attr.flat]': 'isFlat ? "" : null',
    '[attr.danger]': 'isDanger ? "" : null',
    '[attr.no-shadow]': 'isWithoutShadow() ? "" : null',
    '[style.--v-button-bg-opacity]': 'bgOpacity()',
    '[style.--v-button-padding-y]': 'paddingYString()',
    '[style.--v-button-padding-x]': 'paddingXString()',
    '[attr.text-align]': 'textAlign() ? textAlign() : null',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : "false"',
  },
})
export class VButton {
  public readonly config = input<VButtonConfig>({});

  protected readonly settings = computed(() => ({
    ...DEFAULT_V_BUTTON_CONFIG,
    ...this.config(),
  }));

  protected readonly type = computed(() => this.settings().type);
  protected readonly width = computed(() => this.settings().width);
  protected readonly isLabelHidden = computed(() => this.settings().isLabelHidden);

  protected readonly paddingY = computed(() => this.settings().paddingY);
  protected readonly paddingX = computed(() => this.settings().paddingX);
  protected readonly isDisabled = computed(() => this.settings().isDisabled);
  protected readonly isWithoutShadow = computed(() => this.settings().isWithoutShadow);
  protected readonly bgOpacity = computed(() => this.settings().bgOpacity);
  protected readonly textAlign = computed(() => this.settings().textAlign);

  protected readonly onClick = output<MouseEvent>();

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

  public get isDanger(): boolean {
    return this.getActiveStyle() === ButtonStyle.Danger;
  }

  private readonly elementRef = inject(ElementRef);

  constructor() {}

  protected onButtonClick(event: MouseEvent): void {
    if (this.isDisabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.onClick.emit(event);
  }

  private getActiveStyle(): ButtonStyle {
    const styleInput = this.settings().buttonStyle;
    if (styleInput) return styleInput;

    const element = this.elementRef.nativeElement;
    if (element.hasAttribute('primary')) return ButtonStyle.Primary;
    if (element.hasAttribute('raised')) return ButtonStyle.Raised;
    if (element.hasAttribute('flat')) return ButtonStyle.Flat;
    if (element.hasAttribute('danger')) return ButtonStyle.Danger;

    return ButtonStyle.Primary;
  }
}
