import { afterNextRender, Component, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { ddExpandDirection, DropdownItem, VDropdown } from '@app/shared/ui-kit/v-dropdown/v-dropdown';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';
import { ProgressBarStyle, VProgress } from '@app/shared/ui-kit/v-progress/v-progress';

@Component({
  selector: 'other',
  templateUrl: './other.html',
  imports: [VCard, VInput, VButton, VModal, VDropdown, VIcon, ReactiveFormsModule, VProgress],
})
export class Other {
  protected readonly ProgressBarStyle = ProgressBarStyle;
  protected readonly inputComponent = viewChild.required<VInput>('testInput');

  protected isModalOpen = false;
  protected isShowLongContent = false;
  protected selectedFoodItem = '';

  protected readonly form = new FormGroup({
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

  protected readonly ddExpandDirection = ddExpandDirection;
  protected readonly Icon = IconName;

  constructor() {
    afterNextRender(() => {
      this.inputComponent().writeValue('Some value');
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

  protected consoleLogFormValue(): void {
    console.log(this.form.value);
  }
}
