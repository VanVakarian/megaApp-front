import { aggregateMetricValues, MetricAggregation } from '@app/shared/metrics-aggregation';
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

interface CollapsedBucketState {
  values: number[];
}

interface MinuteCollapseCacheEntry {
  aggregation: MetricAggregation;
  bucketSizeSeconds: number;
  rawPoints: MetricPoint[];
  bucketStates: Map<number, CollapsedBucketState>;
  collapsedPoints: MetricPoint[];
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
export function buildSparseLineSeriesFromPoints(
  sorted: MetricPoint[],
  gapThresholdSeconds: number,
): MetricSeriesPoint[] {
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

// On the hour granularity, ticks sit days apart — showing the time alongside the
// date is both unnecessary and, at 5 ticks across a narrow chart, wide enough to
// overlap — so the axis only shows the date, same as the day granularity already
// does. On other granularities, a tick landing exactly on local midnight already
// tells you the time (00:00), so the date alone is enough there too.
export function formatMetricTickLabel(bucketSeconds: number, granularity: MetricGranularity = 'minute'): string {
  const date = new Date(bucketSeconds * 1000);
  if (granularity === 'hour' || (date.getHours() === 0 && date.getMinutes() === 0)) {
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
  }
  return formatMetricBucketLabel(bucketSeconds, granularity);
}

// Every bucket in [windowStartBucket, windowEndBucket] that lands exactly on an
// interval boundary (e.g. 3600 for round hours) — unlike buildPaddedTickBuckets,
// tick count varies with window length instead of being fixed.
export function buildRoundTickBuckets(
  windowStartBucket: number,
  windowEndBucket: number,
  intervalSeconds: number,
): number[] {
  const firstTick = Math.ceil(windowStartBucket / intervalSeconds) * intervalSeconds;
  const buckets: number[] = [];
  for (let bucket = firstTick; bucket <= windowEndBucket; bucket += intervalSeconds) {
    buckets.push(bucket);
  }
  return buckets;
}

// Every local midnight (00:00) in [windowStartBucket, windowEndBucket] — steps by
// calendar day via Date instead of a flat 86400s stride, so a DST transition inside
// the window can't drift a later tick off local midnight.
export function buildRoundDayTickBuckets(windowStartBucket: number, windowEndBucket: number): number[] {
  const cursor = new Date(windowStartBucket * 1000);
  cursor.setHours(0, 0, 0, 0);
  if (cursor.getTime() < windowStartBucket * 1000) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const buckets: number[] = [];
  while (cursor.getTime() <= windowEndBucket * 1000) {
    buckets.push(Math.floor(cursor.getTime() / 1000));
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

// `segments + 1` buckets, evenly spaced from start to end (both included).
function buildEvenTickBuckets(startBucket: number, endBucket: number, segments: number): number[] {
  const span = endBucket - startBucket;
  const buckets: number[] = [];
  for (let index = 0; index <= segments; index++) {
    buckets.push(Math.round(startBucket + (span * index) / segments));
  }
  return buckets;
}

// Fraction of the window trimmed off each side before placing ticks — keeps the
// outer ticks a bit inset from the window edges instead of sitting exactly on them.
const TICK_EDGE_PADDING_FRACTION = 2 / 24;
const TICK_COUNT = 5;

export function buildPaddedTickBuckets(windowStartBucket: number, windowEndBucket: number): number[] {
  const span = windowEndBucket - windowStartBucket;
  const edgePadding = span * TICK_EDGE_PADDING_FRACTION;
  return buildEvenTickBuckets(windowStartBucket + edgePadding, windowEndBucket - edgePadding, TICK_COUNT - 1);
}

// Binary search: series is always bucket-sorted ascending (builders above guarantee it).
export function findNearestSeriesPoint(series: MetricSeriesPoint[], targetBucket: number): MetricSeriesPoint | null {
  if (series.length === 0) {
    return null;
  }

  let low = 0;
  let high = series.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (series[mid].bucket < targetBucket) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidate = series[low];
  const previous = series[low - 1];
  if (!previous) {
    return candidate;
  }
  return Math.abs(previous.bucket - targetBucket) <= Math.abs(candidate.bucket - targetBucket) ? previous : candidate;
}

export function alignBucketDown(bucketSeconds: number, stepSeconds: number): number {
  return Math.floor(bucketSeconds / stepSeconds) * stepSeconds;
}

export function buildCollapsedMetricWindow(window: MetricWindow, stepSeconds: number): MetricWindow {
  const startBucket = alignBucketDown(window.startBucket, stepSeconds);
  const endBucket = alignBucketDown(window.endBucket, stepSeconds);
  return {
    startBucket,
    endBucket,
    bucketCount: Math.max(1, Math.floor((endBucket - startBucket) / stepSeconds) + 1),
  };
}

export function filterMetricPointsByWindow(
  points: MetricPoint[],
  windowStartBucket: number,
  windowEndBucket: number,
): MetricPoint[] {
  return points.filter((point) => point.bucket >= windowStartBucket && point.bucket <= windowEndBucket);
}

export class MinuteMetricCollapseCache {
  private readonly cache = new Map<string, MinuteCollapseCacheEntry>();

  public collapse(
    cacheKey: string,
    points: MetricPoint[],
    aggregation: MetricAggregation,
    bucketSizeSeconds: number,
  ): MetricPoint[] {
    const cached = this.cache.get(cacheKey);
    if (!cached || cached.aggregation !== aggregation || cached.bucketSizeSeconds !== bucketSizeSeconds) {
      const rebuilt = this.rebuild(points, aggregation, bucketSizeSeconds);
      this.cache.set(cacheKey, rebuilt);
      return rebuilt.collapsedPoints;
    }

    if (!this.canIncrementallyUpdate(cached.rawPoints, points)) {
      const rebuilt = this.rebuild(points, aggregation, bucketSizeSeconds);
      this.cache.set(cacheKey, rebuilt);
      return rebuilt.collapsedPoints;
    }

    const currentStartBucket = points[0]?.bucket ?? Number.POSITIVE_INFINITY;
    let removedCount = 0;
    while (removedCount < cached.rawPoints.length && cached.rawPoints[removedCount].bucket < currentStartBucket) {
      this.removePoint(cached, cached.rawPoints[removedCount]);
      removedCount++;
    }

    let overlapCount = 0;
    const previousLastBucket = cached.rawPoints[cached.rawPoints.length - 1]?.bucket ?? Number.NEGATIVE_INFINITY;
    while (overlapCount < points.length && points[overlapCount].bucket <= previousLastBucket) {
      overlapCount++;
    }
    for (const point of points.slice(overlapCount)) {
      this.addPoint(cached, point);
    }

    cached.rawPoints = points.slice();
    cached.collapsedPoints = this.buildCollapsedPoints(cached, points);
    return cached.collapsedPoints;
  }

  private rebuild(
    points: MetricPoint[],
    aggregation: MetricAggregation,
    bucketSizeSeconds: number,
  ): MinuteCollapseCacheEntry {
    const entry: MinuteCollapseCacheEntry = {
      aggregation,
      bucketSizeSeconds,
      rawPoints: points.slice(),
      bucketStates: new Map<number, CollapsedBucketState>(),
      collapsedPoints: [],
    };
    for (const point of points) {
      this.addPoint(entry, point);
    }
    entry.collapsedPoints = this.buildCollapsedPoints(entry, points);
    return entry;
  }

  private canIncrementallyUpdate(previous: MetricPoint[], current: MetricPoint[]): boolean {
    if (previous.length === 0 || current.length === 0) {
      return (
        previous.length === 0 ||
        current.length === 0 ||
        current[current.length - 1].bucket >= previous[previous.length - 1].bucket
      );
    }
    if (
      current[0].bucket < previous[0].bucket ||
      current[current.length - 1].bucket < previous[previous.length - 1].bucket
    ) {
      return false;
    }

    let previousStartIndex = 0;
    while (previousStartIndex < previous.length && previous[previousStartIndex].bucket < current[0].bucket) {
      previousStartIndex++;
    }

    let currentOverlapLength = 0;
    while (
      currentOverlapLength < current.length &&
      current[currentOverlapLength].bucket <= previous[previous.length - 1].bucket
    ) {
      currentOverlapLength++;
    }

    const previousOverlapLength = previous.length - previousStartIndex;
    if (previousOverlapLength !== currentOverlapLength) {
      return false;
    }

    for (let index = 0; index < previousOverlapLength; index++) {
      const previousPoint = previous[previousStartIndex + index];
      const currentPoint = current[index];
      if (previousPoint.bucket !== currentPoint.bucket || previousPoint.value !== currentPoint.value) {
        return false;
      }
    }
    return true;
  }

  private addPoint(entry: MinuteCollapseCacheEntry, point: MetricPoint): void {
    const collapsedBucket = alignBucketDown(point.bucket, entry.bucketSizeSeconds);
    const state = entry.bucketStates.get(collapsedBucket);
    if (state) {
      state.values.push(point.value);
      return;
    }
    entry.bucketStates.set(collapsedBucket, { values: [point.value] });
  }

  private removePoint(entry: MinuteCollapseCacheEntry, point: MetricPoint): void {
    const collapsedBucket = alignBucketDown(point.bucket, entry.bucketSizeSeconds);
    const state = entry.bucketStates.get(collapsedBucket);
    if (!state) {
      return;
    }
    state.values.shift();
    if (state.values.length === 0) {
      entry.bucketStates.delete(collapsedBucket);
    }
  }

  private buildCollapsedPoints(entry: MinuteCollapseCacheEntry, points: MetricPoint[]): MetricPoint[] {
    if (points.length === 0) {
      return [];
    }

    return Array.from(entry.bucketStates.entries())
      .sort(([leftBucket], [rightBucket]) => leftBucket - rightBucket)
      .map(([bucket, state]) => ({
        service: points[0].service,
        name: points[0].name,
        granularity: points[0].granularity,
        bucket,
        value: aggregateMetricValues(entry.aggregation, state.values),
      }));
  }
}
