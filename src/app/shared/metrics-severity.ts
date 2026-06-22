import { MetricsHealthSeverity } from '@app/shared/types';

export function severityDotClass(severity: MetricsHealthSeverity | null): string {
  switch (severity) {
    case 'ok':
      return 'bg-green-500';
    case 'warn':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

export function severityLabel(severity: MetricsHealthSeverity): string {
  switch (severity) {
    case 'ok':
      return 'Норма';
    case 'warn':
      return 'Внимание';
    case 'error':
      return 'Ошибка';
  }
}
