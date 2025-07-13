import { Component } from '@angular/core';
import { InnerShadowDirective, OuterShadowDirective } from '@app/shared/ui-kit/shadow.directive';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { DropdownItem, VDropdown } from '@app/shared/ui-kit/v-dropdown/v-dropdown';
import { AccordionDirective } from '@app/shared/ui-kit/v-expand/accordion.directive';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.css',
  imports: [VCard, VExpand, VDropdown, VInput, OuterShadowDirective, InnerShadowDirective, AccordionDirective],
})
export class Food {
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

  constructor() {}

  protected onFoodItemChange(item: DropdownItem | null): void {
    if (item) {
      this.selectedFoodItem = item.value;
      console.log('Selected food item:', item);
    } else {
      console.log('No item selected');
    }
  }
}
