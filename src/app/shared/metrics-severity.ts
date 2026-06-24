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

export function severityColor(severity: MetricsHealthSeverity | null): string {
  switch (severity) {
    case 'ok':
      return '#22c55e';
    case 'warn':
      return '#eab308';
    case 'error':
      return '#ef4444';
    default:
      return '#9ca3af';
  }
}
