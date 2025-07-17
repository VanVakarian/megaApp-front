import { NgStyle } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { BMIComponent } from '@app/components/food/diary/bmi/bmi.component';
import { InnerShadowDirective, OuterShadowDirective } from '@app/shared/ui-kit/shadow.directive';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { DropdownItem, VDropdown } from '@app/shared/ui-kit/v-dropdown/v-dropdown';
import { AccordionDirective } from '@app/shared/ui-kit/v-expand/accordion.directive';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.scss',
  imports: [
    NgStyle,
    VCard,
    VExpand,
    VDropdown,
    VInput,
    BMIComponent,
    OuterShadowDirective,
    InnerShadowDirective,
    AccordionDirective,
  ],
})
export class Food implements OnInit {
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
  protected readonly todaysKcalsPercent = 80.6;

  constructor() {}

  public ngOnInit(): void {}

  protected onFoodItemChange(item: DropdownItem | null): void {
    if (item) {
      this.selectedFoodItem = item.value;
      console.log('Selected food item:', item);
    } else {
      console.log('No item selected');
    }
  }

  protected setBackgroundStyle(percent: number) {
    const percentCapped = percent <= 100 ? percent : 100;
    return {
      background: `linear-gradient(to right, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
    };
  }
}
