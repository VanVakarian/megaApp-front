import { Injectable, computed, inject, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { MetricsHealthSeverity, ServiceHealth, WebSocketMessageType } from '@app/shared/types';

const SEVERITY_RANK: Record<MetricsHealthSeverity, number> = { ok: 0, warn: 1, error: 2 };

@Injectable({
  providedIn: 'root',
})
export class MetricsHealthService {
  public readonly services$$ = signal<ServiceHealth[]>([]);

  public readonly overallSeverity$$ = computed<MetricsHealthSeverity | null>(() => {
    const services = this.services$$();
    if (services.length === 0) return null;
    return services.reduce<MetricsHealthSeverity>(
      (worst, service) => (SEVERITY_RANK[service.severity] > SEVERITY_RANK[worst] ? service.severity : worst),
      'ok',
    );
  });

  private readonly networkService = inject(NetworkService);

  constructor() {
    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_HEALTH) {
        this.services$$.set(message.payload.services);
      }
    });
  }
}
