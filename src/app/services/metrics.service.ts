import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { IndexedDbCacheService } from '@app/services/indexed-db-cache.service';
import { NetworkService } from '@app/services/network.service';
import { NotificationService } from '@app/services/notification.service';
import { PerformanceMetricsService } from '@app/services/performance-metrics.service';
import { metricsServiceDefinitions } from '@app/shared/metrics-catalog';
import {
  METRIC_GRANULARITIES,
  MetricsHistoryWatermarks,
  earliestHistoryBucket,
  emptyMetricsHistoryWatermarks,
  firstMissingHistoryBucket,
  latestClosedHistoryBucket,
  parseMetricsHistoryWatermarks,
} from '@app/shared/metrics-history-range';
import { MetricGranularity, MetricPoint, MetricsHistoryResponse, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';
const CACHE_WINDOW_SECONDS: Record<MetricGranularity, number> = {
  minute: 48 * 60 * 60,
  hour: 30 * 24 * 60 * 60,
  day: 365 * 24 * 60 * 60,
};
const CACHE_WRITE_DELAY_MS = 1_000;
const REFRESH_CHECK_DELAY_MS = 250;
const REFRESH_RETRY_DELAY_MS = 60_000;

interface MetricsCacheState {
  points: MetricPoint[];
  historyCheckedThrough: MetricsHistoryWatermarks | number;
  historyServices: string[];
}

interface MetricsHistoryRequest {
  since: MetricsHistoryWatermarks;
  targets: MetricsHistoryWatermarks;
  refreshedServices: Set<string>;
}

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  public readonly points$$ = signal<MetricPoint[]>([]);
  public readonly isRefreshing$$ = signal(false);

  private readonly networkService = inject(NetworkService);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);
  private readonly indexedDbCache = inject(IndexedDbCacheService);
  private readonly performanceMetrics = inject(PerformanceMetricsService);
  private readonly pointsByKey = new Map<string, MetricPoint>();
  private readonly bucketCounts: Record<MetricGranularity, Map<number, number>> = {
    minute: new Map(),
    hour: new Map(),
    day: new Map(),
  };
  private readonly latestBuckets = emptyMetricsHistoryWatermarks();
  private readonly knownServices = new Set(metricsServiceDefinitions().map((definition) => definition.service));
  private refreshedServices = new Set<string>();

  private isSubscribed = false;
  private isCacheLoaded = false;
  private latestRealtimeMinuteBucket = 0;
  private historyCheckedThrough = emptyMetricsHistoryWatermarks();
  private retryAfterMs = 0;
  private cacheWriteTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private refreshCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly resubscribeOnReconnectEffect = effect(() => {
    const isConnected = this.networkService.isConnected$$();
    if (isConnected && this.isSubscribed) {
      untracked(() => this.sendSubscribe());
    }
  });

  constructor() {
    const cacheStartedAt = performance.now();
    void this.indexedDbCache.get<MetricsCacheState | MetricPoint[]>(STORAGE_KEY).then((cached) => {
      if (Array.isArray(cached)) {
        this.mergePoints(cached, false, false);
      } else if (cached) {
        this.mergePoints(cached.points ?? [], false, false);
        this.historyCheckedThrough = parseMetricsHistoryWatermarks(cached.historyCheckedThrough);
        this.refreshedServices = new Set(Array.isArray(cached.historyServices) ? cached.historyServices : []);
      }
      this.isCacheLoaded = true;
      this.scheduleRefreshCheck();
      this.performanceMetrics.record('metrics.cache_hydrate', performance.now() - cacheStartedAt, {
        cache: cached ? 'hit' : 'miss',
        points: this.pointsByKey.size,
      });
    });

    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_UPDATE) {
        this.performanceMetrics.measure(
          'metrics.realtime_batch',
          () => this.mergePoints(message.payload.points, true),
          () => ({
            inputPoints: message.payload.points.length,
            retainedPoints: this.pointsByKey.size,
          }),
        );
        this.scheduleRefreshCheck();
        return;
      }
      if (message.type === WebSocketMessageType.METRICS_LATEST) {
        for (const service of message.payload.services) {
          this.knownServices.add(service.service);
          if (Number.isFinite(service.lastBucket)) {
            this.latestRealtimeMinuteBucket = Math.max(this.latestRealtimeMinuteBucket, service.lastBucket);
          }
        }
        this.scheduleRefreshCheck();
      }
    });
  }

  public subscribe(): void {
    this.isSubscribed = true;
    this.sendSubscribe();
    this.scheduleRefreshCheck();
  }

  public unsubscribe(): void {
    this.isSubscribed = false;
    if (this.refreshCheckTimeoutId !== null) {
      clearTimeout(this.refreshCheckTimeoutId);
      this.refreshCheckTimeoutId = null;
    }
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_UNSUBSCRIBE });
  }

  public forceRefresh(): void {
    this.refreshHistory(true);
  }

  public clearCache(): void {
    this.pointsByKey.clear();
    for (const granularity of METRIC_GRANULARITIES) {
      this.bucketCounts[granularity].clear();
      this.latestBuckets[granularity] = 0;
    }
    this.historyCheckedThrough = emptyMetricsHistoryWatermarks();
    this.refreshedServices.clear();
    this.points$$.set([]);
    if (this.cacheWriteTimeoutId !== null) {
      clearTimeout(this.cacheWriteTimeoutId);
      this.cacheWriteTimeoutId = null;
    }
    void this.indexedDbCache.remove(STORAGE_KEY);
    this.scheduleRefreshCheck();
  }

  private refreshHistory(showNotification = false): void {
    if (this.isRefreshing$$()) return;

    const request = this.buildHistoryRequest(showNotification);
    if (!request) return;

    this.isRefreshing$$.set(true);
    if (showNotification) {
      this.retryAfterMs = 0;
    }

    const params = new HttpParams()
      .set('minuteSince', request.since.minute)
      .set('hourSince', request.since.hour)
      .set('daySince', request.since.day);

    const startedAt = performance.now();
    this.http.get<MetricsHistoryResponse>('/api/metrics/history', { params }).subscribe({
      next: (response) => {
        const histories = response.histories ?? [];
        this.mergeHistories(histories);
        this.refreshedServices = new Set([
          ...request.refreshedServices,
          ...histories
            .map((history) => history.service?.trim())
            .filter((service): service is string => Boolean(service)),
        ]);
        for (const granularity of METRIC_GRANULARITIES) {
          this.historyCheckedThrough[granularity] = Math.max(
            this.historyCheckedThrough[granularity],
            request.targets[granularity],
          );
        }
        this.retryAfterMs = 0;
        this.isRefreshing$$.set(false);
        this.scheduleCacheWrite();
        this.scheduleRefreshCheck();
        void this.performanceMetrics.recordAfterPaint('metrics.history_refresh', startedAt, {
          trigger: showNotification ? 'manual' : 'automatic',
          histories: histories.length,
          retainedPoints: this.pointsByKey.size,
        });
        if (showNotification) {
          this.notificationService.addNotification('success', 'Metrics refreshed');
        }
      },
      error: () => {
        this.retryAfterMs = Date.now() + REFRESH_RETRY_DELAY_MS;
        this.isRefreshing$$.set(false);
        if (showNotification) {
          this.notificationService.addNotification('error', 'Failed to refresh metrics');
        }
        this.performanceMetrics.record(
          'metrics.history_refresh',
          performance.now() - startedAt,
          {
            trigger: showNotification ? 'manual' : 'automatic',
          },
          'error',
        );
      },
    });
  }

  private sendSubscribe(): void {
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_SUBSCRIBE });
  }

  private mergeHistories(histories: MetricsHistoryResponse['histories']): void {
    for (const history of histories) {
      const service = history?.service?.trim();
      if (!service) continue;
      this.knownServices.add(service);
      for (const snapshot of history.snapshots ?? []) {
        if (!this.isValidGranularity(snapshot?.granularity) || !Number.isFinite(snapshot.bucket)) continue;
        for (const [name, value] of Object.entries(snapshot.metrics ?? {})) {
          this.insertPoint({ service, name, granularity: snapshot.granularity, bucket: snapshot.bucket, value }, false);
        }
      }
    }
    this.prunePoints();
    this.publishPoints(true);
  }

  private mergePoints(newPoints: MetricPoint[] | null, isRealtime: boolean, shouldSave = true): void {
    if (!newPoints || newPoints.length === 0) return;

    for (const point of newPoints) {
      this.insertPoint(point, isRealtime);
    }
    this.prunePoints();
    this.publishPoints(shouldSave);
  }

  private insertPoint(point: MetricPoint, isRealtime: boolean): void {
    if (
      !point?.service ||
      !point.name ||
      !this.isValidGranularity(point.granularity) ||
      !Number.isFinite(point.bucket) ||
      !Number.isFinite(point.value)
    ) {
      return;
    }

    const key = this.pointKey(point);
    const isNew = !this.pointsByKey.has(key);
    this.pointsByKey.set(key, point);
    this.knownServices.add(point.service);
    this.latestBuckets[point.granularity] = Math.max(this.latestBuckets[point.granularity], point.bucket);
    if (isNew) {
      const bucketCounts = this.bucketCounts[point.granularity];
      bucketCounts.set(point.bucket, (bucketCounts.get(point.bucket) ?? 0) + 1);
    }

    if (point.granularity === 'minute') {
      if (isRealtime) {
        this.latestRealtimeMinuteBucket = Math.max(this.latestRealtimeMinuteBucket, point.bucket);
      }
    }
  }

  private prunePoints(): void {
    for (const [key, point] of this.pointsByKey) {
      const minBucket = this.latestBuckets[point.granularity] - CACHE_WINDOW_SECONDS[point.granularity];
      if (minBucket <= 0 || point.bucket >= minBucket) continue;
      this.pointsByKey.delete(key);
      const bucketCounts = this.bucketCounts[point.granularity];
      const bucketCount = (bucketCounts.get(point.bucket) ?? 1) - 1;
      if (bucketCount > 0) {
        bucketCounts.set(point.bucket, bucketCount);
      } else {
        bucketCounts.delete(point.bucket);
      }
    }
  }

  private publishPoints(shouldSave: boolean): void {
    const points = Array.from(this.pointsByKey.values()).sort((a, b) => {
      if (a.bucket !== b.bucket) return a.bucket - b.bucket;
      if (a.service !== b.service) return a.service.localeCompare(b.service);
      return a.name.localeCompare(b.name);
    });
    this.points$$.set(points);
    if (shouldSave) {
      this.scheduleCacheWrite();
    }
  }

  private scheduleRefreshCheck(): void {
    if (!this.isCacheLoaded || !this.isSubscribed || this.isRefreshing$$() || this.refreshCheckTimeoutId !== null) {
      return;
    }
    this.refreshCheckTimeoutId = setTimeout(() => {
      this.refreshCheckTimeoutId = null;
      if (Date.now() < this.retryAfterMs) return;
      this.refreshHistory();
    }, REFRESH_CHECK_DELAY_MS);
  }

  private buildHistoryRequest(force: boolean): MetricsHistoryRequest | null {
    const latestMinuteBucket =
      this.latestRealtimeMinuteBucket > 0 ? this.latestRealtimeMinuteBucket : Math.floor(Date.now() / 60_000) * 60 - 60;

    let fullRefresh = force || this.refreshedServices.size === 0;
    for (const service of this.knownServices) {
      if (!this.refreshedServices.has(service)) {
        fullRefresh = true;
        break;
      }
    }

    const since = emptyMetricsHistoryWatermarks();
    const targets = emptyMetricsHistoryWatermarks();
    let needsRefresh = fullRefresh;
    let watermarksChanged = false;

    for (const granularity of METRIC_GRANULARITIES) {
      const target = latestClosedHistoryBucket(granularity, latestMinuteBucket);
      targets[granularity] = target;
      since[granularity] = fullRefresh
        ? earliestHistoryBucket(granularity, target)
        : firstMissingHistoryBucket(
            granularity,
            this.historyCheckedThrough[granularity],
            target,
            this.bucketCounts[granularity],
          );

      if (since[granularity] <= target) {
        needsRefresh = true;
      } else if (this.historyCheckedThrough[granularity] < target) {
        this.historyCheckedThrough[granularity] = target;
        watermarksChanged = true;
      }
    }

    if (watermarksChanged) this.scheduleCacheWrite();
    if (!needsRefresh) return null;
    return { since, targets, refreshedServices: new Set(this.knownServices) };
  }

  private scheduleCacheWrite(): void {
    if (this.cacheWriteTimeoutId !== null) return;
    this.cacheWriteTimeoutId = setTimeout(() => {
      this.cacheWriteTimeoutId = null;
      const startedAt = performance.now();
      void this.indexedDbCache
        .set<MetricsCacheState>(STORAGE_KEY, {
          points: this.points$$(),
          historyCheckedThrough: { ...this.historyCheckedThrough },
          historyServices: Array.from(this.refreshedServices).sort(),
        })
        .then(() =>
          this.performanceMetrics.record('metrics.cache_persist', performance.now() - startedAt, {
            points: this.pointsByKey.size,
          }),
        );
    }, CACHE_WRITE_DELAY_MS);
  }

  private isValidGranularity(value: unknown): value is MetricGranularity {
    return value === 'minute' || value === 'hour' || value === 'day';
  }

  private pointKey(point: MetricPoint): string {
    return `${point.granularity}:${point.service}:${point.name}:${point.bucket}`;
  }
}
