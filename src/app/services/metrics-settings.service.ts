import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { SeverityThresholds } from '@app/shared/metrics-severity';
import { MetricGranularity } from '@app/shared/types';

export type DashboardMetricSelection = Record<string, Record<string, number>>;
export type DashboardServiceSelection = Record<string, number>;
export type SeverityThresholdsOverrides = Record<string, SeverityThresholds>;

interface StoredMetricsSettings {
  selectedService: string | null;
  settingsExpanded: boolean;
  cardWidthPx: number;
  cardHeightPx: number;
  granularity: MetricGranularity;
  syncCrosshairEnabled: boolean;
  dashboardSelection: DashboardMetricSelection;
  dashboardServiceSelection: DashboardServiceSelection;
  severityThresholds: SeverityThresholdsOverrides;
}

const STORAGE_KEY = 'metrics_settings';
const DEFAULT_CARD_WIDTH_PX = 304;
const DEFAULT_CHART_HEIGHT_PX = 112;

const DEFAULTS: StoredMetricsSettings = {
  selectedService: null,
  settingsExpanded: false,
  cardWidthPx: DEFAULT_CARD_WIDTH_PX,
  cardHeightPx: DEFAULT_CHART_HEIGHT_PX,
  granularity: 'minute',
  syncCrosshairEnabled: false,
  dashboardSelection: {},
  dashboardServiceSelection: {},
  severityThresholds: {},
};

// Old per-field keys from before settings were combined into STORAGE_KEY — deleted once, never read.
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

// Every setter does signal.set() + a synchronous localStorage write, the same
// way SettingsService does it — no effect() anywhere. An effect that reacts to
// this state and also writes back into it (even indirectly) is how the
// previous version of this service produced an infinite loop on page load.
@Injectable({
  providedIn: 'root',
})
export class MetricsSettingsService {
  public readonly selectedService$$: WritableSignal<string | null>;
  public readonly settingsExpanded$$: WritableSignal<boolean>;
  public readonly cardWidthPx$$: WritableSignal<number>;
  public readonly cardHeightPx$$: WritableSignal<number>;
  public readonly granularity$$: WritableSignal<MetricGranularity>;
  public readonly syncCrosshairEnabled$$: WritableSignal<boolean>;
  public readonly dashboardSelection$$: WritableSignal<DashboardMetricSelection>;
  public readonly dashboardServiceSelection$$: WritableSignal<DashboardServiceSelection>;
  public readonly severityThresholdOverrides$$: WritableSignal<SeverityThresholdsOverrides>;

  private readonly localStorageService = inject(LocalStorageService);

  constructor() {
    for (const key of OBSOLETE_KEYS) {
      this.localStorageService.removeUserScoped(key);
    }

    const stored = this.localStorageService.getUserScoped<Partial<StoredMetricsSettings>>(STORAGE_KEY);
    const initial: StoredMetricsSettings = { ...DEFAULTS, ...stored };

    this.selectedService$$ = signal(initial.selectedService);
    this.settingsExpanded$$ = signal(initial.settingsExpanded);
    this.cardWidthPx$$ = signal(initial.cardWidthPx);
    this.cardHeightPx$$ = signal(initial.cardHeightPx);
    this.granularity$$ = signal(initial.granularity);
    this.syncCrosshairEnabled$$ = signal(initial.syncCrosshairEnabled);
    this.dashboardSelection$$ = signal(initial.dashboardSelection);
    this.dashboardServiceSelection$$ = signal(initial.dashboardServiceSelection);
    this.severityThresholdOverrides$$ = signal(initial.severityThresholds);
  }

  public setSelectedService(value: string | null): void {
    this.selectedService$$.set(value);
    this.persist();
  }

  public setSettingsExpanded(value: boolean): void {
    this.settingsExpanded$$.set(value);
    this.persist();
  }

  public setCardWidthPx(value: number): void {
    this.cardWidthPx$$.set(value);
    this.persist();
  }

  public setCardHeightPx(value: number): void {
    this.cardHeightPx$$.set(value);
    this.persist();
  }

  public setGranularity(value: MetricGranularity): void {
    this.granularity$$.set(value);
    this.persist();
  }

  public setSyncCrosshairEnabled(value: boolean): void {
    this.syncCrosshairEnabled$$.set(value);
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

  private persist(): void {
    const snapshot: StoredMetricsSettings = {
      selectedService: this.selectedService$$(),
      settingsExpanded: this.settingsExpanded$$(),
      cardWidthPx: this.cardWidthPx$$(),
      cardHeightPx: this.cardHeightPx$$(),
      granularity: this.granularity$$(),
      syncCrosshairEnabled: this.syncCrosshairEnabled$$(),
      dashboardSelection: this.dashboardSelection$$(),
      dashboardServiceSelection: this.dashboardServiceSelection$$(),
      severityThresholds: this.severityThresholdOverrides$$(),
    };
    this.localStorageService.setUserScoped(STORAGE_KEY, snapshot);
  }
}
