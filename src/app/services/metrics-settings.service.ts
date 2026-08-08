import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NotificationService } from '@app/services/notification.service';
import { DEFAULT_METRIC_CHART_MODE, MetricChartMode } from '@app/shared/metrics-chart-mode';
import { AnomalyFilterParams } from '@app/shared/metrics-series';
import { SeverityThresholds } from '@app/shared/metrics-severity';
import { CompositeMetricDefinition, MetricGranularity } from '@app/shared/types';
import { firstValueFrom } from 'rxjs';

export type DashboardMetricSelection = Record<string, Record<string, number>>;
export type DashboardServiceSelection = Record<string, number>;
export type SeverityThresholdsOverrides = Record<string, SeverityThresholds>;
export type ServiceHeaderVisibility = Record<string, boolean>;
export type ServiceCustomLabels = Record<string, string>;
export type MetricChartModeOverrides = Record<string, Record<string, MetricChartMode>>;

export const CardLayoutMode = {
  Compact: 'compact',
  Wide: 'wide',
} as const;
export type CardLayoutMode = (typeof CardLayoutMode)[keyof typeof CardLayoutMode];

export const TooltipMode = {
  Nearest: 'nearest',
  Vertical: 'vertical',
} as const;
export type TooltipMode = (typeof TooltipMode)[keyof typeof TooltipMode];

export interface CardSize {
  widthPx: number;
  heightPx: number;
  expandedHeightPx: number;
}

interface StoredMetricsSettings {
  cardSize: CardSize;
  syncCrosshairEnabled: boolean;
  dashboardSelection: DashboardMetricSelection;
  dashboardServiceSelection: DashboardServiceSelection;
  metricChartModeOverrides: MetricChartModeOverrides;
  severityThresholds: SeverityThresholdsOverrides;
  serviceHeaderVisibility: ServiceHeaderVisibility;
  serviceCustomLabels: ServiceCustomLabels;
  compositeMetrics: CompositeMetricDefinition[];
  anomalyFilterParams: AnomalyFilterParams;
}

const STORAGE_KEY = 'metrics_settings';
const GRANULARITY_STORAGE_KEY = 'metrics_granularity';
const DEFAULT_GRANULARITY: MetricGranularity = 'minute';
const ACTIVE_CARD_LAYOUT_MODE_STORAGE_KEY = 'metrics_active_card_layout_mode';
const DEFAULT_CARD_LAYOUT_MODE: CardLayoutMode = CardLayoutMode.Compact;
const ACTIVE_TOOLTIP_MODE_STORAGE_KEY = 'metrics_active_tooltip_mode';
const DEFAULT_ACTIVE_TOOLTIP_MODE: TooltipMode = TooltipMode.Nearest;
const FORCE_ZERO_BASELINE_ENABLED_STORAGE_KEY = 'metrics_force_zero_baseline_enabled';
const DEFAULT_FORCE_ZERO_BASELINE_ENABLED = false;
const ANOMALY_FILTER_ENABLED_STORAGE_KEY = 'metrics_anomaly_filter_enabled';
const DEFAULT_ANOMALY_FILTER_ENABLED = false;
const DEFAULT_ANOMALY_FILTER_PARAMS: AnomalyFilterParams = {
  windowRadius: 4,
  sensitivity: 4,
  minRelativeJumpPercent: 10,
};
const SETTINGS_ENDPOINT = '/api/metrics-settings/';
const DEFAULT_CARD_WIDTH_PX = 304;
const DEFAULT_CARD_HEIGHT_PX = 112;
const DEFAULT_CARD_EXPANDED_HEIGHT_PX = 400;

const DEFAULT_CARD_SIZE: CardSize = {
  widthPx: DEFAULT_CARD_WIDTH_PX,
  heightPx: DEFAULT_CARD_HEIGHT_PX,
  expandedHeightPx: DEFAULT_CARD_EXPANDED_HEIGHT_PX,
};

const DEFAULTS: StoredMetricsSettings = {
  cardSize: DEFAULT_CARD_SIZE,
  syncCrosshairEnabled: false,
  dashboardSelection: {},
  dashboardServiceSelection: {},
  metricChartModeOverrides: {},
  severityThresholds: {},
  serviceHeaderVisibility: {},
  serviceCustomLabels: {},
  compositeMetrics: [],
  anomalyFilterParams: DEFAULT_ANOMALY_FILTER_PARAMS,
};

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

