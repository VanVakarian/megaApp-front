import { Component } from '@angular/core';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';

@Component({
  selector: 'food',
  templateUrl: './food.html',
  styleUrl: './food.css',
  imports: [VCard],
})
export class Food {}
