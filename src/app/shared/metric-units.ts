export type MetricUnit = 'ratio' | 'bytes' | 'durationMs' | 'humanDuration' | 'money' | 'count';

const METRIC_UNIT_OVERRIDES: ReadonlyMap<string, MetricUnit> = new Map([
  ['load1', 'count'],
  ['load5', 'count'],
  ['load15', 'count'],
  ['free_cash', 'money'],
  ['estimated_open_positions_value', 'money'],
  ['estimated_account_value', 'money'],
  ['uptime_seconds', 'humanDuration'],
  ['recognition_cost_usd', 'money'],
]);

const METRIC_UNIT_SUFFIXES: ReadonlyArray<readonly [RegExp, MetricUnit]> = [
  [/_ratio(_avg|_max)?$/, 'ratio'], // *_ratio[_avg|_max] -> доля 0..1
  [/_bytes$/, 'bytes'], // *_bytes -> байты
  [/_ms$/, 'durationMs'], // *_ms -> миллисекунды
];

export function metricUnit(name: string): MetricUnit {
  const override = METRIC_UNIT_OVERRIDES.get(name);
  if (override) return override;
  for (const [pattern, unit] of METRIC_UNIT_SUFFIXES) {
    if (pattern.test(name)) return unit;
  }
  return 'count';
}

const BYTE_UNIT_SUFFIXES = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];

function formatBytesValue(value: number): string {
  let current = value;
  let unitIndex = 0;
  while (Math.abs(current) >= 1024 && unitIndex < BYTE_UNIT_SUFFIXES.length - 1) {
    current /= 1024;
    unitIndex++;
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${BYTE_UNIT_SUFFIXES[unitIndex]}`;
}

function formatDurationMsValue(valueMs: number): string {
  const abs = Math.abs(valueMs);
  if (abs < 1000) return `${Math.round(valueMs)} мс`;
  const sign = valueMs < 0 ? '-' : '';
  const seconds = Math.floor(abs / 1000);
  const millis = Math.round(abs % 1000);
  return millis > 0 ? `${sign}${seconds} с ${millis} мс` : `${sign}${seconds} с`;
}

function formatHumanDurationValue(valueSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(valueSeconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCountValue(value: number): string {
  if (Math.abs(value) >= 1000 || Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

export function formatMetricUnitValue(unit: MetricUnit, value: number): string {
  if (!Number.isFinite(value)) return '0';
  switch (unit) {
    case 'ratio':
      return `${(value * 100).toFixed(1)}%`;
    case 'bytes':
      return formatBytesValue(value);
    case 'durationMs':
      return formatDurationMsValue(value);
    case 'humanDuration':
      return formatHumanDurationValue(value);
    case 'money':
      return `$${(Math.round(value * 100) / 100).toFixed(2)}`;
    case 'count':
    default:
      return formatCountValue(value);
  }
}
