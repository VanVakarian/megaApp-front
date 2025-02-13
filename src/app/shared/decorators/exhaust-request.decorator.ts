import { Observable, finalize } from 'rxjs';

export function exhaustRequest() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let running = false;

    descriptor.value = function (...args: any[]): Observable<any> {
      return new Observable((subscriber) => {
        if (running) {
          subscriber.complete();
          return;
        }

        running = true;

        const subscription = originalMethod
          .apply(this, args)
          .pipe(
            finalize(() => {
              running = false;
            }),
          )
          .subscribe(subscriber);

        return () => subscription.unsubscribe();
      });
    };

    return descriptor;
  };
}
