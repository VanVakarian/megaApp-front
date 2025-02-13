export function throttled(delay: number = 100) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    let lastCall = 0;
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
