import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BMI } from '@app/components/food/diary/bmi/bmi';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { ddExpandDirection, DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { AccordionDirective } from '@ui-kit/components/v-expand/accordion.directive';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { weightValidator } from '@ui-kit/components/v-input/validators';
import {
  InnerShadowRoundedDirective,
  OuterShadowRoundedDirective,
} from '@ui-kit/directives/shadow.directive';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.scss',
  imports: [
    ReactiveFormsModule,
    VCard,
    VExpand,
    VDropdown,
    VInput,
    BMI,
    OuterShadowRoundedDirective,
    InnerShadowRoundedDirective,
    AccordionDirective,
    VButton,
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

  protected readonly ddExpandDirection = ddExpandDirection;
  protected readonly todaysKcalsPercent = 80.6;
  protected selectedFoodItem: string = '';
  protected readonly form = new FormGroup({
    weight: new FormControl<number | null>(null, [Validators.required, weightValidator()]),
    test01: new FormControl(''),
    // test02: new FormControl(''),
    // test03: new FormControl(''),
  });

  protected isHiddenPanelExpanded = false;

  constructor() {}

  public ngOnInit(): void {}

  protected toggleHiddenPanel(): void {
    this.isHiddenPanelExpanded = !this.isHiddenPanelExpanded;
  }

  protected onFoodItemChange(item: DropdownItem | null): void {
    if (item) {
      this.selectedFoodItem = item.value;
      console.log('Selected food item:', item);
    } else {
      console.log('No item selected');
    }
  }

  protected setBackgroundStyle(percent: number): string {
    const percentCapped = percent <= 100 ? percent : 100;
    return `linear-gradient(to right, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`;
  }
}
