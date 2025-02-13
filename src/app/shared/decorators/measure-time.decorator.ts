import { toKebabCase } from '../utils';

function formLogEntry(time: number, propertyKey: string, fileName: string, isGetter = false): void {
  const timeStyle = 'background: black; color: #00ff00; font-weight: bold; padding: 2px 4px; border-radius: 2px;';
  const formattedTime = `%c${ time.toFixed(2) }%c`;
  const prefix = isGetter ? 'get ' : '';
  console.log(`It took ${ formattedTime } ms to execute ${ prefix }[${ propertyKey }] in [${ fileName }]`, timeStyle, '');
}

export function LogExecutionTime() {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value || descriptor.get;
    const className = target.constructor.name;
    const fileName = toKebabCase(className);

    if (descriptor.value) { // in case of method
      descriptor.value = function(...args: any[]) {
        const startTime = performance.now();
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.finally(() => {
            formLogEntry(performance.now() - startTime, propertyKey, fileName);
          });
        }

        formLogEntry(performance.now() - startTime, propertyKey, fileName);
        return result;
      };

    } else if (descriptor.get) { // in case of getter
      descriptor.get = function() {
        const startTime = performance.now();
        const result = originalMethod.apply(this);
        formLogEntry(performance.now() - startTime, propertyKey, fileName, true);
        return result;
      };
    }

    return descriptor;
  };
}
