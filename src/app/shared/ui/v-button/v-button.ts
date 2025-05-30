import { Component, output } from '@angular/core';

@Component({
  selector: 'v-button[flat], v-button[raised], v-button[primary]',
  templateUrl: './v-button.html',
  styleUrl: './v-button.css',
  standalone: true,
})
export class VButton {
  public readonly onClick = output<MouseEvent>();

  protected onButtonClick(event: MouseEvent): void {
    this.onClick.emit(event);
  }
}
