import { Injectable, computed, inject, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { MetricsHealthSeverity, ServiceHealth, ServiceLatest, WebSocketMessageType } from '@app/shared/types';

const SEVERITY_RANK: Record<MetricsHealthSeverity, number> = { ok: 0, warn: 1, error: 2 };
const WARN_AFTER_SECONDS = 90;
const ERROR_AFTER_SECONDS = 180;
const NOW_TICK_INTERVAL_MS = 30_000;

@Injectable({
  providedIn: 'root',
})
export class MetricsHealthService {
  public readonly services$$ = computed<ServiceHealth[]>(() => {
    const nowSeconds = Math.floor(this.now$$() / 1000);
    return this.latestServices$$().map((service) => ({
      service: service.service,
      severity: this.severityFromLatest(service, nowSeconds),
    }));
  });

  public readonly overallSeverity$$ = computed<MetricsHealthSeverity | null>(() => {
    const services = this.services$$();
    if (services.length === 0) return null;
    return services.reduce<MetricsHealthSeverity>(
      (worst, service) => (SEVERITY_RANK[service.severity] > SEVERITY_RANK[worst] ? service.severity : worst),
      'ok',
    );
  });

  private readonly networkService = inject(NetworkService);
  private readonly latestServices$$ = signal<ServiceLatest[]>([]);
  private readonly now$$ = signal(Date.now());
  private readonly nowTickIntervalId = setInterval(() => this.now$$.set(Date.now()), NOW_TICK_INTERVAL_MS);

  constructor() {
    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.METRICS_LATEST) {
        this.latestServices$$.set(message.payload.services);
      }
    });
  }

  private severityFromLatest(service: ServiceLatest, nowSeconds: number): MetricsHealthSeverity {
    if (!Number.isFinite(service.lastBucket) || service.lastBucket <= 0) {
      return 'error';
    }

    const ageSeconds = nowSeconds - service.lastBucket;
    if (ageSeconds > ERROR_AFTER_SECONDS) {
      return 'error';
    }
    if (ageSeconds > WARN_AFTER_SECONDS) {
      return 'warn';
    }
    return 'ok';
  }
}
