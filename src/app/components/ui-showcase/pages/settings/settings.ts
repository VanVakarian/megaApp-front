import { Component } from '@angular/core';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';

@Component({
  selector: 'settings',
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  imports: [VCard],
})
export class Settings {}
