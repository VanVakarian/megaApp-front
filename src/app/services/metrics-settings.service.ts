import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NotificationService } from '@app/services/notification.service';
import { SeverityThresholds } from '@app/shared/metrics-severity';
import { MetricGranularity } from '@app/shared/types';
import { firstValueFrom } from 'rxjs';

export type DashboardMetricSelection = Record<string, Record<string, number>>;
export type DashboardServiceSelection = Record<string, number>;
export type SeverityThresholdsOverrides = Record<string, SeverityThresholds>;
export type ServiceHeaderVisibility = Record<string, boolean>;
export type ServiceCustomLabels = Record<string, string>;

export const CardSizeMode = {
  Small: 'small',
  Large: 'large',
} as const;
export type CardSizeMode = (typeof CardSizeMode)[keyof typeof CardSizeMode];

export interface CardSize {
  widthPx: number;
  heightPx: number;
}

export type CardSizeByMode = Record<CardSizeMode, CardSize>;

interface StoredMetricsSettings {
  cardSizeByMode: CardSizeByMode;
  activeCardSizeMode: CardSizeMode;
  granularity: MetricGranularity;
  syncCrosshairEnabled: boolean;
  forceZeroBaselineEnabled: boolean;
  dashboardSelection: DashboardMetricSelection;
  dashboardServiceSelection: DashboardServiceSelection;
  severityThresholds: SeverityThresholdsOverrides;
  serviceHeaderVisibility: ServiceHeaderVisibility;
  serviceCustomLabels: ServiceCustomLabels;
}

const STORAGE_KEY = 'metrics_settings';
const SETTINGS_ENDPOINT = '/api/metrics-settings/';
const SAVE_DEBOUNCE_MS = 5_000;
const DEFAULT_SMALL_CARD_WIDTH_PX = 304;
const DEFAULT_SMALL_CARD_HEIGHT_PX = 112;
const DEFAULT_LARGE_CARD_WIDTH_PX = 480;
const DEFAULT_LARGE_CARD_HEIGHT_PX = 220;

const DEFAULT_SMALL_CARD_SIZE: CardSize = {
  widthPx: DEFAULT_SMALL_CARD_WIDTH_PX,
  heightPx: DEFAULT_SMALL_CARD_HEIGHT_PX,
};
const DEFAULT_LARGE_CARD_SIZE: CardSize = {
  widthPx: DEFAULT_LARGE_CARD_WIDTH_PX,
  heightPx: DEFAULT_LARGE_CARD_HEIGHT_PX,
};

const DEFAULT_CARD_SIZE_BY_MODE: CardSizeByMode = {
  [CardSizeMode.Small]: DEFAULT_SMALL_CARD_SIZE,
  [CardSizeMode.Large]: DEFAULT_LARGE_CARD_SIZE,
};

const DEFAULTS: StoredMetricsSettings = {
  cardSizeByMode: DEFAULT_CARD_SIZE_BY_MODE,
  activeCardSizeMode: CardSizeMode.Small,
  granularity: 'minute',
  syncCrosshairEnabled: false,
  forceZeroBaselineEnabled: false,
  dashboardSelection: {},
  dashboardServiceSelection: {},
  severityThresholds: {},
  serviceHeaderVisibility: {},
  serviceCustomLabels: {},
};

