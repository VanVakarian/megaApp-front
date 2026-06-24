import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NetworkService } from '@app/services/network.service';
import { MetricPoint, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';
const METRICS_WINDOW_SECONDS = 48 * 60 * 60;

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  public readonly points$$ = signal<MetricPoint[]>([]);

  private readonly networkService = inject(NetworkService);
  private readonly localStorageService = inject(LocalStorageService);

  private isSubscribed = false;

  private readonly resubscribeOnReconnectEffect = effect(() => {
    const isConnected = this.networkService.isConnected$$();
    if (isConnected && this.isSubscribed) {
      untracked(() => this.sendSubscribe());
    }
  });

  constructor() {
    const cached = this.localStorageService.getUserScoped<MetricPoint[]>(STORAGE_KEY);
    if (cached) {
      this.points$$.set(cached.filter((point) => !!point?.service && !!point?.name && Number.isFinite(point?.bucket)));
    }

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
    const latestBucket = this.points$$().reduce((max, point) => Math.max(max, point.bucket), 0);
    const cursor = latestBucket > 0 ? Math.max(0, latestBucket - METRICS_WINDOW_SECONDS) : 0;
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

    const merged = Array.from(byKey.values())
      .sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket - b.bucket;
        if (a.service !== b.service) return a.service.localeCompare(b.service);
        return a.name.localeCompare(b.name);
      });

    const latestBucket = merged.reduce((max, point) => Math.max(max, point.bucket), 0);
    const minBucket = latestBucket > 0 ? latestBucket - METRICS_WINDOW_SECONDS : 0;
    const pruned = merged.filter((point) => point.bucket >= minBucket);

    this.points$$.set(pruned);
    this.localStorageService.setUserScoped(STORAGE_KEY, pruned);
  }

  private pointKey(point: MetricPoint): string {
    return `${point.service}:${point.name}:${point.bucket}`;
  }
}
