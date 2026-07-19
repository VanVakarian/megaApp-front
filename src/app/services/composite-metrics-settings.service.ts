import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';

export const COMPOSITE_SERVICE_KEY = '__composite__';

export interface CompositeMetricDefinition {
  id: string;
  metricName: string;
  serviceA: string;
  serviceB: string;
}

const STORAGE_KEY = 'composite_metrics_definitions';

// Local-only by design: no server sync, no debounce, unlike MetricsSettingsService.
// Definitions are recomputed into chart series on the fly (see metrics-dashboard.ts),
// nothing derived from them is persisted anywhere.
@Injectable({
  providedIn: 'root',
})
export class CompositeMetricsSettingsService {
  public readonly definitions$$: WritableSignal<CompositeMetricDefinition[]>;

  private readonly localStorageService = inject(LocalStorageService);

  constructor() {
    const stored = this.localStorageService.getUserScoped<CompositeMetricDefinition[]>(STORAGE_KEY) ?? [];
    this.definitions$$ = signal(stored);
  }

  public addDefinition(): void {
    this.persist([...this.definitions$$(), { id: crypto.randomUUID(), metricName: '', serviceA: '', serviceB: '' }]);
  }

  public removeDefinition(id: string): void {
    this.persist(this.definitions$$().filter((definition) => definition.id !== id));
  }

  public setMetricName(id: string, metricName: string): void {
    this.updateDefinition(id, { metricName });
  }

  public setServiceA(id: string, serviceA: string): void {
    this.updateDefinition(id, { serviceA });
  }

  public setServiceB(id: string, serviceB: string): void {
    this.updateDefinition(id, { serviceB });
  }

  private updateDefinition(id: string, patch: Partial<Omit<CompositeMetricDefinition, 'id'>>): void {
    this.persist(this.definitions$$().map((definition) => (definition.id === id ? { ...definition, ...patch } : definition)));
  }

  private persist(next: CompositeMetricDefinition[]): void {
    this.definitions$$.set(next);
    this.localStorageService.setUserScoped(STORAGE_KEY, next);
  }
}