// Old per-field keys from before settings were combined into STORAGE_KEY — deleted once, never read.
// metrics_selected_service/metrics_settings_expanded are here too: which panel was expanded is no
// longer persisted anywhere — every page load opens on the Dashboard panel, collapsed Settings.
const OBSOLETE_KEYS = [
  'metrics_expanded_services',
  'metrics_selected_service',
  'metrics_settings_expanded',
  'metrics_card_width_px',
  'metrics_card_height_px',
  'metrics_granularity',
  'metrics_sync_crosshair_enabled',
  'metrics_dashboard_selection',
  'metrics_dashboard_service_selection',
  'metrics_severity_thresholds',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidCardSize(value: unknown): value is CardSize {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CardSize>;
  return (
    isFiniteNumber(candidate.widthPx) &&
    candidate.widthPx > 0 &&
    isFiniteNumber(candidate.heightPx) &&
    candidate.heightPx > 0
  );
}

function isValidCardSizeByMode(value: unknown): value is CardSizeByMode {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CardSizeByMode>;
  return isValidCardSize(candidate[CardSizeMode.Small]) && isValidCardSize(candidate[CardSizeMode.Large]);
}

function isValidCardSizeMode(value: unknown): value is CardSizeMode {
  return value === CardSizeMode.Small || value === CardSizeMode.Large;
}

function resolveCardSizeByMode(raw: Partial<StoredMetricsSettings>): CardSizeByMode {
  return isValidCardSizeByMode(raw.cardSizeByMode) ? raw.cardSizeByMode : DEFAULT_CARD_SIZE_BY_MODE;
}

function resolveActiveCardSizeMode(raw: Partial<StoredMetricsSettings>): CardSizeMode {
  return isValidCardSizeMode(raw.activeCardSizeMode) ? raw.activeCardSizeMode : CardSizeMode.Small;
}

// Every setter does signal.set() + a synchronous localStorage write, the same
// way SettingsService does it — no effect() anywhere. An effect that reacts to
// this state and also writes back into it (even indirectly) is how the
// previous version of this service produced an infinite loop on page load.
//
// Server sync is debounced (SAVE_DEBOUNCE_MS after the last change) and sends
// the full settings object, not a per-field diff — simpler than SyncQueueService's
// retry queue, appropriate for a low-traffic, single-in-flight-request save.
@Injectable({
  providedIn: 'root',
})
export class MetricsSettingsService {
  public readonly cardSizeByMode$$: WritableSignal<CardSizeByMode>;
  public readonly activeCardSizeMode$$: WritableSignal<CardSizeMode>;
  public readonly granularity$$: WritableSignal<MetricGranularity>;
  public readonly syncCrosshairEnabled$$: WritableSignal<boolean>;
  public readonly forceZeroBaselineEnabled$$: WritableSignal<boolean>;
  public readonly dashboardSelection$$: WritableSignal<DashboardMetricSelection>;
  public readonly dashboardServiceSelection$$: WritableSignal<DashboardServiceSelection>;
  public readonly severityThresholdOverrides$$: WritableSignal<SeverityThresholdsOverrides>;
  public readonly serviceHeaderVisibility$$: WritableSignal<ServiceHeaderVisibility>;
  public readonly serviceCustomLabels$$: WritableSignal<ServiceCustomLabels>;
  public readonly isSaving$$: WritableSignal<boolean> = signal(false);

  public readonly activeCardWidthPx$$ = computed(() => this.cardSizeByMode$$()[this.activeCardSizeMode$$()].widthPx);
  public readonly activeCardHeightPx$$ = computed(() => this.cardSizeByMode$$()[this.activeCardSizeMode$$()].heightPx);

  private readonly http = inject(HttpClient);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly notificationService = inject(NotificationService);

  private lastConfirmed: StoredMetricsSettings = DEFAULTS;
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    for (const key of OBSOLETE_KEYS) {
      this.localStorageService.removeUserScoped(key);
    }

    const stored = this.localStorageService.getUserScoped<Partial<StoredMetricsSettings>>(STORAGE_KEY) ?? {};
    const initial: StoredMetricsSettings = {
      ...DEFAULTS,
      ...stored,
      cardSizeByMode: resolveCardSizeByMode(stored),
      activeCardSizeMode: resolveActiveCardSizeMode(stored),
    };
    this.lastConfirmed = initial;

    this.cardSizeByMode$$ = signal(initial.cardSizeByMode);
    this.activeCardSizeMode$$ = signal(initial.activeCardSizeMode);
    this.granularity$$ = signal(initial.granularity);
    this.syncCrosshairEnabled$$ = signal(initial.syncCrosshairEnabled);
    this.forceZeroBaselineEnabled$$ = signal(initial.forceZeroBaselineEnabled);
    this.dashboardSelection$$ = signal(initial.dashboardSelection);
    this.dashboardServiceSelection$$ = signal(initial.dashboardServiceSelection);
    this.severityThresholdOverrides$$ = signal(initial.severityThresholds);
    this.serviceHeaderVisibility$$ = signal(initial.serviceHeaderVisibility);
    this.serviceCustomLabels$$ = signal(initial.serviceCustomLabels);

    this.loadFromServer();
  }

  public setCardWidthPx(mode: CardSizeMode, value: number): void {
    this.updateCardSize(mode, { widthPx: value });
  }

  public setCardHeightPx(mode: CardSizeMode, value: number): void {
    this.updateCardSize(mode, { heightPx: value });
  }

  public setActiveCardSizeMode(mode: CardSizeMode): void {
    this.activeCardSizeMode$$.set(mode);
    this.persist();
  }

  public cycleActiveCardSizeMode(): void {
    this.setActiveCardSizeMode(
      this.activeCardSizeMode$$() === CardSizeMode.Small ? CardSizeMode.Large : CardSizeMode.Small,
    );
  }

  public setGranularity(value: MetricGranularity): void {
    this.granularity$$.set(value);
    this.persist();
  }

  public setSyncCrosshairEnabled(value: boolean): void {
    this.syncCrosshairEnabled$$.set(value);
    this.persist();
  }

  public setForceZeroBaselineEnabled(value: boolean): void {
    this.forceZeroBaselineEnabled$$.set(value);
    this.persist();
  }

  public setDashboardSelection(value: DashboardMetricSelection): void {
    this.dashboardSelection$$.set(value);
    this.persist();
  }

  public setDashboardServiceSelection(value: DashboardServiceSelection): void {
    this.dashboardServiceSelection$$.set(value);
    this.persist();
  }

  public setSeverityThresholdOverrides(value: SeverityThresholdsOverrides): void {
    this.severityThresholdOverrides$$.set(value);
    this.persist();
  }

  public setServiceHeaderVisibility(value: ServiceHeaderVisibility): void {
    this.serviceHeaderVisibility$$.set(value);
    this.persist();
  }

  public setServiceCustomLabels(value: ServiceCustomLabels): void {
    this.serviceCustomLabels$$.set(value);
    this.persist();
  }

  private updateCardSize(mode: CardSizeMode, patch: Partial<CardSize>): void {
    const current = this.cardSizeByMode$$();
    this.cardSizeByMode$$.set({ ...current, [mode]: { ...current[mode], ...patch } });
    this.persist();
  }

  private persist(): void {
    this.persistLocalOnly();
    this.scheduleSave();
  }

  private persistLocalOnly(): void {
    this.localStorageService.setUserScoped(STORAGE_KEY, this.snapshot());
  }

  private snapshot(): StoredMetricsSettings {
    return {
      cardSizeByMode: this.cardSizeByMode$$(),
      activeCardSizeMode: this.activeCardSizeMode$$(),
      granularity: this.granularity$$(),
      syncCrosshairEnabled: this.syncCrosshairEnabled$$(),
      forceZeroBaselineEnabled: this.forceZeroBaselineEnabled$$(),
      dashboardSelection: this.dashboardSelection$$(),
      dashboardServiceSelection: this.dashboardServiceSelection$$(),
      severityThresholds: this.severityThresholdOverrides$$(),
      serviceHeaderVisibility: this.serviceHeaderVisibility$$(),
      serviceCustomLabels: this.serviceCustomLabels$$(),
    };
  }

  private applySnapshot(value: StoredMetricsSettings): void {
    this.cardSizeByMode$$.set(value.cardSizeByMode);
    this.activeCardSizeMode$$.set(value.activeCardSizeMode);
    this.granularity$$.set(value.granularity);
    this.syncCrosshairEnabled$$.set(value.syncCrosshairEnabled);
    this.forceZeroBaselineEnabled$$.set(value.forceZeroBaselineEnabled);
    this.dashboardSelection$$.set(value.dashboardSelection);
    this.dashboardServiceSelection$$.set(value.dashboardServiceSelection);
    this.severityThresholdOverrides$$.set(value.severityThresholds);
    this.serviceHeaderVisibility$$.set(value.serviceHeaderVisibility);
    this.serviceCustomLabels$$.set(value.serviceCustomLabels);
    this.localStorageService.setUserScoped(STORAGE_KEY, value);
  }

  private scheduleSave(): void {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }
    this.saveTimeoutId = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
  }

  private async save(): Promise<void> {
    this.saveTimeoutId = null;
    const snapshot = this.snapshot();

    this.isSaving$$.set(true);
    try {
      await firstValueFrom(this.http.put(SETTINGS_ENDPOINT, snapshot));
      this.lastConfirmed = snapshot;
    } catch (error) {
      console.error('Failed to save metrics settings:', error);
      this.applySnapshot(this.lastConfirmed);
      this.notificationService.showSyncError('Failed to save metrics settings');
    } finally {
      this.isSaving$$.set(false);
    }
  }

  private async loadFromServer(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<Partial<StoredMetricsSettings>>(SETTINGS_ENDPOINT));
      const merged: StoredMetricsSettings = {
        ...DEFAULTS,
        ...response,
        cardSizeByMode: resolveCardSizeByMode(response),
        activeCardSizeMode: resolveActiveCardSizeMode(response),
      };
      this.lastConfirmed = merged;
      this.applySnapshot(merged);
    } catch (error) {
      console.error('Failed to fetch metrics settings from server:', error);
    }
  }
}
