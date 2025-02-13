import { Directive, ElementRef, Input, OnDestroy } from '@angular/core';

import { DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER } from '@app/shared/const';

export enum AnimationState {
  IDLE = 'idle',
  COUNTDOWN = 'countdown',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error',
}

export class AnimationStateManager {
  constructor(
    private currentState: AnimationState,
    private onChange: (state: AnimationState) => void,
  ) {}

  toIdle() {
    this.transition(AnimationState.IDLE);
  }
  toCountdown() {
    this.transition(AnimationState.COUNTDOWN);
  }
  toSubmitting() {
    this.transition(AnimationState.SUBMITTING);
  }
  toSuccess() {
    this.transition(AnimationState.SUCCESS);
  }
  toError() {
    this.transition(AnimationState.ERROR);
  }

  private transition(state: AnimationState) {
    this.onChange(state);
  }
}

@Directive({
  selector: '[fieldStateAnimations]',
  standalone: true,
})
export class FieldStateAnimationsDirective implements OnDestroy {
  @Input()
  public set state(value: AnimationState) {
    this.setState(value);
  }

  private currentState: AnimationState = AnimationState.IDLE;
  private transitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private element: HTMLElement;

  constructor(el: ElementRef) {
    this.element = el.nativeElement;
  }

  public ngOnDestroy() {
    this.clearTimeout();
  }

  private setState(newState: AnimationState) {
    this.clearTimeout();
    this.clearStateClass(this.currentState);
    this.currentState = newState;
    this.addStateClass(newState);

    if ([AnimationState.SUCCESS, AnimationState.ERROR].includes(newState)) {
      this.transitionTimeoutId = setTimeout(() => {
        this.currentState = AnimationState.IDLE;
        this.clearStateClass(AnimationState.SUCCESS);
        this.clearStateClass(AnimationState.ERROR);
        this.addStateClass(AnimationState.IDLE);
      }, DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER);
    }
  }

  private clearStateClass(className: AnimationState) {
    this.element.classList.remove(`${className}-state`);
  }

  private addStateClass(className: AnimationState) {
    this.element.classList.add(`${className}-state`);
  }

  private clearTimeout() {
    if (this.transitionTimeoutId) {
      clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }
  }
}