// expandedHeightPx is validated separately (not folded into isValidCardSize) so that
// settings saved before this field existed still resolve their width/height instead
// of falling back to DEFAULT_CARD_SIZE wholesale — only the missing field gets defaulted.
function resolveCardSize(raw: Partial<StoredMetricsSettings>): CardSize {
  if (!isValidCardSize(raw.cardSize)) return DEFAULT_CARD_SIZE;
  const expandedHeightPx = raw.cardSize.expandedHeightPx;
  return {
    ...raw.cardSize,
    expandedHeightPx:
      isFiniteNumber(expandedHeightPx) && expandedHeightPx > 0 ? expandedHeightPx : DEFAULT_CARD_EXPANDED_HEIGHT_PX,
  };
}

function isValidCardLayoutMode(value: unknown): value is CardLayoutMode {
  return value === CardLayoutMode.Compact || value === CardLayoutMode.Wide;
}

function resolveCardLayoutMode(value: unknown): CardLayoutMode {
  return isValidCardLayoutMode(value) ? value : DEFAULT_CARD_LAYOUT_MODE;
}

function isValidTooltipMode(value: unknown): value is TooltipMode {
  return value === TooltipMode.Nearest || value === TooltipMode.Vertical;
}

function resolveActiveTooltipMode(value: unknown): TooltipMode {
  return isValidTooltipMode(value) ? value : DEFAULT_ACTIVE_TOOLTIP_MODE;
}

function resolveForceZeroBaselineEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_FORCE_ZERO_BASELINE_ENABLED;
}

function resolveAnomalyFilterEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_ANOMALY_FILTER_ENABLED;
}

function isValidAnomalyFilterParams(value: unknown): value is AnomalyFilterParams {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AnomalyFilterParams>;
  return (
    isFiniteNumber(candidate.windowRadius) &&
    Number.isInteger(candidate.windowRadius) &&
    candidate.windowRadius > 0 &&
    isFiniteNumber(candidate.sensitivity) &&
    candidate.sensitivity > 0 &&
    isFiniteNumber(candidate.minRelativeJumpPercent) &&
    candidate.minRelativeJumpPercent >= 0
  );
}

function resolveAnomalyFilterParams(raw: Partial<StoredMetricsSettings>): AnomalyFilterParams {
  return isValidAnomalyFilterParams(raw.anomalyFilterParams) ? raw.anomalyFilterParams : DEFAULT_ANOMALY_FILTER_PARAMS;
}

function isValidCompositeMetricDefinition(value: unknown): value is CompositeMetricDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CompositeMetricDefinition>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.metricName === 'string' &&
    typeof candidate.serviceA === 'string' &&
    typeof candidate.serviceB === 'string'
  );
}

function resolveCompositeMetrics(raw: Partial<StoredMetricsSettings>): CompositeMetricDefinition[] {
  return Array.isArray(raw.compositeMetrics)
    ? raw.compositeMetrics.filter(isValidCompositeMetricDefinition)
    : DEFAULTS.compositeMetrics;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aEntries = Object.entries(a as Record<string, unknown>);
  const bRecord = b as Record<string, unknown>;
  if (aEntries.length !== Object.keys(bRecord).length) return false;
  return aEntries.every(([key, value]) => isDeepEqual(value, bRecord[key]));
}

@Injectable({
  providedIn: 'root',
})
export class MetricsSettingsService {
  public readonly cardSize$$: WritableSignal<CardSize>;
  public readonly cardLayoutMode$$: WritableSignal<CardLayoutMode>;
  public readonly activeTooltipMode$$: WritableSignal<TooltipMode>;
  public readonly granularity$$: WritableSignal<MetricGranularity>;
  public readonly syncCrosshairEnabled$$: WritableSignal<boolean>;
  public readonly forceZeroBaselineEnabled$$: WritableSignal<boolean>;
  public readonly anomalyFilterEnabled$$: WritableSignal<boolean>;
  public readonly anomalyFilterParams$$: WritableSignal<AnomalyFilterParams>;
  public readonly dashboardSelection$$: WritableSignal<DashboardMetricSelection>;
  public readonly dashboardServiceSelection$$: WritableSignal<DashboardServiceSelection>;
  public readonly metricChartModeOverrides$$: WritableSignal<MetricChartModeOverrides>;
  public readonly severityThresholdOverrides$$: WritableSignal<SeverityThresholdsOverrides>;
  public readonly serviceHeaderVisibility$$: WritableSignal<ServiceHeaderVisibility>;
  public readonly serviceCustomLabels$$: WritableSignal<ServiceCustomLabels>;
  public readonly compositeMetrics$$: WritableSignal<CompositeMetricDefinition[]>;
  public readonly isSaving$$: WritableSignal<boolean> = signal(false);
  public readonly isDirty$$ = computed(() => !isDeepEqual(this.snapshot(), this.lastConfirmed$$()));

