import { PerformanceMetricsService } from '@app/services/performance-metrics.service';

// PerformanceMetricsService is itself heavy (injects Router/DeviceInfoService/LocalStorageService/
// NetworkService, runs an effect() and setTimeout-based timers in its constructor). Every Группа B/C
// test that has it as a direct dependency should override it via this fake instead of letting
// TestBed construct the real thing — see plans/29-frontend-unit-test-coverage.implementation-plan.md.
export function createPerformanceMetricsFake(): Pick<
  PerformanceMetricsService,
  'measure' | 'measureAsync' | 'record' | 'recordAfterPaint'
> {
  return {
    measure: (_operation, work) => work(),
    measureAsync: (_operation, work) => work(),
    record: () => {},
    recordAfterPaint: async () => {},
  };
}
