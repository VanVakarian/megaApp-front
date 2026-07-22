import { inject, Injectable, WritableSignal } from '@angular/core';
import { MetricsSettingsService } from '@app/services/metrics-settings.service';
import { CompositeMetricDefinition } from '@app/shared/types';

// CRUD-only facade — the array itself lives on MetricsSettingsService and rides
// its explicit-save flow (isDirty$$/saveNow), same as every other metrics setting.
@Injectable({
  providedIn: 'root',
})
export class CompositeMetricsSettingsService {
  private readonly metricsSettingsService = inject(MetricsSettingsService);

  public readonly definitions$$: WritableSignal<CompositeMetricDefinition[]> =
    this.metricsSettingsService.compositeMetrics$$;

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
    this.persist(
      this.definitions$$().map((definition) => (definition.id === id ? { ...definition, ...patch } : definition)),
    );
  }

  private persist(next: CompositeMetricDefinition[]): void {
    this.metricsSettingsService.setCompositeMetrics(next);
  }
}
