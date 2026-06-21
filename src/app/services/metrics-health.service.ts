import { Injectable, inject, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { MetricsHealthStatus, WebSocketMessageType } from '@app/shared/types';

@Injectable({
  providedIn: 'root',
})
export class MetricsHealthService {
  public readonly severity$$ = signal<MetricsHealthStatus['severity'] | null>(null);

  private readonly networkService = inject(NetworkService);

  constructor() {
    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_HEALTH) {
        this.severity$$.set(message.payload.severity);
      }
    });
  }
}
