import { Directive, ElementRef, OnDestroy, OnInit, effect, input } from '@angular/core';

@Directive({
  selector: '[fitTextOnOverflow]',
})
export class FitTextOnOverflowDirective implements OnInit, OnDestroy {
  public readonly fullText = input.required<string>();
  public readonly shortText = input.required<string>();

  private readonly element: HTMLElement;
  private isInitialized = false;
  private resizeObserver?: ResizeObserver;
  private rafId: number | null = null;
  private windowResizeListener?: () => void;

  private readonly inputsEffect = effect(() => {
    this.fullText();
    this.shortText();

    if (!this.isInitialized) return;

    this.scheduleUpdate();
  });

  constructor(el: ElementRef<HTMLElement>) {
    this.element = el.nativeElement;
  }

  public ngOnInit(): void {
    this.isInitialized = true;
    this.setupResizeObserver();
    this.scheduleUpdate();
  }

  public ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
      this.windowResizeListener = undefined;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      this.windowResizeListener = () => this.scheduleUpdate();
      window.addEventListener('resize', this.windowResizeListener);
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleUpdate();
    });

    this.resizeObserver.observe(this.element);
  }

  private scheduleUpdate(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateText();
    });
  }

  private updateText(): void {
    const fullText = this.fullText();
    const shortText = this.shortText();

    if (this.element.textContent !== fullText) {
      this.element.textContent = fullText;
    }

    const isOverflowing = this.element.scrollWidth > this.element.clientWidth;
    const nextText = isOverflowing ? shortText : fullText;

    if (this.element.textContent !== nextText) {
      this.element.textContent = nextText;
    }
  }
}
