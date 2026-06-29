import { MetricGranularity, MetricPoint } from '@app/shared/types';

export interface MetricSeriesPoint {
  bucket: number;
  value: number | null;
}

export interface MetricWindow {
  startBucket: number;
  endBucket: number;
  bucketCount: number;
}

export function previousCompletedBucket(epochMs: number, stepSeconds: number): number {
  const flooredSeconds = Math.floor(epochMs / 1000 / stepSeconds) * stepSeconds;
  return flooredSeconds - stepSeconds;
}

export function buildMetricWindow(endBucket: number, windowPeriods: number, stepSeconds: number): MetricWindow {
  const bucketCount = Math.max(1, windowPeriods);
  return {
    startBucket: endBucket - (bucketCount - 1) * stepSeconds,
    endBucket,
    bucketCount,
  };
}

export function buildServiceMetricWindow(
  points: MetricPoint[],
  fallbackEndBucket: number,
  windowPeriods: number,
  stepSeconds: number,
): MetricWindow {
  if (points.length === 0) {
    return buildMetricWindow(fallbackEndBucket, windowPeriods, stepSeconds);
  }

  const latestBucket = points.reduce((max, point) => Math.max(max, point.bucket), points[0].bucket);
  const earliestAllowedBucket = latestBucket - (Math.max(1, windowPeriods) - 1) * stepSeconds;
  const startBucket = points.reduce((min, point) => {
    if (point.bucket < earliestAllowedBucket) {
      return min;
    }
    return Math.min(min, point.bucket);
  }, latestBucket);

  return {
    startBucket,
    endBucket: latestBucket,
    bucketCount: Math.floor((latestBucket - startBucket) / stepSeconds) + 1,
  };
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

// A gap is "real" (worth visually breaking the line for) once more than one
// normal step has passed without a point — threshold must match whatever
// granularity's step the series is actually sampled at, never a flat 60s,
// or hour/day series (step 3600/86400) would show a gap after every point.
export function buildSparseLineSeriesFromPoints(sorted: MetricPoint[], gapThresholdSeconds: number): MetricSeriesPoint[] {
  const series: MetricSeriesPoint[] = [];
  sorted.forEach((point, index) => {
    series.push({ bucket: point.bucket, value: point.value });
    const next = sorted[index + 1];
    if (next && next.bucket - point.bucket > gapThresholdSeconds) {
      series.push({ bucket: point.bucket + gapThresholdSeconds, value: null });
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
  gapThresholdSeconds: number,
): MetricSeriesPoint[] {
  return buildSparseLineSeriesFromPoints(
    filterSortedMetricPoints(points, service, name, windowStartBucket, windowEndBucket),
    gapThresholdSeconds,
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatMetricBucketLabel(bucketSeconds: number, granularity: MetricGranularity = 'minute'): string {
  const date = new Date(bucketSeconds * 1000);
  const datePart = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
  if (granularity === 'day') return datePart;
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return granularity === 'hour' ? `${datePart} ${timePart}` : timePart;
}

export function buildRoundTickIndices(buckets: number[], intervalSeconds: number): number[] {
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
  intervalSeconds: number,
): number[] {
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
