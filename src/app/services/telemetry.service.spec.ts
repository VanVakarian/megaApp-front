import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DeviceInfoService } from '@app/services/device-info.service';
import { LocalStorageService } from '@app/services/local-storage.service';
import { Subject } from 'rxjs';
import { TelemetryService } from './telemetry.service';

const EVENTS_URL = '/api/telemetry/events';
const BATCH_WINDOW_MS = 60 * 1000;

function setup() {
  const routerFake: Pick<Router, 'url' | 'events'> = { url: '/money', events: new Subject() };
  const deviceInfoFake: Pick<DeviceInfoService, 'getDevicePlatform' | 'isMobileDevice$$' | 'isMobileScreen$$'> = {
    getDevicePlatform: () => 'desktop',
    isMobileDevice$$: (() => false) as DeviceInfoService['isMobileDevice$$'],
    isMobileScreen$$: (() => false) as DeviceInfoService['isMobileScreen$$'],
  };
  const localStorageFake: Pick<LocalStorageService, 'getUserScoped' | 'setUserScoped'> = {
    getUserScoped: () => null,
    setUserScoped: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: Router, useValue: routerFake },
      { provide: DeviceInfoService, useValue: deviceInfoFake },
      { provide: LocalStorageService, useValue: localStorageFake },
    ],
  });

  return {
    service: TestBed.inject(TelemetryService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

interface RequestBody {
  events: { eventId: string; operation: string; message?: string; attributes?: Record<string, unknown> }[];
  dropped: number;
}

describe('TelemetryService — batching window', () => {
  afterEach(() => vi.useRealTimers());

  it('sends the first event into an empty queue immediately, as its own batch', () => {
    const { service, httpMock } = setup();

    service.record('app.route_ready', 12);

    const request = httpMock.expectOne(EVENTS_URL);
    const body = request.request.body as RequestBody;
    expect(body.events).toHaveLength(1);
    expect(body.events[0].operation).toBe('app.route_ready');
    request.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('accumulates further events during the window and flushes them together when it closes', async () => {
    vi.useFakeTimers();
    const { service, httpMock } = setup();

    service.record('app.a', 1);
    httpMock.expectOne(EVENTS_URL).flush(null, { status: 204, statusText: 'No Content' });

    service.record('app.b', 2);
    service.record('app.c', 3);
    httpMock.expectNone(EVENTS_URL);

    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);

    const request = httpMock.expectOne(EVENTS_URL);
    const body = request.request.body as RequestBody;
    expect(body.events.map((event) => event.operation)).toEqual(['app.b', 'app.c']);
    request.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('keeps a batch queued and retries it after the window on a 5xx response', async () => {
    vi.useFakeTimers();
    const { service, httpMock } = setup();

    service.record('app.a', 1);
    httpMock.expectOne(EVENTS_URL).flush(null, { status: 500, statusText: 'Server Error' });

    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);

    const retry = httpMock.expectOne(EVENTS_URL);
    expect((retry.request.body as RequestBody).events).toHaveLength(1);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('drops a batch without retrying it after a 4xx response', async () => {
    vi.useFakeTimers();
    const { service, httpMock } = setup();

    service.record('app.a', 1);
    httpMock.expectOne(EVENTS_URL).flush(null, { status: 400, statusText: 'Bad Request' });

    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
    httpMock.expectNone(EVENTS_URL);
  });

  it('drains an oversized backlog across chunks, sending the next chunk right after the previous succeeds', () => {
    const { service, httpMock } = setup();
    // ~220 KB attribute string per event: two fit under the 512 KB chunk cap, a third pushes it over.
    const pad = 'x'.repeat(220_000);

    // 'a' is the trigger event, sent alone and immediately — that's unavoidable and not what's
    // under test here. What matters is how the backlog queued behind it gets chunked.
    service.record('app.a', 0, {});
    const first = httpMock.expectOne(EVENTS_URL);
    expect((first.request.body as RequestBody).events).toHaveLength(1);

    // Queued while the first request is still in flight.
    service.record('app.b', 1, { pad });
    service.record('app.c', 2, { pad });
    service.record('app.d', 3, { pad });
    httpMock.expectNone(EVENTS_URL);

    first.flush(null, { status: 204, statusText: 'No Content' });

    // Draining continues immediately (no waiting for the window) — chunked to stay under the cap.
    const second = httpMock.expectOne(EVENTS_URL);
    expect((second.request.body as RequestBody).events.map((event) => event.operation)).toEqual(['app.b', 'app.c']);
    second.flush(null, { status: 204, statusText: 'No Content' });

    const third = httpMock.expectOne(EVENTS_URL);
    expect((third.request.body as RequestBody).events.map((event) => event.operation)).toEqual(['app.d']);
    third.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('stops draining on a mid-backlog 5xx and waits the full window before retrying, instead of looping', async () => {
    vi.useFakeTimers();
    const { service, httpMock } = setup();
    const pad = 'x'.repeat(220_000);

    service.record('app.a', 0, {});
    const first = httpMock.expectOne(EVENTS_URL);
    service.record('app.b', 1, { pad });
    service.record('app.c', 2, { pad });
    first.flush(null, { status: 204, statusText: 'No Content' });

    const second = httpMock.expectOne(EVENTS_URL);
    expect((second.request.body as RequestBody).events.map((event) => event.operation)).toEqual(['app.b', 'app.c']);
    second.flush(null, { status: 500, statusText: 'Server Error' });

    // No immediate re-attempt right after the failure.
    httpMock.expectNone(EVENTS_URL);

    // Still nothing just before the window elapses.
    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS - 1000);
    httpMock.expectNone(EVENTS_URL);

    await vi.advanceTimersByTimeAsync(1000);
    const retry = httpMock.expectOne(EVENTS_URL);
    expect((retry.request.body as RequestBody).events.map((event) => event.operation)).toEqual(['app.b', 'app.c']);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });
});

describe('TelemetryService — error rate limiting', () => {
  afterEach(() => vi.useRealTimers());

  it('suppresses an identical repeated error and reports the suppressed count once the limit passes', async () => {
    vi.useFakeTimers();
    const { service, httpMock } = setup();

    service.logError(new Error('boom'));
    const first = httpMock.expectOne(EVENTS_URL);
    expect((first.request.body as RequestBody).events).toHaveLength(1);
    first.flush(null, { status: 204, statusText: 'No Content' });

    // Same signature, well within the 10s rate-limit window: suppressed, not sent.
    service.logError(new Error('boom'));
    httpMock.expectNone(EVENTS_URL);

    // Past the rate-limit window: goes through again, carrying the suppressed count.
    await vi.advanceTimersByTimeAsync(11 * 1000);
    service.logError(new Error('boom'));

    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
    const request = httpMock.expectOne(EVENTS_URL);
    const body = request.request.body as RequestBody;
    expect(body.events[0].attributes?.['suppressedRepeats']).toBe(1);
    request.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });
});
