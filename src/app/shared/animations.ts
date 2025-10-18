import { animate, style, transition, trigger } from '@angular/animations';

export const slideInOutAnimation = trigger('slideInOut', [
  transition('void => right', [
    style({ transform: 'translateX(-100%)', opacity: 0 }),
    animate('150ms ease-in-out', style({ transform: 'translateX(0%)', opacity: 1 })),
  ]),
  transition('right => void', [
    style({ transform: 'translateX(0%)', opacity: 1 }),
    animate('150ms ease-in-out', style({ transform: 'translateX(100%)', opacity: 0 })),
  ]),
  transition('void => left', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate('150ms ease-in-out', style({ transform: 'translateX(0%)', opacity: 1 })),
  ]),
  transition('left => void', [
    style({ transform: 'translateX(0%)', opacity: 1 }),
    animate('150ms ease-in-out', style({ transform: 'translateX(-100%)', opacity: 0 })),
  ]),
]);

export const fadeScaleInAnimation = trigger('fadeScaleIn', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: 'scale(0.8) translateY(10px)',
    }),
    animate(
      '160ms ease-out',
      style({
        opacity: 1,
        transform: 'scale(1) translateY(0px)',
      }),
    ),
  ]),
]);
