import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';

@Component({
  selector: 'v-card',
  templateUrl: './v-card.component.html',
  styleUrl: './v-card.component.scss',
  standalone: true,
})
export class VCardComponent {
  @Input() elevation: number = 1;
  @Input() outlined: boolean = false;
  @Input() hoverable: boolean = false;
  @Input() fullWidth: boolean = false;
  @Input() noPadding: boolean = false;
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;

  @Output() cardClick = new EventEmitter<MouseEvent>();

  @HostBinding('class.disabled') get isDisabled() {
    return this.disabled;
  }
  @HostBinding('class.full-width') get isFullWidth() {
    return this.fullWidth;
  }
  @HostBinding('class.hoverable') get isHoverable() {
    return this.hoverable;
  }
  @HostBinding('class.outlined') get isOutlined() {
    return this.outlined;
  }
  @HostBinding('class.no-padding') get hasNoPadding() {
    return this.noPadding;
  }
  @HostBinding('class') get elevationClass() {
    return `elevation-${this.elevation}`;
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.cardClick.emit(event);
    }
  }
}
