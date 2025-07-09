import { Component } from '@angular/core';
import { ShadowDirective } from '@app/shared/ui-kit/shadow.directive';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { AccordionDirective } from '@app/shared/ui-kit/v-expand/accordion.directive';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.css',
  imports: [VCard, VExpand, ShadowDirective, AccordionDirective],
})
export class Food {}
