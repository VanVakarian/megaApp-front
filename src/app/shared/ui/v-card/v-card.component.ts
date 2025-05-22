import { Component, output } from '@angular/core';

@Component({
  selector: 'v-card',
  templateUrl: './v-card.component.html',
  styleUrl: './v-card.component.css',
  standalone: true,
})
export class VCardComponent {
  public readonly onCardclick = output<MouseEvent>();

  onClick(event: MouseEvent): void {
    this.onCardclick.emit(event);
  }
}
