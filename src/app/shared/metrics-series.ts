import { MetricPoint } from '@app/shared/types';

export interface MetricSeriesPoint {
  bucket: number;
  value: number;
}

export function previousMinuteBucket(epochMs: number): number {
  const flooredSeconds = Math.floor(epochMs / 1000 / 60) * 60;
  return flooredSeconds - 60;
}

export function buildMetricsWindowBuckets(latestBucket: number, windowMinutes: number): number[] {
  const buckets: number[] = [];
  for (let i = windowMinutes - 1; i >= 0; i--) {
    buckets.push(latestBucket - i * 60);
  }
  return buckets;
}

export function zeroFillMetricSeries(
  points: MetricPoint[],
  service: string,
  name: string,
  buckets: number[],
): MetricSeriesPoint[] {
  const valueByBucket = new Map(
    points.filter((point) => point.service === service && point.name === name).map((point) => [point.bucket, point.value]),
  );
  return buckets.map((bucket) => ({ bucket, value: valueByBucket.get(bucket) ?? 0 }));
}

export function formatMetricBucketLabel(bucketSeconds: number): string {
  const date = new Date(bucketSeconds * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function buildRoundTickIndices(buckets: number[], intervalMinutes: number): number[] {
  const intervalSeconds = intervalMinutes * 60;
  const indices: number[] = [];
  buckets.forEach((bucket, index) => {
    if (bucket % intervalSeconds === 0) {
      indices.push(index);
    }
  });
  return indices;
}
