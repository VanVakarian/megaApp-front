import { MetricPoint } from '@app/shared/types';

export interface MetricSeriesPoint {
  bucket: number;
  value: number | null;
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
    points
      .filter((point) => point.service === service && point.name === name)
      .map((point) => [point.bucket, point.value]),
  );
  return buckets.map((bucket) => ({ bucket, value: valueByBucket.get(bucket) ?? 0 }));
}

export function metricPointsIndexKey(service: string, name: string): string {
  return `${service}:${name}`;
}

export function buildMetricPointsIndex(
  points: MetricPoint[],
  windowStartBucket: number,
  windowEndBucket: number,
): Map<string, MetricPoint[]> {
  const result = new Map<string, MetricPoint[]>();
  for (const point of points) {
    if (point.bucket < windowStartBucket || point.bucket > windowEndBucket) {
      continue;
    }
    const key = metricPointsIndexKey(point.service, point.name);
    const metricPoints = result.get(key);
    if (metricPoints) {
      metricPoints.push(point);
      continue;
    }
    result.set(key, [point]);
  }
  return result;
}

function filterSortedMetricPoints(
  points: MetricPoint[],
  service: string,
  name: string,
  windowStartBucket: number,
  windowEndBucket: number,
): MetricPoint[] {
  return points
    .filter(
      (point) =>
        point.service === service &&
        point.name === name &&
        point.bucket >= windowStartBucket &&
        point.bucket <= windowEndBucket,
    )
    .sort((a, b) => a.bucket - b.bucket);
}

export function buildSparseBarSeriesFromPoints(points: MetricPoint[]): MetricSeriesPoint[] {
  return points.map((point) => ({
    bucket: point.bucket,
    value: point.value,
  }));
}

export function buildSparseBarSeries(
  points: MetricPoint[],
  service: string,
  name: string,
  windowStartBucket: number,
  windowEndBucket: number,
): MetricSeriesPoint[] {
  return buildSparseBarSeriesFromPoints(
    filterSortedMetricPoints(points, service, name, windowStartBucket, windowEndBucket),
  );
}

const LINE_GAP_THRESHOLD_SECONDS = 60;

export function buildSparseLineSeriesFromPoints(sorted: MetricPoint[]): MetricSeriesPoint[] {
  const series: MetricSeriesPoint[] = [];
  sorted.forEach((point, index) => {
    series.push({ bucket: point.bucket, value: point.value });
    const next = sorted[index + 1];
    if (next && next.bucket - point.bucket > LINE_GAP_THRESHOLD_SECONDS) {
      series.push({ bucket: point.bucket + LINE_GAP_THRESHOLD_SECONDS, value: null });
    }
  });
  return series;
}

export function buildSparseLineSeries(
  points: MetricPoint[],
  service: string,
  name: string,
  windowStartBucket: number,
  windowEndBucket: number,
): MetricSeriesPoint[] {
  return buildSparseLineSeriesFromPoints(
    filterSortedMetricPoints(points, service, name, windowStartBucket, windowEndBucket),
  );
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

export function buildRoundTickBuckets(
  windowStartBucket: number,
  windowEndBucket: number,
  intervalMinutes: number,
): number[] {
  const intervalSeconds = intervalMinutes * 60;
  const buckets: number[] = [];
  for (
    let bucket = Math.ceil(windowStartBucket / intervalSeconds) * intervalSeconds;
    bucket <= windowEndBucket;
    bucket += intervalSeconds
  ) {
    buckets.push(bucket);
  }
  return buckets;
}
