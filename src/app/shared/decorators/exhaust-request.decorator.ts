import { Observable, finalize, shareReplay } from 'rxjs';

export function exhaustRequest() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let inFlightRequest$: Observable<any> | null = null;

    descriptor.value = function (...args: any[]): Observable<any> {
      if (inFlightRequest$) {
        return inFlightRequest$;
      }

      const request$ = originalMethod.apply(this, args).pipe(
        finalize(() => {
          inFlightRequest$ = null;
        }),
        shareReplay(1),
      );
      inFlightRequest$ = request$;
      return request$;
    };

    return descriptor;
  };
}
