import { Directive } from '@angular/core';

@Directive({
  selector: '[pieStyle]',
})
export class PieStyleDirective {
  constructor() {}
}

@Directive({
  selector: '[circleStyle]',
})
export class CircleStyleDirective {
  constructor() {}
}
