import { CommonModule } from '@angular/common';
import { Component, ElementRef, forwardRef, input, output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'v-input',
  templateUrl: './v-input.component.html',
  styleUrl: './v-input.component.css',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VInputComponent),
      multi: true,
    },
  ],
})
export class VInputComponent implements ControlValueAccessor {
  @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;

  public readonly label = input<string>('');
  public readonly placeholder = input<string>('');
  public readonly type = input<string>('text');
  public readonly disabled = input<boolean>(false);
  public readonly readonly = input<boolean>(false);
  public readonly required = input<boolean>(false);
  public readonly errorMessage = input<string>('');

  public readonly onInputChanged = output<Event>();
  public readonly onFocused = output<Event>();
  public readonly onBlurred = output<Event>();

  public value: string = '';
  public isFocused = false;

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  public writeValue(value: string): void {
    console.log('writeValue called with:', value);
    this.value = value || '';
  }

  public registerOnChange(fn: (value: string) => void): void {
    console.log('registerOnChange called');
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    console.log('registerOnTouched called');
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    console.log('setDisabledState called with:', isDisabled);
  }

  protected onInputChange(event: Event): void {
    console.log('onInputChange called with:', event);
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.onInputChanged.emit(event);
  }

  protected onFocus(): void {
    console.log('onFocus called');
    this.isFocused = true;
    const event = new Event('focus');
    this.onFocused.emit(event);
  }

  protected onBlur(): void {
    console.log('onBlur called');
    this.isFocused = false;
    this.onTouched();
    const event = new Event('blur');
    this.onBlurred.emit(event);
  }

  public focus(): void {
    console.log('focus called');
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }
}
