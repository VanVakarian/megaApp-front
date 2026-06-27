import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { buildCacheKey } from '@app/shared/cache';
import { idbGet, idbSet } from '@app/shared/idb-cache';
import { MetricPoint, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';
const METRICS_WINDOW_SECONDS = 48 * 60 * 60;

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  public readonly points$$ = signal<MetricPoint[]>([]);

  private readonly networkService = inject(NetworkService);

  private isSubscribed = false;

  private readonly resubscribeOnReconnectEffect = effect(() => {
    const isConnected = this.networkService.isConnected$$();
    if (isConnected && this.isSubscribed) {
      untracked(() => this.sendSubscribe());
    }
  });

  constructor() {
    void idbGet<MetricPoint[]>(buildCacheKey(STORAGE_KEY)).then((cached) => {
      if (cached) {
        this.points$$.set(
          cached.filter(
            (point) => !!point?.service && !!point?.name && !!point?.granularity && Number.isFinite(point?.bucket),
          ),
        );
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

  private sendSubscribe(): void {
    // The cursor only ever bounds the minute stream — the backend relays
    // hour/day history within its own fixed windows regardless of cursor.
    const latestMinuteBucket = this.points$$()
      .filter((point) => point.granularity === 'minute')
      .reduce((max, point) => Math.max(max, point.bucket), 0);
    const nowBucket = Math.floor(Date.now() / 1000);
    const fallbackBucket = latestMinuteBucket > 0 ? latestMinuteBucket : nowBucket;
    const cursor = Math.max(0, fallbackBucket - METRICS_WINDOW_SECONDS);
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_SUBSCRIBE, cursor });
  }

  private mergePoints(newPoints: MetricPoint[] | null): void {
    if (!newPoints || newPoints.length === 0) return;

    const byKey = new Map<string, MetricPoint>();
    for (const point of this.points$$()) {
      byKey.set(this.pointKey(point), point);
    }
    for (const point of newPoints) {
      byKey.set(this.pointKey(point), point);
    }

    const merged = Array.from(byKey.values()).sort((a, b) => {
      if (a.bucket !== b.bucket) return a.bucket - b.bucket;
      if (a.service !== b.service) return a.service.localeCompare(b.service);
      return a.name.localeCompare(b.name);
    });

    // Only the minute stream is bounded client-side — hour/day volume is
    // tiny and already bounded by the backend's own relay window.
    const latestMinuteBucket = merged
      .filter((point) => point.granularity === 'minute')
      .reduce((max, point) => Math.max(max, point.bucket), 0);
    const minMinuteBucket = latestMinuteBucket > 0 ? latestMinuteBucket - METRICS_WINDOW_SECONDS : 0;
    const pruned = merged.filter((point) => point.granularity !== 'minute' || point.bucket >= minMinuteBucket);

    this.points$$.set(pruned);
    void idbSet(buildCacheKey(STORAGE_KEY), pruned);
  }

  private pointKey(point: MetricPoint): string {
    return `${point.granularity}:${point.service}:${point.name}:${point.bucket}`;
  }
}
