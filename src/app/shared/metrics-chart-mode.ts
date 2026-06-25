export type MetricChartMode = 'filled' | 'bar' | 'sparse-line';

export const METRIC_SPARSE_LINE_DENSITY_THRESHOLD = 0.05;

export function pickDynamicMetricChartMode(pointCount: number, windowBucketCount: number): MetricChartMode {
  if (windowBucketCount <= 0) return 'bar';
  return pointCount / windowBucketCount < METRIC_SPARSE_LINE_DENSITY_THRESHOLD ? 'bar' : 'sparse-line';
}