  private readonly http = inject(HttpClient);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly notificationService = inject(NotificationService);
  private readonly lastConfirmed$$: WritableSignal<StoredMetricsSettings>;

  constructor() {
    const stored = this.localStorageService.getUserScoped<Partial<StoredMetricsSettings>>(STORAGE_KEY) ?? {};
    const initial: StoredMetricsSettings = {
      ...DEFAULTS,
      ...stored,
      cardSize: resolveCardSize(stored),
      compositeMetrics: resolveCompositeMetrics(stored),
      anomalyFilterParams: resolveAnomalyFilterParams(stored),
    };

    const storedGranularity = this.localStorageService.getUserScoped<MetricGranularity>(GRANULARITY_STORAGE_KEY);
    const storedCardLayoutMode = this.localStorageService.getUserScoped<CardLayoutMode>(
      ACTIVE_CARD_LAYOUT_MODE_STORAGE_KEY,
    );
    const storedActiveTooltipMode = this.localStorageService.getUserScoped<TooltipMode>(
      ACTIVE_TOOLTIP_MODE_STORAGE_KEY,
    );
    const storedForceZeroBaselineEnabled = this.localStorageService.getUserScoped<boolean>(
      FORCE_ZERO_BASELINE_ENABLED_STORAGE_KEY,
    );
    const storedAnomalyFilterEnabled = this.localStorageService.getUserScoped<boolean>(
      ANOMALY_FILTER_ENABLED_STORAGE_KEY,
    );

    this.cardSize$$ = signal(initial.cardSize);
    this.cardLayoutMode$$ = signal(resolveCardLayoutMode(storedCardLayoutMode));
    this.activeTooltipMode$$ = signal(resolveActiveTooltipMode(storedActiveTooltipMode));
    this.granularity$$ = signal(storedGranularity ?? DEFAULT_GRANULARITY);
    this.syncCrosshairEnabled$$ = signal(initial.syncCrosshairEnabled);
    this.forceZeroBaselineEnabled$$ = signal(resolveForceZeroBaselineEnabled(storedForceZeroBaselineEnabled));
    this.anomalyFilterEnabled$$ = signal(resolveAnomalyFilterEnabled(storedAnomalyFilterEnabled));
    this.anomalyFilterParams$$ = signal(initial.anomalyFilterParams);
    this.dashboardSelection$$ = signal(initial.dashboardSelection);
    this.dashboardServiceSelection$$ = signal(initial.dashboardServiceSelection);
    this.metricChartModeOverrides$$ = signal(initial.metricChartModeOverrides);
    this.severityThresholdOverrides$$ = signal(initial.severityThresholds);
    this.serviceHeaderVisibility$$ = signal(initial.serviceHeaderVisibility);
    this.serviceCustomLabels$$ = signal(initial.serviceCustomLabels);
    this.compositeMetrics$$ = signal(initial.compositeMetrics);
    this.lastConfirmed$$ = signal(initial);

    this.loadFromServer();
  }

  public setCardWidthPx(value: number): void {
    this.updateCardSize({ widthPx: value });
  }

  public setCardHeightPx(value: number): void {
    this.updateCardSize({ heightPx: value });
  }

  public setCardExpandedHeightPx(value: number): void {
    this.updateCardSize({ expandedHeightPx: value });
  }

  public setCardLayoutMode(mode: CardLayoutMode): void {
    this.cardLayoutMode$$.set(mode);
    this.localStorageService.setUserScoped(ACTIVE_CARD_LAYOUT_MODE_STORAGE_KEY, mode);
  }

  public cycleCardLayoutMode(): void {
    this.setCardLayoutMode(
      this.cardLayoutMode$$() === CardLayoutMode.Compact ? CardLayoutMode.Wide : CardLayoutMode.Compact,
    );
  }

  public setActiveTooltipMode(mode: TooltipMode): void {
    this.activeTooltipMode$$.set(mode);
    this.localStorageService.setUserScoped(ACTIVE_TOOLTIP_MODE_STORAGE_KEY, mode);
  }

  public cycleActiveTooltipMode(): void {
    this.setActiveTooltipMode(
      this.activeTooltipMode$$() === TooltipMode.Nearest ? TooltipMode.Vertical : TooltipMode.Nearest,
    );
  }

  public setGranularity(value: MetricGranularity): void {
    this.granularity$$.set(value);
    this.localStorageService.setUserScoped(GRANULARITY_STORAGE_KEY, value);
  }

  public setSyncCrosshairEnabled(value: boolean): void {
    this.syncCrosshairEnabled$$.set(value);
  }

  public setForceZeroBaselineEnabled(value: boolean): void {
    this.forceZeroBaselineEnabled$$.set(value);
    this.localStorageService.setUserScoped(FORCE_ZERO_BASELINE_ENABLED_STORAGE_KEY, value);
  }

