import { Component } from '@angular/core';
import { VCardComponent } from '@app/shared/ui/v-card/v-card.component';

@Component({
  selector: 'app-ui-showcase',
  templateUrl: './ui-showcase.component.html',
  styleUrl: './ui-showcase.component.css',
  standalone: true,
  imports: [VCardComponent],
})
export class UiShowcaseComponent {
  constructor() {}
}
