import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

export const slideInOutAnimation = trigger('slideInOutAnimation', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0)' }),
    animate('0.2s ease', style({ opacity: 1, transform: 'scale(1)' })),
  ]),
  transition(':leave', [animate('0.2s ease', style({ opacity: 0, transform: 'scale(0)' }))]),
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'scale(0)' }),
        stagger('100ms', [animate('0.2s ease', style({ opacity: 1, transform: 'scale(1)' }))]),
      ],
      { optional: true }
    ),
    query(':leave', [stagger('100ms', [animate('0.2s ease', style({ opacity: 0, transform: 'scale(0)' }))])], {
      optional: true,
    }),
  ]),
]);
