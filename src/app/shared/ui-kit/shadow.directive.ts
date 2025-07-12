import { Directive, ElementRef, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[outer-shadow]',
})
export class OuterShadowDirective implements OnInit {
  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  public ngOnInit() {
    const element = this.el.nativeElement;

    this.renderer.setStyle(
      element,
      'box-shadow',
      ` 3px 3px 6px var(--shadow-dark-light),
        -3px -3px 6px var(--shadow-light-strong) `,
    );
    this.renderer.setStyle(element, 'border-radius', 'var(--unit-2)');
  }
}

@Directive({
  selector: '[inner-shadow]',
})
export class InnerShadowDirective implements OnInit {
  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  public ngOnInit() {
    const element = this.el.nativeElement;

    this.renderer.setStyle(
      element,
      'box-shadow',
      ` inset 3px 3px 3px var(--shadow-dark-light),
        inset -3px -3px 3px var(--shadow-light-strong) `,
    );
    this.renderer.setStyle(element, 'border-radius', 'var(--unit-2)');
  }
}
