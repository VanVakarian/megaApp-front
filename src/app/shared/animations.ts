import { animate, style, transition, trigger } from '@angular/animations';

export const ANIMATION_DURATION_MS = {
  FAST: 125,
  MEDIUM: 250,
  SLOW: 400,
} as const;

export const ANIMATION_DURATION_MS_STRING = {
  FAST: `${ANIMATION_DURATION_MS.FAST}ms`,
  MEDIUM: `${ANIMATION_DURATION_MS.MEDIUM}ms`,
  SLOW: `${ANIMATION_DURATION_MS.SLOW}ms`,
} as const;

export const slideInOutAnimation = trigger('slideInOut', [
  transition('void => right', [
    style({ transform: 'translateX(-100%)', opacity: 0 }),
    animate(`${ANIMATION_DURATION_MS_STRING.FAST} ease-in-out`, style({ transform: 'translateX(0%)', opacity: 1 })),
  ]),
  transition('right => void', [
    style({ transform: 'translateX(0%)', opacity: 1 }),
    animate(`${ANIMATION_DURATION_MS_STRING.FAST} ease-in-out`, style({ transform: 'translateX(100%)', opacity: 0 })),
  ]),
  transition('void => left', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate(`${ANIMATION_DURATION_MS_STRING.FAST} ease-in-out`, style({ transform: 'translateX(0%)', opacity: 1 })),
  ]),
  transition('left => void', [
    style({ transform: 'translateX(0%)', opacity: 1 }),
    animate(`${ANIMATION_DURATION_MS_STRING.FAST} ease-in-out`, style({ transform: 'translateX(-100%)', opacity: 0 })),
  ]),
]);

export const fadeScaleInAnimation = trigger('fadeScaleIn', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: 'scale(0.8) translateY(10px)',
    }),
    animate(
      `${ANIMATION_DURATION_MS_STRING.MEDIUM} ease-out`,
      style({
        opacity: 1,
        transform: 'scale(1) translateY(0px)',
      }),
    ),
  ]),
]);
