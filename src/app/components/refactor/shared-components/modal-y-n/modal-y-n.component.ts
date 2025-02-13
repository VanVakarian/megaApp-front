import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-y-n',
  templateUrl: './modal-y-n.component.html',
})
export class ModalYNComponent {
  @Input() isOpen: boolean = false;
  @Input() actionQuestion: string = '';
  @Output() confirmed = new EventEmitter<boolean>();

  confirm() {
    this.confirmed.emit(true);
    this.isOpen = false;
  }

  cancel() {
    this.confirmed.emit(false);
    this.isOpen = false;
  }
}
