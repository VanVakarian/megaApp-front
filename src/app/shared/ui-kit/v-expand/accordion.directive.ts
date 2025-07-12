import { Directive, ElementRef, HostListener, OnDestroy, OnInit, input } from '@angular/core';
import { AccordionService } from './accordion.service';

@Directive({
  selector: '[accordion]',
  host: {
    '[class.open]': 'isOpen',
  },
})
export class AccordionDirective implements OnInit, OnDestroy {
  public readonly accordion = input<string | boolean>(true);

  private isOpen = false;
  private id = crypto.randomUUID();
  private groupId = 'default';

  constructor(
    private accordionService: AccordionService,
    private el: ElementRef,
  ) {}

  public ngOnInit() {
    const accordionValue = this.accordion();
    this.groupId = typeof accordionValue === 'string' ? accordionValue : 'default';

    this.accordionService.register(this.groupId, this.id, () => {
      this.isOpen = false;
      this.setVExpandState(false);
    });
  }

  public ngOnDestroy() {
    this.accordionService.unregister(this.groupId, this.id);
  }

  @HostListener('click', ['$event'])
  private toggle(event: Event) {
    const target = event.target as HTMLElement;
    const headerElement = this.el.nativeElement.querySelector('.header');

    if (headerElement && headerElement.contains(target)) {
      this.accordionService.toggle(this.groupId, this.id);
      this.isOpen = this.accordionService.isOpen(this.groupId, this.id);
      this.setVExpandState(this.isOpen);
    }
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
