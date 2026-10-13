import { splitScopeIntoBatches } from '@app/shared/metrics-history-range';
import { MetricsScopeEntry } from '@app/shared/types';

function names(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`);
}

function metricCount(batch: MetricsScopeEntry[]): number {
  return batch.reduce((total, entry) => total + entry.metricNames.length, 0);
}

describe('splitScopeIntoBatches', () => {
  it('keeps a scope within the limit as a single batch', () => {
    const scope = [{ service: 'api', metricNames: names('m', 3) }];
    expect(splitScopeIntoBatches(scope, 5)).toEqual([scope]);
  });

  it('returns no batches for an empty scope', () => {
    expect(splitScopeIntoBatches([], 5)).toEqual([]);
  });

  it('splits one large service across batches without losing or duplicating a metric', () => {
    const all = names('m', 12);
    const batches = splitScopeIntoBatches([{ service: 'api', metricNames: all }], 5);

    expect(batches.map(metricCount)).toEqual([5, 5, 2]);
    expect(batches.flatMap((batch) => batch.flatMap((entry) => entry.metricNames))).toEqual(all);
    expect(batches.every((batch) => batch.every((entry) => entry.service === 'api'))).toBe(true);
  });

  it('packs several small services into a batch and cuts a service at the batch boundary', () => {
    const batches = splitScopeIntoBatches(
      [
        { service: 'a', metricNames: names('a', 3) },
        { service: 'b', metricNames: names('b', 4) },
        { service: 'c', metricNames: names('c', 2) },
      ],
      5,
    );

    expect(batches).toEqual([
      [
        { service: 'a', metricNames: names('a', 3) },
        { service: 'b', metricNames: ['b0', 'b1'] },
      ],
      [
        { service: 'b', metricNames: ['b2', 'b3'] },
        { service: 'c', metricNames: names('c', 2) },
      ],
    ]);
  });

  it('starts a fresh batch when a batch fills up exactly at the end of a service', () => {
    const batches = splitScopeIntoBatches(
      [
        { service: 'a', metricNames: names('a', 5) },
        { service: 'b', metricNames: names('b', 1) },
      ],
      5,
    );

    expect(batches.map(metricCount)).toEqual([5, 1]);
  });
});
