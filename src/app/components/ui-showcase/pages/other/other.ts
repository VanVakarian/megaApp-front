import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconName } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { ddExpandDirection, DropdownItem, VDropdown } from '@app/shared/ui-kit/v-dropdown/v-dropdown';
import { VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { InputType, VInput } from '@app/shared/ui-kit/v-input/v-input';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';

@Component({
  selector: 'other',
  templateUrl: './other.html',
  styleUrl: './other.css',
  imports: [VCard, VInput, VButton, VModal, VDropdown, VIcon, ReactiveFormsModule],
})
export class Other implements AfterViewInit, OnInit {
  @ViewChild('testInput')
  protected inputComponent!: VInput;
  protected InputType = InputType;
  protected isModalOpen = false;
  protected form = new FormGroup({
    testInput: new FormControl(''),
    username: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', Validators.required),
    disabled: new FormControl({ value: '', disabled: true }),
    error: new FormControl('', Validators.required),
  });

  protected readonly foodItems = [
    { label: 'Pizza', value: 'pizza' },
    { label: 'Burger', value: 'burger' },
    { label: 'Sushi', value: 'sushi' },
    { label: 'Pasta', value: 'pasta' },
    { label: 'Salad', value: 'salad' },
    { label: 'Dessert', value: 'dessert' },
    { label: 'Beverage', value: 'beverage' },
  ];
  protected selectedFoodItem: string = '';
  protected readonly ddExpandDirection = ddExpandDirection;
  protected isShowLongContent = false;

  protected readonly IconName = IconName;

  constructor() {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.inputComponent.writeValue('Some value');
    });
  }

  protected openModal(): void {
    this.isModalOpen = true;
  }

  protected closeModal(): void {
    this.isModalOpen = false;
  }

  protected onFoodItemChange(item: DropdownItem | null): void {
    if (item) {
      this.selectedFoodItem = item.value;
      console.log('Selected food item:', item);
    } else {
      console.log('No item selected');
    }
  }
}
