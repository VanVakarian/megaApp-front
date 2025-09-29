import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, input, output, Self, viewChild } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { getValidationErrorMessage } from '@app/shared/ui-kit/v-input/validators';

type InputValue = string | number | null;

type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';

type FontSize = `${number}px` | `${number}rem` | `${number}em` | `${number}%`;

type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

type TextAlign = 'left' | 'right' | 'center';

export interface VInputConfig {
  isDisabled?: boolean;
  isReadonly?: boolean;
  type?: InputType;
  label?: string;
  placeholder?: string;
  errorMessage?: string;
  name?: string;
  fontSize?: FontSize;
  fontWeight?: FontWeight;
  textAlign?: TextAlign;
}

const DEFAULT_V_INPUT_CONFIG: Required<VInputConfig> = {
  isDisabled: false,
  isReadonly: false,
  type: 'text',
  label: '',
  placeholder: '',
  errorMessage: '',
  name: '',
  fontSize: '1rem',
  fontWeight: 400,
  textAlign: 'left',
};

let uniqueId = 0;

@Component({
  selector: 'v-input',
  templateUrl: './v-input.html',
  styleUrl: './v-input.css',
  imports: [CommonModule],
})
export class VInput implements ControlValueAccessor {
  public readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('inputElement');

  public readonly config = input<VInputConfig>({});

  public readonly onInputChanged = output<Event>();
  public readonly onFocused = output<Event>();
  public readonly onBlurred = output<Event>();

  protected readonly settings = computed(() => ({
    ...DEFAULT_V_INPUT_CONFIG,
    ...this.config(),
  }));

  protected readonly cssFontWeight = computed(() => String(this.settings().fontWeight));
  protected readonly cssFontSize = computed(() => String(this.settings().fontSize));

  protected value: string = '';
  protected isFocused = false;
  protected hasInteracted = false;
  protected readonly inputId = `v-input-${++uniqueId}`;

  constructor(
    @Self()
    public ngControl: NgControl,
  ) {
    this.ngControl.valueAccessor = this;
  }

  protected getErrorMessage(): string {
    if (!this.hasInteracted) return '';
    return this.settings().errorMessage || this.getValidationErrorMessage();
  }

  private getValidationErrorMessage(): string {
    const control = this.ngControl.control;
    if (!control || !control.errors) return '';

    const errorKey = Object.keys(control.errors)[0];
    const errorValue = control.errors[errorKey];

    return getValidationErrorMessage(errorKey, errorValue);
  }

  private onChange = (value: InputValue) => {};

  private onTouched = () => {};

  public writeValue(value: InputValue): void {
    this.value = value != null ? String(value) : '';
    this.hasInteracted = false;
  }

  public registerOnChange(fn: (value: InputValue) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {}

  protected onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.hasInteracted = true;
    const outputValue = this.convertToOutputValue(this.value);
    this.onChange(outputValue);
    this.onInputChanged.emit(event);
  }

  private convertToOutputValue(inputValue: string): InputValue {
    if (this.settings().type !== 'number' || inputValue.trim() === '') {
      return inputValue;
    }

    const numValue = Number(inputValue);
    return isNaN(numValue) ? inputValue : numValue;
  }

  protected onFocus(): void {
    this.isFocused = true;
    const event = new Event('focus');
    this.onFocused.emit(event);
  }

  protected onBlur(): void {
    this.isFocused = false;
    this.onTouched();
    const event = new Event('blur');
    this.onBlurred.emit(event);
  }

  public focus(): void {
    const element = this.inputElement();
    if (element) {
      element.nativeElement.focus();
    }
  }
}
