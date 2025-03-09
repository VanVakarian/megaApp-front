import { Directive } from '@angular/core';

@Directive({
  selector: '[pieStyle]',
  standalone: true,
})
export class PieStyleDirective {
  constructor() {}
}

@Directive({
  selector: '[circleStyle]',
  standalone: true,
})
export class CircleStyleDirective {
  constructor() {}
}
