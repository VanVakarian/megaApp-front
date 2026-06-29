import { MetricsHealthSeverity } from '@app/shared/types';

export interface SeverityThresholds {
  warnAfterSeconds: number;
  errorAfterSeconds: number;
}

export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  warnAfterSeconds: 90,
  errorAfterSeconds: 180,
};

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
