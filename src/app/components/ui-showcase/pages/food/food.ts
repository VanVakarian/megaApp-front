import { Component } from '@angular/core';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.css',
  imports: [VCard, VExpand],
})
export class Food {}
