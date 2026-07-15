import { MetricGranularity } from '@app/shared/types';

export const METRIC_GRANULARITIES: readonly MetricGranularity[] = ['minute', 'hour', 'day'];

const HISTORY_STEP_SECONDS: Record<MetricGranularity, number> = {
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
};

const HISTORY_PERIODS: Record<MetricGranularity, number> = {
  minute: 24 * 60,
  hour: 30 * 24,
  day: 365,
};

export type MetricsHistoryWatermarks = Record<MetricGranularity, number>;

export function emptyMetricsHistoryWatermarks(): MetricsHistoryWatermarks {
  return { minute: 0, hour: 0, day: 0 };
}

export function parseMetricsHistoryWatermarks(value: unknown): MetricsHistoryWatermarks {
  const watermarks = emptyMetricsHistoryWatermarks();
  if (typeof value === 'number' && Number.isFinite(value)) {
    watermarks.minute = value;
    return watermarks;
  }
  if (!value || typeof value !== 'object') return watermarks;

  const stored = value as Partial<MetricsHistoryWatermarks>;
  for (const granularity of METRIC_GRANULARITIES) {
    const watermark = stored[granularity];
    if (typeof watermark === 'number' && Number.isFinite(watermark)) {
      watermarks[granularity] = watermark;
    }
  }
  return watermarks;
}

export function latestClosedHistoryBucket(granularity: MetricGranularity, latestMinuteBucket: number): number {
  if (granularity === 'minute') return latestMinuteBucket;
  const step = HISTORY_STEP_SECONDS[granularity];
  return Math.max(0, Math.floor(latestMinuteBucket / step) * step - step);
}

export function earliestHistoryBucket(granularity: MetricGranularity, latestBucket: number): number {
  const step = HISTORY_STEP_SECONDS[granularity];
  return latestBucket - (HISTORY_PERIODS[granularity] - 1) * step;
}

export function firstMissingHistoryBucket(
  granularity: MetricGranularity,
  checkedThrough: number,
  latestBucket: number,
  coverage: { has(bucket: number): boolean },
): number {
  const step = HISTORY_STEP_SECONDS[granularity];
  const earliestBucket = earliestHistoryBucket(granularity, latestBucket);
  const firstUncheckedBucket = checkedThrough > 0 ? checkedThrough + step : earliestBucket;

  for (let bucket = Math.max(earliestBucket, firstUncheckedBucket); bucket <= latestBucket; bucket += step) {
    if (!coverage.has(bucket)) return bucket;
  }
  return latestBucket + step;
}
