import { Directive, effect, EffectRef, ElementRef, Host, HostListener, input, OnDestroy, OnInit } from '@angular/core';
import { AccordionService } from './accordion.service';
import { VExpand } from './v-expand';

@Directive({
  selector: '[accordion]',
  host: {
    '[class.open]': 'isOpen',
  },
})
export class AccordionDirective implements OnInit, OnDestroy {
  public readonly accordion = input<string | boolean>(true);

  // private isOpen = false;
  private id = crypto.randomUUID();
  private groupId = 'default';

  private readonly syncEffectRef$$: EffectRef = effect(() => {
    const accordionValue = this.accordion();
    const groupId = typeof accordionValue === 'string' ? accordionValue : 'default';
    this.groupId = groupId;

    const opened = this.accordionService.openedIds$$();
    const isOpen = opened.get(groupId) === this.id;
    // this.isOpen = isOpen;
    this.vExpand.setExpanded(isOpen);
  });

  constructor(
    private accordionService: AccordionService,
    private el: ElementRef,
    @Host()
    private vExpand: VExpand,
  ) {}

  public ngOnInit() {
    const accordionValue = this.accordion();
    this.groupId = typeof accordionValue === 'string' ? accordionValue : 'default';
  }

  public ngOnDestroy() {
    this.syncEffectRef$$.destroy();
  }

  @HostListener('click', ['$event'])
  private toggle(event: Event) {
    const target = event.target as HTMLElement;
    const headerElement = this.el.nativeElement.querySelector('.header');

    if (headerElement && headerElement.contains(target)) {
      const accordionValue = this.accordion();
      const groupId = typeof accordionValue === 'string' ? accordionValue : 'default';
      this.accordionService.toggle(groupId, this.id);
    }
  }

  private setVExpandState(expanded: boolean) {
    this.vExpand.setExpanded(expanded);
  }
}
