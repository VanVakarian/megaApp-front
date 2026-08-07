import { Injectable, effect, inject, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { DeviceInfoService } from '@app/services/device-info.service';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NetworkService } from '@app/services/network.service';
import { PerformanceMetricRecord, PerformanceMetricsAckWsMessage, WebSocketMessageType } from '@app/shared/types';

type PerformanceAttributes = Record<string, string | number | boolean>;

interface PerformanceMetricsQueue {
  events: PerformanceMetricRecord[];
  dropped: number;
  firstQueuedAtMs: number;
  nextSequence: number;
}

interface ConnectionInformationLike {
  effectiveType?: string;
  rtt?: number;
}

const STORAGE_KEY = 'performance_metrics_queue';
const MAX_QUEUE_BYTES = 1024 * 1024;
const MAX_BATCH_BYTES = 48 * 1024;
const MAX_BATCH_EVENTS = 100;
const UPLOAD_INTERVAL_MS = 60 * 1000; // Temporary diagnostic interval.
const PERSIST_DELAY_MS = 1000;
const ACK_TIMEOUT_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class PerformanceMetricsService {
  private readonly router = inject(Router);
  private readonly deviceInfoService = inject(DeviceInfoService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly networkService = inject(NetworkService);

  private queue: PerformanceMetricsQueue = this.readQueue();
  private readonly sessionId = crypto.randomUUID();
  private persistTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private inFlight: { batchId: string; eventIds: string[]; dropped: number } | null = null;
  private ackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isDrainingQueue = false;
  private routeStarts = new Map<number, number>();

  public constructor() {
    effect(() => {
      const isConnected = this.networkService.isConnected$$();
      if (!isConnected) {
        this.inFlight = null;
        this.clearAckTimeout();
        return;
      }
      untracked(() => this.tryUpload());
    });

    this.networkService.wsMessages$.subscribe((message) => {
      if (message.type === WebSocketMessageType.PERFORMANCE_METRICS_ACK) {
        this.handleAck(message);
      }
    });

    this.router.events.subscribe((event) => this.handleRouterEvent(event));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.flushQueue);
    this.observeBrowserPerformance();
  }

  public measure<T>(operation: string, work: () => T, attributes?: (result: T) => PerformanceAttributes): T {
    const startedAt = performance.now();
    try {
      const result = work();
      untracked(() => this.record(operation, performance.now() - startedAt, attributes?.(result)));
      return result;
    } catch (error) {
      untracked(() => this.record(operation, performance.now() - startedAt, undefined, 'error'));
      throw error;
    }
  }

  public async measureAsync<T>(
    operation: string,
    work: () => Promise<T>,
    attributes?: (result: T) => PerformanceAttributes,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await work();
      untracked(() => this.record(operation, performance.now() - startedAt, attributes?.(result)));
      return result;
    } catch (error) {
      untracked(() => this.record(operation, performance.now() - startedAt, undefined, 'error'));
      throw error;
    }
  }

  public record(
    operation: string,
    elapsedMs: number,
    attributes?: PerformanceAttributes,
    outcome: PerformanceMetricRecord['outcome'] = 'success',
    renderMs?: number,
  ): void {
    if (!this.networkService.isConnected$$()) return;

    const event: PerformanceMetricRecord = {
      eventId: `${this.sessionId}:${this.queue.nextSequence++}`,
      timestampMs: Date.now(),
      sessionId: this.sessionId,
      operation,
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      ...(renderMs === undefined ? {} : { renderMs: Math.max(0, Math.round(renderMs)) }),
      route: this.router.url,
      outcome,
      ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
      device: this.deviceContext(),
    };

    this.queue.events.push(event);
    this.trimQueue();
    if (this.queue.firstQueuedAtMs === 0) this.queue.firstQueuedAtMs = Date.now();
    this.schedulePersist();
    this.tryUpload();
  }

  public async recordAfterPaint(
    operation: string,
    startedAt: number,
    attributes?: PerformanceAttributes,
    outcome: PerformanceMetricRecord['outcome'] = 'success',
  ): Promise<void> {
    const beforePaint = performance.now();
    await this.nextPaint();
    this.record(operation, performance.now() - startedAt, attributes, outcome, performance.now() - beforePaint);
  }

  private handleRouterEvent(event: unknown): void {
    if (event instanceof NavigationStart) {
      this.routeStarts.set(event.id, performance.now());
      return;
    }
    if (event instanceof NavigationEnd) {
      const startedAt = this.routeStarts.get(event.id);
      this.routeStarts.delete(event.id);
      if (startedAt !== undefined)
        void this.recordAfterPaint('app.route_ready', startedAt, { route: event.urlAfterRedirects });
      return;
    }
    if (event instanceof NavigationCancel || event instanceof NavigationError) {
      this.routeStarts.delete(event.id);
    }
  }

  private observeBrowserPerformance(): void {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      this.record('app.navigation_timing', navigation.duration, {
        domContentLoadedMs: Math.round((navigation as PerformanceNavigationTiming).domContentLoadedEventEnd),
        loadMs: Math.round((navigation as PerformanceNavigationTiming).loadEventEnd),
      });
    }

    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.record('app.long_task', entry.duration, { startMs: Math.round(entry.startTime) });
          }
          if (entry.entryType === 'event' && entry.duration >= 40) {
            this.record('app.interaction_delay', entry.duration, { name: entry.name });
          }
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit & {
        durationThreshold: number;
      });
    } catch {
      // Safari and older browsers expose neither longtask nor event timing.
    }
  }

  private tryUpload(): void {
    if (
      this.inFlight ||
      !this.networkService.isConnected$$() ||
      this.queue.events.length === 0 ||
      (!this.isDrainingQueue && Date.now() - this.queue.firstQueuedAtMs < UPLOAD_INTERVAL_MS)
    ) {
      return;
    }

    const events: PerformanceMetricRecord[] = [];
    for (const event of this.queue.events) {
      if (events.length >= MAX_BATCH_EVENTS) break;
      const candidate = [...events, event];
      if (
        JSON.stringify({
          type: WebSocketMessageType.PERFORMANCE_METRICS_BATCH,
          payload: { batchId: 'x', events: candidate, dropped: this.queue.dropped },
        }).length > MAX_BATCH_BYTES
      ) {
        break;
      }
      events.push(event);
    }
    if (events.length === 0) return;

    this.flushQueue();
    const batchId = crypto.randomUUID();
    this.inFlight = { batchId, eventIds: events.map((event) => event.eventId), dropped: this.queue.dropped };
    this.isDrainingQueue = true;
    if (!this.networkService.sendMessage({
      type: WebSocketMessageType.PERFORMANCE_METRICS_BATCH,
      payload: { batchId, events, dropped: this.queue.dropped },
    })) {
      this.inFlight = null;
      return;
    }
    this.ackTimeoutId = setTimeout(() => {
      this.ackTimeoutId = null;
      if (!this.inFlight || this.inFlight.batchId !== batchId) return;
      this.inFlight = null;
      this.tryUpload();
    }, ACK_TIMEOUT_MS);
  }

  private handleAck(message: PerformanceMetricsAckWsMessage): void {
    if (!this.inFlight || message.payload.batchId !== this.inFlight.batchId) return;
    const acceptedIds = new Set(message.payload.eventIds);
    this.queue.events = this.queue.events.filter((event) => !acceptedIds.has(event.eventId));
    this.queue.dropped = Math.max(0, this.queue.dropped - this.inFlight.dropped);
    this.inFlight = null;
    this.clearAckTimeout();
    this.queue.firstQueuedAtMs = this.queue.events.length > 0 ? this.queue.firstQueuedAtMs : 0;
    if (this.queue.events.length === 0) this.isDrainingQueue = false;
    this.flushQueue();
    this.tryUpload();
  }

  private trimQueue(): void {
    while (this.queue.events.length > 0 && JSON.stringify(this.queue).length > MAX_QUEUE_BYTES) {
      this.queue.events.shift();
      this.queue.dropped += 1;
    }
  }

  private clearAckTimeout(): void {
    if (this.ackTimeoutId === null) return;
    clearTimeout(this.ackTimeoutId);
    this.ackTimeoutId = null;
  }

  private readQueue(): PerformanceMetricsQueue {
    const saved = this.localStorageService.getUserScoped<Partial<PerformanceMetricsQueue>>(STORAGE_KEY);
    return {
      events: Array.isArray(saved?.events) ? saved.events : [],
      dropped: Number.isFinite(saved?.dropped) ? saved!.dropped! : 0,
      firstQueuedAtMs: Number.isFinite(saved?.firstQueuedAtMs) ? saved!.firstQueuedAtMs! : 0,
      nextSequence: Number.isFinite(saved?.nextSequence) ? saved!.nextSequence! : 1,
    };
  }

  private schedulePersist(): void {
    if (this.persistTimeoutId !== null) return;
    this.persistTimeoutId = setTimeout(() => {
      this.persistTimeoutId = null;
      this.flushQueue();
    }, PERSIST_DELAY_MS);
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') this.tryUpload();
    else this.flushQueue();
  };

  private readonly flushQueue = (): void => {
    if (this.persistTimeoutId !== null) {
      clearTimeout(this.persistTimeoutId);
      this.persistTimeoutId = null;
    }
    this.localStorageService.setUserScoped(STORAGE_KEY, this.queue);
  };

  private deviceContext(): PerformanceMetricRecord['device'] {
    const connection = (navigator as Navigator & { connection?: ConnectionInformationLike }).connection;
    return {
      platform: this.deviceInfoService.getDevicePlatform(),
      mobileDevice: this.deviceInfoService.isMobileDevice$$(),
      mobileScreen: this.deviceInfoService.isMobileScreen$$(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      dpr: window.devicePixelRatio,
      touchPoints: navigator.maxTouchPoints,
      ...(navigator.hardwareConcurrency ? { hardwareConcurrency: navigator.hardwareConcurrency } : {}),
      ...((navigator as Navigator & { deviceMemory?: number }).deviceMemory
        ? { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory }
        : {}),
      ...(connection?.effectiveType ? { connectionType: connection.effectiveType } : {}),
      ...(connection?.rtt ? { connectionRtt: connection.rtt } : {}),
      userAgent: navigator.userAgent,
    };
  }

  private nextPaint(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

}
