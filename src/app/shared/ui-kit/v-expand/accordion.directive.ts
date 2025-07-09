import { Directive, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AccordionService } from './accordion.service';

@Directive({
  selector: '[accordion]',
  host: {
    '[class.open]': 'isOpen',
  },
})
export class AccordionDirective implements OnInit, OnDestroy {
  private isOpen = false;
  private id = crypto.randomUUID();

  constructor(
    private accordion: AccordionService,
    private el: ElementRef,
  ) {}

  public ngOnInit() {
    this.accordion.register(this.id, () => {
      this.isOpen = false;
      this.setVExpandState(false);
    });
  }

  public ngOnDestroy() {
    this.accordion.unregister(this.id);
  }

  @HostListener('click')
  private toggle() {
    this.accordion.toggle(this.id);
    this.isOpen = this.accordion.isOpen(this.id);
    this.setVExpandState(this.isOpen);
  }

  private setVExpandState(expanded: boolean) {
    const bodyElement = this.el.nativeElement.querySelector('v-expand .body');
    if (bodyElement) {
      if (expanded) {
        bodyElement.classList.add('expanded');
      } else {
        bodyElement.classList.remove('expanded');
      }
    }
  }
}
