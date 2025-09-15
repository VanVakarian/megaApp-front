import { Component } from '@angular/core';
import { IconName } from '@app/shared/ui-kit/types';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { VIcon } from '@app/shared/ui-kit/v-icon/v-icon';

@Component({
  selector: 'icons',
  templateUrl: './icons.html',
  styleUrl: './icons.css',
  imports: [VCard, VIcon],
})
export class Icons {
  protected readonly iconNames = Object.values(IconName);

  constructor() {}
}
