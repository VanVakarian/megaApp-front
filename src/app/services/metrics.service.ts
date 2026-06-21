import { Injectable, effect, inject, signal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NetworkService } from '@app/services/network.service';
import { MetricPoint, WebSocketMessageType } from '@app/shared/types';

const STORAGE_KEY = 'metrics_detail';

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  public readonly points$$ = signal<MetricPoint[]>([]);

  private readonly networkService = inject(NetworkService);
  private readonly localStorageService = inject(LocalStorageService);

  private isSubscribed = false;

  private readonly resubscribeOnReconnectEffect = effect(() => {
    if (this.networkService.isConnected$$() && this.isSubscribed) {
      this.sendSubscribe();
    }
  });

  constructor() {
    const cached = this.localStorageService.getUserScoped<MetricPoint[]>(STORAGE_KEY);
    if (cached) {
      this.points$$.set(cached);
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
    const cursor = this.points$$().reduce((max, point) => Math.max(max, point.bucket), 0);
    this.networkService.sendMessage({ type: WebSocketMessageType.METRICS_SUBSCRIBE, cursor });
  }

  private mergePoints(newPoints: MetricPoint[]): void {
    if (newPoints.length === 0) return;

    const merged = [...this.points$$(), ...newPoints];
    this.points$$.set(merged);
    this.localStorageService.setUserScoped(STORAGE_KEY, merged);
  }
}
