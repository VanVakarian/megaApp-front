export function cached(timeout: number = 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    let cache: {
      promise: Promise<any>;
      timestamp: number;
    } | null = null;

    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const now = Date.now();

      if (cache && now - cache.timestamp < timeout) {
        return cache.promise;
      }

      const promise = originalMethod.apply(this, args);
      cache = {
        promise,
        timestamp: now,
      };

      setTimeout(() => {
        cache = null;
      }, timeout);

      return promise;
    };

    return descriptor;
  };
}
