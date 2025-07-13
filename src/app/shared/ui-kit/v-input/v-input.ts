import { CommonModule } from '@angular/common';
import { Component, ElementRef, forwardRef, input, output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let uniqueId = 0;

@Component({
  selector: 'v-input',
  templateUrl: './v-input.html',
  styleUrl: './v-input.css',
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VInput),
      multi: true,
    },
  ],
})
export class VInput implements ControlValueAccessor {
  @ViewChild('inputElement')
  public readonly inputElement!: ElementRef<HTMLInputElement>;

  public readonly label = input<string>('');
  public readonly placeholder = input<string>('');
  public readonly type = input<string>('text');
  public readonly disabled = input<boolean>(false);
  public readonly readonly = input<boolean>(false);
  public readonly required = input<boolean>(false);
  public readonly errorMessage = input<string>('');
  public readonly name = input<string>('');

  public readonly onInputChanged = output<Event>();
  public readonly onFocused = output<Event>();
  public readonly onBlurred = output<Event>();

  protected value: string = '';
  protected isFocused = false;
  protected readonly inputId = `v-input-${++uniqueId}`;

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  public writeValue(value: string): void {
    this.value = value || '';
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {}

  protected onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.onInputChanged.emit(event);
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
