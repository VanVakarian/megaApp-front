import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  forwardRef,
  Inject,
  input,
  OnDestroy,
  OnInit,
  Optional,
  output,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { VBackdropDirective } from '@app/shared/ui-kit/backdrop.directive';
import { VInput, VInputConfig } from '@app/shared/ui-kit/v-input/v-input';
import { LayerController, PARENT_LAYER_ID, ZLayerService } from '@app/shared/ui-kit/z-layer.service';

export enum ddExpandDirection {
  Left = 'left',
  Right = 'right',
}

export interface DropdownItem {
  value: string;
  label: string;
}

@Component({
  selector: 'v-dropdown',
  templateUrl: './v-dropdown.html',
  styleUrl: './v-dropdown.css',
  host: {
    '[style.--v-dropdown-z-index]': 'zIndex',
    '[style.--v-dropdown-backdrop-z-index]': 'backdropZIndex',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VDropdown),
      multi: true,
    },
  ],
  imports: [CommonModule, VInput, ReactiveFormsModule, VBackdropDirective],
})
export class VDropdown implements ControlValueAccessor, OnInit, OnDestroy {
  public readonly label = input<string>('');
  public readonly placeholder = input<string>('');
  public readonly isDisabled = input<boolean>(false);
  public readonly isRequired = input<boolean>(false);
  public readonly errorMessage = input<string>('');
  public readonly items = input<DropdownItem[]>([]);
  public readonly minDropdownWidth = input<string>('');
  public readonly expandDirection = input<ddExpandDirection>(ddExpandDirection.Left);

  public readonly onSelectionChanged = output<DropdownItem | null>();

  protected readonly inputComponent = viewChild.required<VInput>('inputComponent');

  protected readonly inputConfig$$ = computed<VInputConfig>(() => ({
    label: this.label(),
    placeholder: this.placeholder(),
    isDisabled: this.isDisabled(),
    errorMessage: this.computedErrorMessage,
  }));

  protected value: string = '';
  protected isOpen = false;
  protected filteredItems: DropdownItem[] = [];
  protected validationError: string = '';
  protected dropdownWidth = 0;
  protected zIndex = 100;
  protected backdropZIndex = 90;
  protected readonly internalForm = new FormGroup({
    search: new FormControl(''),
  });

  private onChange = (value: string) => {};
  private onTouched = () => {};
  private layerController?: LayerController;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly zLayerService: ZLayerService,
    @Optional()
    @Inject(PARENT_LAYER_ID)
    private readonly parentLayerId?: string,
  ) {
    this.internalForm.get('search')?.valueChanges.subscribe((value) => {
      this.value = value || '';
      this.onChange(this.value);
      this.updateFilteredItems();
      this.isOpen = true;
    });
  }

  public ngOnInit(): void {
    this.registerLayer();
  }

  public ngOnDestroy(): void {
    this.layerController?.destroy();
  }

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

  public writeValue(value: string | null): void {
    this.value = value || '';
    this.internalForm.get('search')?.setValue(this.value, { emitEvent: false });
    this.updateFilteredItems();
    this.validateInput();
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {}

  protected onFocus(): void {
    this.isOpen = true;
    this.updateFilteredItems();
    this.setDropdownWidth();
  }

  protected onBlur(): void {
    setTimeout(() => {
      this.closeDropdown();
    }, 150);
  }

  protected selectItem(item: DropdownItem): void {
    this.value = item.label;
    this.validationError = '';
    this.internalForm.get('search')?.setValue(this.value, { emitEvent: false });
    this.onChange(item.value);
    this.onSelectionChanged.emit(item);
    this.isOpen = false;
    const inputComp = this.inputComponent();
    if (inputComp) {
      const element = inputComp.inputElement();
      if (element) {
        element.nativeElement.blur();
      }
    }
  }

  protected clearInput(): void {
    this.value = '';
    this.validationError = '';
    this.internalForm.get('search')?.setValue('', { emitEvent: false });
    this.onChange('');
    this.onSelectionChanged.emit(null);
    this.updateFilteredItems();
  }

  protected closeDropdown(): void {
    this.isOpen = false;
    this.validateInput();
    this.onTouched();
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

  private registerLayer(): void {
    this.layerController = this.zLayerService.registerLayer('dropdown', this.parentLayerId);
    this.zIndex = this.layerController.zIndex;
    this.backdropZIndex = this.layerController.getBackdropZIndex();
  }
}