  public setAnomalyFilterEnabled(value: boolean): void {
    this.anomalyFilterEnabled$$.set(value);
    this.localStorageService.setUserScoped(ANOMALY_FILTER_ENABLED_STORAGE_KEY, value);
  }

  public setAnomalyFilterWindowRadius(value: number): void {
    this.updateAnomalyFilterParams({ windowRadius: value });
  }

  public setAnomalyFilterSensitivity(value: number): void {
    this.updateAnomalyFilterParams({ sensitivity: value });
  }

  public setAnomalyFilterMinRelativeJumpPercent(value: number): void {
    this.updateAnomalyFilterParams({ minRelativeJumpPercent: value });
  }

  public setDashboardSelection(value: DashboardMetricSelection): void {
    this.dashboardSelection$$.set(value);
  }

  public setDashboardServiceSelection(value: DashboardServiceSelection): void {
    this.dashboardServiceSelection$$.set(value);
  }

  public setMetricChartModeOverrides(value: MetricChartModeOverrides): void {
    this.metricChartModeOverrides$$.set(value);
  }

  public metricChartMode(service: string, name: string): MetricChartMode {
    return this.metricChartModeOverrides$$()[service]?.[name] ?? DEFAULT_METRIC_CHART_MODE;
  }

  public setSeverityThresholdOverrides(value: SeverityThresholdsOverrides): void {
    this.severityThresholdOverrides$$.set(value);
  }

  public setServiceHeaderVisibility(value: ServiceHeaderVisibility): void {
    this.serviceHeaderVisibility$$.set(value);
  }

  public setServiceCustomLabels(value: ServiceCustomLabels): void {
    this.serviceCustomLabels$$.set(value);
  }

  public setCompositeMetrics(value: CompositeMetricDefinition[]): void {
    this.compositeMetrics$$.set(value);
  }

  private updateCardSize(patch: Partial<CardSize>): void {
    this.cardSize$$.set({ ...this.cardSize$$(), ...patch });
  }

  private updateAnomalyFilterParams(patch: Partial<AnomalyFilterParams>): void {
    this.anomalyFilterParams$$.set({ ...this.anomalyFilterParams$$(), ...patch });
  }

  private snapshot(): StoredMetricsSettings {
    return {
      cardSize: this.cardSize$$(),
      syncCrosshairEnabled: this.syncCrosshairEnabled$$(),
      dashboardSelection: this.dashboardSelection$$(),
      dashboardServiceSelection: this.dashboardServiceSelection$$(),
      metricChartModeOverrides: this.metricChartModeOverrides$$(),
      severityThresholds: this.severityThresholdOverrides$$(),
      serviceHeaderVisibility: this.serviceHeaderVisibility$$(),
      serviceCustomLabels: this.serviceCustomLabels$$(),
      compositeMetrics: this.compositeMetrics$$(),
      anomalyFilterParams: this.anomalyFilterParams$$(),
    };
  }

  private applySnapshot(value: StoredMetricsSettings): void {
    this.cardSize$$.set(value.cardSize);
    this.syncCrosshairEnabled$$.set(value.syncCrosshairEnabled);
    this.dashboardSelection$$.set(value.dashboardSelection);
    this.dashboardServiceSelection$$.set(value.dashboardServiceSelection);
    this.metricChartModeOverrides$$.set(value.metricChartModeOverrides);
    this.severityThresholdOverrides$$.set(value.severityThresholds);
    this.serviceHeaderVisibility$$.set(value.serviceHeaderVisibility);
    this.serviceCustomLabels$$.set(value.serviceCustomLabels);
    this.compositeMetrics$$.set(value.compositeMetrics);
    this.anomalyFilterParams$$.set(value.anomalyFilterParams);
    this.localStorageService.setUserScoped(STORAGE_KEY, value);
    this.lastConfirmed$$.set(value);
  }

  public async saveNow(): Promise<void> {
    const snapshot = this.snapshot();

    this.isSaving$$.set(true);
    try {
      await firstValueFrom(this.http.put(SETTINGS_ENDPOINT, snapshot));
      this.localStorageService.setUserScoped(STORAGE_KEY, snapshot);
      this.lastConfirmed$$.set(snapshot);
    } catch (error) {
      console.error('Failed to save metrics settings:', error);
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
        cardSize: resolveCardSize(response),
        compositeMetrics: resolveCompositeMetrics(response),
        anomalyFilterParams: resolveAnomalyFilterParams(response),
      };
      this.applySnapshot(merged);
    } catch (error) {
      console.error('Failed to fetch metrics settings from server:', error);
    }
  }
}
