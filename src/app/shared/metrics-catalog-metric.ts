import { MetricAggregation } from '@app/shared/metrics-aggregation';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { MetricUnit } from '@app/shared/metric-units';

export interface MetricConfig {
  name: string;
  label: string;
  description: string;
  aggregation: MetricAggregation;
  unit: MetricUnit;
  color: string;
  chartMode: MetricChartMode;
}

export interface MetricsGroupDefinition {
  id: string;
  label: string;
  metrics: MetricConfig[];
}

export interface MetricsServiceDefinition {
  service: string;
  label: string;
  groups: MetricsGroupDefinition[];
}

interface MetricOptions {
  aggregation: MetricAggregation;
  description: string;
  label?: string;
  unit?: MetricUnit;
  color?: string;
  chartMode?: MetricChartMode;
}

export const DEFAULT_METRIC_COLOR = '#578f92';

const RATIO_SUFFIX = /_ratio(_avg|_max)?$/; // *_ratio[_avg|_max] -> доля 0..1
const BYTES_SUFFIX = /_bytes$/; // *_bytes -> байты
const MS_SUFFIX = /_ms$/; // *_ms -> миллисекунды

function inferUnitFromSuffix(name: string): MetricUnit {
  if (RATIO_SUFFIX.test(name)) return 'ratio';
  if (BYTES_SUFFIX.test(name)) return 'bytes';
  if (MS_SUFFIX.test(name)) return 'durationMs';
  return 'count';
}

export function metric(name: string, options: MetricOptions): MetricConfig {
  return {
    name,
    label: options.label ?? name,
    description: options.description,
    aggregation: options.aggregation,
    unit: options.unit ?? inferUnitFromSuffix(name),
    color: options.color ?? DEFAULT_METRIC_COLOR,
    chartMode: options.chartMode ?? 'sparse-line',
  };
}
