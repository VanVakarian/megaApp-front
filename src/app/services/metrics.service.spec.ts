import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IndexedDbCacheService } from '@app/services/indexed-db-cache.service';
import { NetworkService } from '@app/services/network.service';
import { NotificationService } from '@app/services/notification.service';
import { PerformanceMetricsService } from '@app/services/performance-metrics.service';
import { IncomingWsMessage, MetricPoint, WebSocketMessageType } from '@app/shared/types';
import { createPerformanceMetricsFake } from '@app/testing/performance-metrics.fake';
import { Subject } from 'rxjs';
import { MetricsService } from './metrics.service';

function metricPoint(overrides: Partial<MetricPoint> = {}): MetricPoint {
  return { service: 'api', name: 'requests', granularity: 'minute', bucket: 1_000_000, value: 1, ...overrides };
}

function setup() {
  const wsMessages$ = new Subject<IncomingWsMessage>();
  const networkServiceFake: Pick<NetworkService, 'wsMessages$' | 'isConnected$$' | 'sendMessage'> = {
    wsMessages$,
    isConnected$$: signal(false),
    sendMessage: vi.fn(() => true),
  };
  const notificationServiceFake: Pick<NotificationService, 'addNotification'> = {
    addNotification: vi.fn(() => 'notification-id'),
  };
  const indexedDbCacheFake: Pick<IndexedDbCacheService, 'get' | 'set' | 'remove'> = {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: NetworkService, useValue: networkServiceFake },
      { provide: NotificationService, useValue: notificationServiceFake },
      { provide: IndexedDbCacheService, useValue: indexedDbCacheFake },
      { provide: PerformanceMetricsService, useValue: createPerformanceMetricsFake() },
    ],
  });

  return {
    service: TestBed.inject(MetricsService),
    httpMock: TestBed.inject(HttpTestingController),
    wsMessages$,
  };
}

function pushUpdate(wsMessages$: Subject<IncomingWsMessage>, points: MetricPoint[]): void {
  wsMessages$.next({ type: WebSocketMessageType.METRICS_UPDATE, payload: { points } });
}

describe('MetricsService — point dedup (pointKey/insertPoint)', () => {
  it('keeps only the latest value for points sharing the same service/name/granularity/bucket key', () => {
    const { service, wsMessages$ } = setup();
    pushUpdate(wsMessages$, [metricPoint({ value: 10 })]);
    pushUpdate(wsMessages$, [metricPoint({ value: 20 })]);
    expect(service.points$$()).toEqual([metricPoint({ value: 20 })]);
  });

  it('drops a point with a non-finite value or an unrecognized granularity instead of throwing', () => {
    const { service, wsMessages$ } = setup();
    pushUpdate(wsMessages$, [
      metricPoint({ value: NaN }),
      { ...metricPoint({ name: 'errors' }), granularity: 'century' as never },
    ]);
    expect(service.points$$()).toEqual([]);
  });
});

describe('MetricsService — pruning (prunePoints)', () => {
  it('drops points older than the granularity cache window once a newer bucket for that granularity arrives', () => {
    const { service, wsMessages$ } = setup();
    const oldPoint = metricPoint({ bucket: 1_000_000 });
    const newPoint = metricPoint({ name: 'errors', bucket: 1_000_000 + 200_000 }); // 200_000s > 172_800s (48h minute window)
    pushUpdate(wsMessages$, [oldPoint, newPoint]);
    expect(service.points$$()).toEqual([newPoint]);
  });
});

describe('MetricsService.forceRefresh — mergeHistories', () => {
  it('flattens a history response into points and applies the same dedup rules', () => {
    const { service, httpMock } = setup();
    service.forceRefresh();

    const req = httpMock.expectOne((r) => r.url === '/api/metrics/history');
    req.flush({
      histories: [
        {
          service: 'api',
          snapshots: [{ granularity: 'minute', bucket: 1_000_000, metrics: { requests: 42 } }],
        },
      ],
    });

    expect(service.points$$()).toEqual([metricPoint({ bucket: 1_000_000, value: 42 })]);
    httpMock.verify();
  });
});
