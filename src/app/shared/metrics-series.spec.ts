import { metricWindowAt } from '@app/shared/metrics-granularity';
import {
  buildCollapsedMetricWindow,
  buildRoundTickBuckets,
  buildSparseBarSeriesFromPoints,
  buildSparseLineSeriesFromPoints,
  filterMetricPointsByWindow,
  MinuteMetricCollapseCache,
} from '@app/shared/metrics-series';
import { MetricPoint } from '@app/shared/types';

function point(bucket: number, value = 1): MetricPoint {
  return { service: 'api', name: 'requests', granularity: 'minute', bucket, value };
}

describe('filterMetricPointsByWindow', () => {
  it('keeps points on and between both boundaries and drops the ones outside', () => {
    const points = [point(60), point(120), point(180), point(240)];

    expect(filterMetricPointsByWindow(points, 120, 180).map((p) => p.bucket)).toEqual([120, 180]);
  });

  it('returns nothing when every point predates the window', () => {
    expect(filterMetricPointsByWindow([point(60), point(120)], 600, 660)).toEqual([]);
  });
});

describe('buildCollapsedMetricWindow', () => {
  it('aligns both boundaries down to the collapse step', () => {
    expect(buildCollapsedMetricWindow({ startBucket: 130, endBucket: 910 }, 300)).toEqual({
      startBucket: 0,
      endBucket: 900,
    });
  });
});

// 2026-09-26T15:30:45Z
const NOW_SECONDS = Date.UTC(2026, 8, 26, 15, 30, 45) / 1000;
const HOUR = 3600;
const DAY = 86400;

describe('buildRoundTickBuckets', () => {
  it('minute: every hour of the 24h window when there is room for a label per hour', () => {
    const window = metricWindowAt('minute', NOW_SECONDS);
    const ticks = buildRoundTickBuckets(window, 'minute', 0);

    expect(ticks.length).toBe(24);
    expect(ticks.every((bucket) => bucket % HOUR === 0)).toBe(true);
    expect(ticks[0]).toBeGreaterThanOrEqual(window.startBucket);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(window.endBucket);
  });

  it.each([
    [2 * HOUR, 2],
    [3.7 * HOUR, 4],
    [5 * HOUR, 6],
    [7 * HOUR, 12],
    [13 * HOUR, 24],
  ])('minute: needing %s seconds per label picks a %s-hour stride on local hours', (minSpacingSeconds, stride) => {
    const window = metricWindowAt('minute', NOW_SECONDS);
    const ticks = buildRoundTickBuckets(window, 'minute', minSpacingSeconds);

    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((bucket) => new Date(bucket * 1000).getHours() % stride === 0)).toBe(true);
    expect(ticks.slice(1).every((bucket, index) => bucket - ticks[index] === stride * HOUR)).toBe(true);
  });

  it('minute: keeps every tick in place when the window slides, only the edges change', () => {
    const now = NOW_SECONDS;
    const before = buildRoundTickBuckets(metricWindowAt('minute', now), 'minute', 3.7 * HOUR);
    const after = buildRoundTickBuckets(metricWindowAt('minute', now + 2 * HOUR), 'minute', 3.7 * HOUR);
    const shared = before.filter((bucket) => after.includes(bucket));

    expect(shared.length).toBeGreaterThanOrEqual(before.length - 1);
    expect(after.filter((bucket) => bucket >= before[0] && bucket <= before[before.length - 1])).toEqual(shared);
  });

  it('hour: a tick per UTC midnight when there is room, at most one per day', () => {
    const window = metricWindowAt('hour', NOW_SECONDS);
    const ticks = buildRoundTickBuckets(window, 'hour', 0);

    expect(ticks.length).toBe(30);
    expect(ticks.every((bucket) => bucket % DAY === 0)).toBe(true);
  });

  it('day: thins a year-long window to a stride from the ladder, anchored to absolute day numbers', () => {
    const window = metricWindowAt('day', NOW_SECONDS);
    const ticks = buildRoundTickBuckets(window, 'day', 56 * DAY);

    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.length).toBeLessThan(8);
    expect(ticks.every((bucket) => Math.round(bucket / DAY) % 60 === 0)).toBe(true);
  });

  it('falls back to the sparsest stride when even that does not fit', () => {
    const window = metricWindowAt('minute', NOW_SECONDS);
    const ticks = buildRoundTickBuckets(window, 'minute', 1000 * HOUR);

    expect(ticks.every((bucket) => new Date(bucket * 1000).getHours() === 0)).toBe(true);
  });
});

describe('sparse series builders', () => {
  it('line: inserts a null break after a point followed by a gap longer than one step', () => {
    const series = buildSparseLineSeriesFromPoints([point(60, 1), point(120, 2), point(300, 3)], 60);

    expect(series).toEqual([
      { bucket: 60, value: 1 },
      { bucket: 120, value: 2 },
      { bucket: 180, value: null },
      { bucket: 300, value: 3 },
    ]);
  });

  it('line: does not break a contiguous series', () => {
    expect(buildSparseLineSeriesFromPoints([point(60, 1), point(120, 2)], 60)).toEqual([
      { bucket: 60, value: 1 },
      { bucket: 120, value: 2 },
    ]);
  });

  it('bar: maps points one to one', () => {
    expect(buildSparseBarSeriesFromPoints([point(60, 5)])).toEqual([{ bucket: 60, value: 5 }]);
  });
});

describe('MinuteMetricCollapseCache over a sliding window', () => {
  it('stays inside the aligned window and matches a fresh rebuild after the window start moves forward', () => {
    const cache = new MinuteMetricCollapseCache();
    const step = 300;
    const first = Array.from({ length: 10 }, (_, index) => point(index * 60, index));
    const slid = Array.from({ length: 10 }, (_, index) => point((index + 1) * 60, index + 1));

    cache.collapse('k', first, 'avg', false, step);
    const incremental = cache.collapse('k', slid, 'avg', false, step);
    const fresh = new MinuteMetricCollapseCache().collapse('k', slid, 'avg', false, step);

    expect(incremental).toEqual(fresh);
    const window = buildCollapsedMetricWindow({ startBucket: 60, endBucket: 600 }, step);
    expect(incremental.every((p) => p.bucket >= window.startBucket && p.bucket <= window.endBucket)).toBe(true);
  });
});
