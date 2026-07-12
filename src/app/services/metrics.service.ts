import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { buildCacheKey } from '@app/shared/cache';
import { idbGet, idbRemove, idbSet } from '@app/shared/idb-cache';
import { MetricGranularity, MetricPoint, MetricsHistoryResponse, MetricSnapshot, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';
const METRICS_WINDOW_SECONDS = 48 * 60 * 60;
const CACHE_WRITE_DELAY_MS = 1_000;

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  public readonly points$$ = signal<MetricPoint[]>([]);

  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);
  private readonly pointsByKey = new Map<string, MetricPoint>();
  private readonly loadedHistoryNames = new Map<string, Set<string>>();
  private readonly loadedAllHistoryServices = new Set<string>();
  private readonly loadingHistoryRequests = new Set<string>();

  private isSubscribed = false;
  private latestMinuteBucket = 0;
  private cacheWriteTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly resubscribeOnReconnectEffect = effect(() => {
    const isConnected = this.networkService.isConnected$$();
    if (isConnected && this.isSubscribed) {
      untracked(() => this.sendSubscribe());
    }
  });

  constructor() {
    void idbGet<MetricPoint[]>(buildCacheKey(STORAGE_KEY)).then((cached) => {
      if (cached) {
        this.mergePoints(cached, false);
      }
    });

    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_UPDATE) {
        this.mergePoints(message.payload.points);
      }
    });
  }

  public subscribe(): void {
    this.isSubscribed = true;
    this.sendSubscribe();
  }

  public unsubscribe(): void {
    this.isSubscribed = false;
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_UNSUBSCRIBE });
  }

  public loadHistory(service: string, names?: readonly string[]): void {
    const normalizedService = service.trim();
    if (!normalizedService) return;

    const normalizedNames = names ? Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).sort() : null;
    if (normalizedNames?.length === 0 || this.isHistoryLoaded(normalizedService, normalizedNames)) return;

    const requestKey = `${normalizedService}:${normalizedNames?.join(',') ?? '*'}`;
    if (this.loadingHistoryRequests.has(requestKey)) return;
    this.loadingHistoryRequests.add(requestKey);

    let params = new HttpParams().set('service', normalizedService);
    if (normalizedNames) {
      params = params.set('names', normalizedNames.join(','));
    }
    this.http.get<MetricsHistoryResponse>('/api/metrics/history', { params }).subscribe({
      next: (response) => {
        this.mergeSnapshots(normalizedService, response.snapshots);
        if (normalizedNames) {
          const loadedNames = this.loadedHistoryNames.get(normalizedService) ?? new Set<string>();
          normalizedNames.forEach((name) => loadedNames.add(name));
          this.loadedHistoryNames.set(normalizedService, loadedNames);
        } else {
          this.loadedAllHistoryServices.add(normalizedService);
        }
        this.loadingHistoryRequests.delete(requestKey);
      },
      error: () => this.loadingHistoryRequests.delete(requestKey),
    });
  }

  public clearCache(): void {
    this.pointsByKey.clear();
    this.latestMinuteBucket = 0;
    this.loadedHistoryNames.clear();
    this.loadedAllHistoryServices.clear();
    this.points$$.set([]);
    if (this.cacheWriteTimeoutId !== null) {
      clearTimeout(this.cacheWriteTimeoutId);
      this.cacheWriteTimeoutId = null;
    }
    void idbRemove(buildCacheKey(STORAGE_KEY));
    if (this.isSubscribed) {
      this.sendSubscribe();
    }
  }

  private sendSubscribe(): void {
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_SUBSCRIBE });
  }

  private isHistoryLoaded(service: string, names: string[] | null): boolean {
    if (this.loadedAllHistoryServices.has(service)) return true;
    if (!names) return false;
    const loadedNames = this.loadedHistoryNames.get(service);
    return !!loadedNames && names.every((name) => loadedNames.has(name));
  }

  private mergeSnapshots(service: string, snapshots: MetricSnapshot[] | null): void {
    if (!snapshots || snapshots.length === 0) return;

    const points: MetricPoint[] = [];
    for (const snapshot of snapshots) {
      if (!this.isValidGranularity(snapshot?.granularity) || !Number.isFinite(snapshot.bucket)) continue;
      for (const [name, value] of Object.entries(snapshot.metrics ?? {})) {
        if (!name || !Number.isFinite(value)) continue;
        points.push({ service, name, granularity: snapshot.granularity, bucket: snapshot.bucket, value });
      }
    }
    this.mergePoints(points);
  }

  private mergePoints(newPoints: MetricPoint[] | null, shouldSave = true): void {
    if (!newPoints || newPoints.length === 0) return;

    for (const point of newPoints) {
      if (!point?.service || !point.name || !this.isValidGranularity(point.granularity) || !Number.isFinite(point.bucket) || !Number.isFinite(point.value)) {
        continue;
      }
      this.pointsByKey.set(this.pointKey(point), point);
      if (point.granularity === 'minute') {
        this.latestMinuteBucket = Math.max(this.latestMinuteBucket, point.bucket);
      }
    }

    this.pruneMinutes();
    this.publishPoints(shouldSave);
  }

  private pruneMinutes(): void {
    const minMinuteBucket = this.latestMinuteBucket - METRICS_WINDOW_SECONDS;
    if (minMinuteBucket <= 0) return;
    for (const [key, point] of this.pointsByKey) {
      if (point.granularity === 'minute' && point.bucket < minMinuteBucket) {
        this.pointsByKey.delete(key);
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

  private scheduleCacheWrite(): void {
    if (this.cacheWriteTimeoutId !== null) return;
    this.cacheWriteTimeoutId = setTimeout(() => {
      this.cacheWriteTimeoutId = null;
      void idbSet(buildCacheKey(STORAGE_KEY), this.points$$());
    }, CACHE_WRITE_DELAY_MS);
  }

  private isValidGranularity(value: unknown): value is MetricGranularity {
    return value === 'minute' || value === 'hour' || value === 'day';
  }

  private pointKey(point: MetricPoint): string {
    return `${point.granularity}:${point.service}:${point.name}:${point.bucket}`;
  }
}
