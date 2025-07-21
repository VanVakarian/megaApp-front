import { CommonModule } from '@angular/common';
import { Component, ElementRef, input, output, Self, ViewChild } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { getValidationErrorMessage } from '@app/shared/ui-kit/v-input/validators';

export enum InputType {
  Text = 'text',
  Password = 'password',
  Email = 'email',
  Number = 'number',
  Tel = 'tel',
  Url = 'url',
}

type InputValue = string | number | null;

let uniqueId = 0;

@Component({
  selector: 'v-input',
  templateUrl: './v-input.html',
  styleUrl: './v-input.css',
  imports: [CommonModule],
})
export class VInput implements ControlValueAccessor {
  @ViewChild('inputElement')
  public readonly inputElement!: ElementRef<HTMLInputElement>;

  public readonly isDisabled = input<boolean>(false);
  public readonly isReadonly = input<boolean>(false);

  public readonly type = input<string>(InputType.Text);
  public readonly label = input<string>('');
  public readonly placeholder = input<string>('');
  public readonly errorMessage = input<string>('');
  public readonly name = input<string>('');

  public readonly onInputChanged = output<Event>();
  public readonly onFocused = output<Event>();
  public readonly onBlurred = output<Event>();

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
    return this.errorMessage() || this.getValidationErrorMessage();
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
  }

  private convertToOutputValue(inputValue: string): InputValue {
    if (this.type() !== InputType.Number || inputValue.trim() === '') {
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
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }
}
