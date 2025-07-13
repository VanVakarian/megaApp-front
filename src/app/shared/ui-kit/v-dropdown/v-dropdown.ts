import { CommonModule } from '@angular/common';
import { Component, ElementRef, forwardRef, input, output, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { VInput } from '../v-input/v-input';

export interface DropdownItem {
  value: string;
  label: string;
}

@Component({
  selector: 'v-dropdown',
  templateUrl: './v-dropdown.html',
  styleUrl: './v-dropdown.css',
  imports: [CommonModule, VInput, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VDropdown),
      multi: true,
    },
  ],
})
export class VDropdown implements ControlValueAccessor {
  @ViewChild('inputComponent')
  protected readonly inputComponent!: VInput;

  public readonly label = input<string>('');
  public readonly placeholder = input<string>('');
  public readonly isDisabled = input<boolean>(false);
  public readonly isRequired = input<boolean>(false);
  public readonly errorMessage = input<string>('');
  public readonly items = input<DropdownItem[]>([]);
  public readonly minDropdownWidth = input<string>('');
  public readonly expandDirection = input<'left' | 'right'>('left');

  public readonly onSelectionChanged = output<DropdownItem | null>();

  protected value: string = '';
  protected isOpen = false;
  protected filteredItems: DropdownItem[] = [];
  protected validationError: string = '';
  protected dropdownWidth = 0;

  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(private elementRef: ElementRef) {}

  protected get computedErrorMessage(): string {
    if (this.isOpen) {
      return this.errorMessage();
    }
    return this.validationError || this.errorMessage();
  }

  protected get dropdownListStyles(): { [key: string]: string } {
    const styles: { [key: string]: string } = {};

    if (this.dropdownWidth > 0) {
      styles['width'] = `${this.dropdownWidth}px`;
    } else if (this.minDropdownWidth()) {
      styles['min-width'] = this.minDropdownWidth();
    }

    return styles;
  }

  public writeValue(value: string): void {
    this.value = value || '';
    this.updateFilteredItems();
    this.validateInput();
    if (this.inputComponent) {
      this.inputComponent.writeValue(this.value);
    }
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
    this.updateFilteredItems();
    this.isOpen = true;
  }

  protected onFocus(): void {
    this.isOpen = true;
    this.updateFilteredItems();
    this.setDropdownWidth();
  }

  protected onBlur(): void {
    setTimeout(() => {
      this.isOpen = false;
      this.validateInput();
      this.onTouched();
    }, 150);
  }

  protected selectItem(item: DropdownItem): void {
    this.value = item.label;
    this.validationError = '';
    this.onChange(item.value);
    this.onSelectionChanged.emit(item);
    this.isOpen = false;
    if (this.inputComponent) {
      this.inputComponent.writeValue(this.value);
      this.inputComponent.inputElement.nativeElement.blur();
    }
  }

  protected clearInput(): void {
    this.value = '';
    this.validationError = '';
    this.onChange('');
    this.onSelectionChanged.emit(null);
    this.updateFilteredItems();
    if (this.inputComponent) {
      this.inputComponent.writeValue(this.value);
    }
  }

  private updateFilteredItems(): void {
    if (!this.value.trim()) {
      this.filteredItems = this.items();
    } else {
      this.filteredItems = this.items().filter((item) => item.label.toLowerCase().includes(this.value.toLowerCase()));
    }
  }

  private validateInput(): void {
    if (!this.isRequired() || !this.value.trim()) {
      this.validationError = '';
      return;
    }

    const exactMatch = this.items().find((item) => item.label.toLowerCase() === this.value.toLowerCase());

    if (!exactMatch) {
      this.validationError = 'Please select a valid option from the list';
    } else {
      this.validationError = '';
    }
  }

  private setDropdownWidth(): void {
    if (!this.elementRef?.nativeElement) {
      return;
    }

    setTimeout(() => {
      const hostElement = this.elementRef.nativeElement;
      const hostRect = hostElement.getBoundingClientRect();
      const minWidthValue = this.minDropdownWidth() ? parseInt(this.minDropdownWidth().replace(/[^\d]/g, '')) || 0 : 0;
      this.dropdownWidth = Math.max(hostRect.width, minWidthValue);
    }, 0);
  }
}
