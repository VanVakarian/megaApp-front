import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { NotificationService } from '@app/services/notification.service';
import { buildCacheKey } from '@app/shared/cache';
import { idbGet, idbRemove, idbSet } from '@app/shared/idb-cache';
import { metricsServiceDefinitions } from '@app/shared/metrics-catalog';
import { MetricGranularity, MetricPoint, MetricsHistoryResponse, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';
const MINUTE_STEP_SECONDS = 60;
const METRICS_WINDOW_SECONDS = 48 * 60 * 60;
const HISTORY_WINDOW_SECONDS = 24 * 60 * 60;
const CACHE_WRITE_DELAY_MS = 1_000;
const REFRESH_CHECK_DELAY_MS = 250;
const REFRESH_RETRY_DELAY_MS = 60_000;

interface MetricsCacheState {
  points: MetricPoint[];
  historyCheckedThrough: number;
  historyServices: string[];
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
  private readonly pointsByKey = new Map<string, MetricPoint>();
  private readonly minuteBucketCounts = new Map<number, number>();
  private readonly knownServices = new Set(metricsServiceDefinitions().map((definition) => definition.service));
  private refreshedServices = new Set<string>();

  private isSubscribed = false;
  private isCacheLoaded = false;
  private latestMinuteBucket = 0;
  private latestRealtimeMinuteBucket = 0;
  private historyCheckedThrough = 0;
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
    void idbGet<MetricsCacheState | MetricPoint[]>(buildCacheKey(STORAGE_KEY)).then((cached) => {
      if (Array.isArray(cached)) {
        this.mergePoints(cached, false, false);
      } else if (cached) {
        this.mergePoints(cached.points ?? [], false, false);
        this.historyCheckedThrough = Number.isFinite(cached.historyCheckedThrough) ? cached.historyCheckedThrough : 0;
        this.refreshedServices = new Set(Array.isArray(cached.historyServices) ? cached.historyServices : []);
      }
      this.isCacheLoaded = true;
      this.scheduleRefreshCheck();
    });

    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_UPDATE) {
        this.mergePoints(message.payload.points, true);
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
    this.minuteBucketCounts.clear();
    this.latestMinuteBucket = 0;
    this.historyCheckedThrough = 0;
    this.refreshedServices.clear();
    this.points$$.set([]);
    if (this.cacheWriteTimeoutId !== null) {
      clearTimeout(this.cacheWriteTimeoutId);
      this.cacheWriteTimeoutId = null;
    }
    void idbRemove(buildCacheKey(STORAGE_KEY));
    this.scheduleRefreshCheck();
  }

  private refreshHistory(showNotification = false): void {
    if (this.isRefreshing$$()) return;

    const services = Array.from(this.knownServices).sort();
    if (services.length === 0) return;

    this.isRefreshing$$.set(true);
    if (showNotification) {
      this.retryAfterMs = 0;
    }

    const anchor = this.latestRealtimeMinuteBucket;
    let params = new HttpParams().set('services', services.join(','));
    if (anchor > 0) {
      params = params.set('latestBucket', anchor);
    }

    this.http.get<MetricsHistoryResponse>('/api/metrics/history', { params }).subscribe({
      next: (response) => {
        this.mergeHistories(response.histories ?? []);
        this.refreshedServices = new Set(services);
        this.historyCheckedThrough = Math.max(anchor, this.latestRealtimeMinuteBucket, this.latestMinuteBucket);
        this.retryAfterMs = 0;
        this.isRefreshing$$.set(false);
        this.scheduleCacheWrite();
        this.scheduleRefreshCheck();
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
    this.pruneMinutes();
    this.publishPoints(true);
  }

  private mergePoints(newPoints: MetricPoint[] | null, isRealtime: boolean, shouldSave = true): void {
    if (!newPoints || newPoints.length === 0) return;

    for (const point of newPoints) {
      this.insertPoint(point, isRealtime);
    }
    this.pruneMinutes();
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

    if (point.granularity === 'minute') {
      this.latestMinuteBucket = Math.max(this.latestMinuteBucket, point.bucket);
      if (isRealtime) {
        this.latestRealtimeMinuteBucket = Math.max(this.latestRealtimeMinuteBucket, point.bucket);
      }
      if (isNew) {
        this.minuteBucketCounts.set(point.bucket, (this.minuteBucketCounts.get(point.bucket) ?? 0) + 1);
      }
    }
  }

  private pruneMinutes(): void {
    const minMinuteBucket = this.latestMinuteBucket - METRICS_WINDOW_SECONDS;
    if (minMinuteBucket <= 0) return;
    for (const [key, point] of this.pointsByKey) {
      if (point.granularity !== 'minute' || point.bucket >= minMinuteBucket) continue;
      this.pointsByKey.delete(key);
      const bucketCount = (this.minuteBucketCounts.get(point.bucket) ?? 1) - 1;
      if (bucketCount > 0) {
        this.minuteBucketCounts.set(point.bucket, bucketCount);
      } else {
        this.minuteBucketCounts.delete(point.bucket);
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
      if (Date.now() < this.retryAfterMs || !this.shouldRefreshHistory()) return;
      this.refreshHistory();
    }, REFRESH_CHECK_DELAY_MS);
  }

  private shouldRefreshHistory(): boolean {
    const latestBucket = this.latestRealtimeMinuteBucket;
    if (latestBucket <= 0) return false;
    if (this.refreshedServices.size === 0) return true;
    for (const service of this.knownServices) {
      if (!this.refreshedServices.has(service)) return true;
    }
    if (this.historyCheckedThrough <= 0) return true;
    if (latestBucket <= this.historyCheckedThrough) return false;
    if (latestBucket - this.historyCheckedThrough > HISTORY_WINDOW_SECONDS) return true;

    for (
      let bucket = this.historyCheckedThrough + MINUTE_STEP_SECONDS;
      bucket <= latestBucket;
      bucket += MINUTE_STEP_SECONDS
    ) {
      if (!this.minuteBucketCounts.has(bucket)) return true;
    }

    this.historyCheckedThrough = latestBucket;
    this.scheduleCacheWrite();
    return false;
  }

  private scheduleCacheWrite(): void {
    if (this.cacheWriteTimeoutId !== null) return;
    this.cacheWriteTimeoutId = setTimeout(() => {
      this.cacheWriteTimeoutId = null;
      void idbSet<MetricsCacheState>(buildCacheKey(STORAGE_KEY), {
        points: this.points$$(),
        historyCheckedThrough: this.historyCheckedThrough,
        historyServices: Array.from(this.refreshedServices).sort(),
      });
    }, CACHE_WRITE_DELAY_MS);
  }

  private isValidGranularity(value: unknown): value is MetricGranularity {
    return value === 'minute' || value === 'hour' || value === 'day';
  }

  private pointKey(point: MetricPoint): string {
    return `${point.granularity}:${point.service}:${point.name}:${point.bucket}`;
  }
}
