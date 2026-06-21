import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MetricsHealthService } from '@app/services/metrics-health.service';

@Component({
  selector: 'metrics-health-dot',
  templateUrl: './metrics-health-dot.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsHealthDot {
  protected readonly metricsHealthService = inject(MetricsHealthService);

  protected readonly dotClass$$ = computed(() => {
    switch (this.metricsHealthService.severity$$()) {
      case 'ok':
        return 'bg-green-500';
      case 'warn':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  });
}
