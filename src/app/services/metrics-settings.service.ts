import { computed, Injectable, Signal, WritableSignal } from '@angular/core';
import { NamespaceSettingsStore } from '@app/services/settings/namespace-settings-store';
import { persistedSignal } from '@app/services/settings/persisted-signal';
import { DEFAULT_METRIC_CHART_MODE, MetricChartMode } from '@app/shared/metrics-chart-mode';
import { AnomalyFilterParams } from '@app/shared/metrics-series';
import { SeverityThresholds } from '@app/shared/metrics-severity';
import { CompositeMetricDefinition, MetricGranularity } from '@app/shared/types';

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

// Server-synced via a batched (explicit-save) namespace store — plan 11's "Save" button flow,
// unchanged, just riding the generic mechanism instead of a bespoke fetch/put pair.
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

@Injectable({
  providedIn: 'root',
})
export class MetricsSettingsService {
  private readonly store = new NamespaceSettingsStore<StoredMetricsSettings>('metrics', DEFAULTS);

  public readonly cardSize$$: Signal<CardSize> = computed(() => this.store.value$$().cardSize);
  public readonly syncCrosshairEnabled$$: Signal<boolean> = computed(() => this.store.value$$().syncCrosshairEnabled);
  public readonly anomalyFilterParams$$: Signal<AnomalyFilterParams> = computed(
    () => this.store.value$$().anomalyFilterParams,
  );
  public readonly dashboardSelection$$: Signal<DashboardMetricSelection> = computed(
    () => this.store.value$$().dashboardSelection,
  );
  public readonly dashboardServiceSelection$$: Signal<DashboardServiceSelection> = computed(
    () => this.store.value$$().dashboardServiceSelection,
  );
  public readonly metricChartModeOverrides$$: Signal<MetricChartModeOverrides> = computed(
    () => this.store.value$$().metricChartModeOverrides,
  );
  public readonly severityThresholdOverrides$$: Signal<SeverityThresholdsOverrides> = computed(
    () => this.store.value$$().severityThresholds,
  );
  public readonly serviceHeaderVisibility$$: Signal<ServiceHeaderVisibility> = computed(
    () => this.store.value$$().serviceHeaderVisibility,
  );
  public readonly serviceCustomLabels$$: Signal<ServiceCustomLabels> = computed(
    () => this.store.value$$().serviceCustomLabels,
  );
  public readonly compositeMetrics$$: Signal<CompositeMetricDefinition[]> = computed(
    () => this.store.value$$().compositeMetrics,
  );
  public readonly isSaving$$: WritableSignal<boolean> = this.store.isSaving$$;
  public readonly isDirty$$: Signal<boolean> = this.store.isDirty$$;

  // Device-local, never synced — unchanged from before this refactor, just riding the shared
  // persistedSignal primitive instead of hand-rolled "signal + write to localStorage" wiring.
  public readonly cardLayoutMode$$: WritableSignal<CardLayoutMode> = persistedSignal(
    ACTIVE_CARD_LAYOUT_MODE_STORAGE_KEY,
    DEFAULT_CARD_LAYOUT_MODE,
  );
  public readonly activeTooltipMode$$: WritableSignal<TooltipMode> = persistedSignal(
    ACTIVE_TOOLTIP_MODE_STORAGE_KEY,
    DEFAULT_ACTIVE_TOOLTIP_MODE,
  );
  public readonly granularity$$: WritableSignal<MetricGranularity> = persistedSignal(
    GRANULARITY_STORAGE_KEY,
    DEFAULT_GRANULARITY,
  );
  public readonly forceZeroBaselineEnabled$$: WritableSignal<boolean> = persistedSignal(
    FORCE_ZERO_BASELINE_ENABLED_STORAGE_KEY,
    DEFAULT_FORCE_ZERO_BASELINE_ENABLED,
  );
  public readonly anomalyFilterEnabled$$: WritableSignal<boolean> = persistedSignal(
    ANOMALY_FILTER_ENABLED_STORAGE_KEY,
    DEFAULT_ANOMALY_FILTER_ENABLED,
  );

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
  }

  public cycleCardLayoutMode(): void {
    this.setCardLayoutMode(
      this.cardLayoutMode$$() === CardLayoutMode.Compact ? CardLayoutMode.Wide : CardLayoutMode.Compact,
    );
  }

  public setActiveTooltipMode(mode: TooltipMode): void {
    this.activeTooltipMode$$.set(mode);
  }

  public cycleActiveTooltipMode(): void {
    this.setActiveTooltipMode(
      this.activeTooltipMode$$() === TooltipMode.Nearest ? TooltipMode.Vertical : TooltipMode.Nearest,
    );
  }

  public setGranularity(value: MetricGranularity): void {
    this.granularity$$.set(value);
  }

  public setSyncCrosshairEnabled(value: boolean): void {
    this.store.stage('syncCrosshairEnabled', value);
  }

  public setForceZeroBaselineEnabled(value: boolean): void {
    this.forceZeroBaselineEnabled$$.set(value);
  }

  public setAnomalyFilterEnabled(value: boolean): void {
    this.anomalyFilterEnabled$$.set(value);
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
    this.store.stage('dashboardSelection', value);
  }

  public setDashboardServiceSelection(value: DashboardServiceSelection): void {
    this.store.stage('dashboardServiceSelection', value);
  }

  public setMetricChartModeOverrides(value: MetricChartModeOverrides): void {
    this.store.stage('metricChartModeOverrides', value);
  }

  public metricChartMode(service: string, name: string): MetricChartMode {
    return this.metricChartModeOverrides$$()[service]?.[name] ?? DEFAULT_METRIC_CHART_MODE;
  }

  public setSeverityThresholdOverrides(value: SeverityThresholdsOverrides): void {
    this.store.stage('severityThresholds', value);
  }

  public setServiceHeaderVisibility(value: ServiceHeaderVisibility): void {
    this.store.stage('serviceHeaderVisibility', value);
  }

  public setServiceCustomLabels(value: ServiceCustomLabels): void {
    this.store.stage('serviceCustomLabels', value);
  }

  public setCompositeMetrics(value: CompositeMetricDefinition[]): void {
    this.store.stage('compositeMetrics', value);
  }

  public async saveNow(): Promise<void> {
    return this.store.saveNow();
  }

  private updateCardSize(patch: Partial<CardSize>): void {
    this.store.stage('cardSize', { ...this.cardSize$$(), ...patch });
  }

  private updateAnomalyFilterParams(patch: Partial<AnomalyFilterParams>): void {
    this.store.stage('anomalyFilterParams', { ...this.anomalyFilterParams$$(), ...patch });
  }
}
