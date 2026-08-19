import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MetricsSettingsService } from '@app/services/metrics-settings.service';
import { NetworkService } from '@app/services/network.service';
import { IncomingWsMessage, ServiceLatest, WebSocketMessageType } from '@app/shared/types';
import { Subject } from 'rxjs';
import { MetricsHealthService } from './metrics-health.service';

const NOW_TICK_INTERVAL_MS = 30_000;
const BASE_TIME_ISO = '2026-01-01T00:00:00.000Z';

function service(overrides: Partial<ServiceLatest> = {}): ServiceLatest {
  return { service: 'api', lastBucket: 0, metrics: {}, ...overrides };
}

function setup() {
  const wsMessages$ = new Subject<IncomingWsMessage>();
  const networkServiceFake: Pick<NetworkService, 'wsMessages$'> = { wsMessages$ };
  const settingsServiceFake: Pick<
    MetricsSettingsService,
    'severityThresholdOverrides$$' | 'setSeverityThresholdOverrides'
  > = {
    severityThresholdOverrides$$: signal({}),
    setSeverityThresholdOverrides: () => {},
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: NetworkService, useValue: networkServiceFake },
      { provide: MetricsSettingsService, useValue: settingsServiceFake },
    ],
  });
  const healthService = TestBed.inject(MetricsHealthService);

  function pushLatest(services: ServiceLatest[]): void {
    wsMessages$.next({ type: WebSocketMessageType.METRICS_LATEST, payload: { services } });
  }

  return { healthService, pushLatest };
}

describe('MetricsHealthService.services$$', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_TIME_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is empty until a METRICS_LATEST message arrives over the socket', () => {
    const { healthService } = setup();
    expect(healthService.services$$()).toEqual([]);
    expect(healthService.overallSeverity$$()).toBeNull();
  });

  it('is ok when the service reported within warnAfterSeconds (default 150s)', () => {
    const { healthService, pushLatest } = setup();
    const nowSeconds = Math.floor(Date.now() / 1000);
    pushLatest([service({ lastBucket: nowSeconds - 100 })]);
    expect(healthService.services$$()).toEqual([{ service: 'api', severity: 'ok' }]);
  });

  it('is warn once age exceeds warnAfterSeconds but stays within errorAfterSeconds (default 300s)', () => {
    const { healthService, pushLatest } = setup();
    const nowSeconds = Math.floor(Date.now() / 1000);
    pushLatest([service({ lastBucket: nowSeconds - 200 })]);
    expect(healthService.services$$()).toEqual([{ service: 'api', severity: 'warn' }]);
  });

  it('is error once age exceeds errorAfterSeconds (default 300s)', () => {
    const { healthService, pushLatest } = setup();
    const nowSeconds = Math.floor(Date.now() / 1000);
    pushLatest([service({ lastBucket: nowSeconds - 400 })]);
    expect(healthService.services$$()).toEqual([{ service: 'api', severity: 'error' }]);
  });

  it('is error for a non-finite or non-positive lastBucket, regardless of age', () => {
    const { healthService, pushLatest } = setup();
    pushLatest([service({ lastBucket: 0 }), service({ service: 'nan', lastBucket: NaN })]);
    expect(healthService.services$$()).toEqual([
      { service: 'api', severity: 'error' },
      { service: 'nan', severity: 'error' },
    ]);
  });

  it('re-derives severity purely from the passage of time via the periodic tick, with no new message', () => {
    const { healthService, pushLatest } = setup();
    const nowSeconds = Math.floor(Date.now() / 1000);
    pushLatest([service({ lastBucket: nowSeconds - 100 })]);
    expect(healthService.services$$()[0].severity).toBe('ok');

    vi.advanceTimersByTime(NOW_TICK_INTERVAL_MS * 20); // 600s of ticks -> well past errorAfterSeconds
    expect(healthService.services$$()[0].severity).toBe('error');
  });
});

describe('MetricsHealthService.overallSeverity$$', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_TIME_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the worst severity across every reported service', () => {
    const { healthService, pushLatest } = setup();
    const nowSeconds = Math.floor(Date.now() / 1000);
    pushLatest([
      service({ service: 'ok-svc', lastBucket: nowSeconds - 10 }),
      service({ service: 'warn-svc', lastBucket: nowSeconds - 200 }),
      service({ service: 'error-svc', lastBucket: nowSeconds - 400 }),
    ]);
    expect(healthService.overallSeverity$$()).toBe('error');
  });
});

describe('MetricsHealthService.severityThresholds/setSeverityThresholds', () => {
  it('falls back to the default thresholds when no override is set for the service', () => {
    const { healthService } = setup();
    expect(healthService.severityThresholds('api')).toEqual({ warnAfterSeconds: 150, errorAfterSeconds: 300 });
  });
});
