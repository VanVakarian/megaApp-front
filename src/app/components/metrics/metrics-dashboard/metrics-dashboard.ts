import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { MetricsSettingsService } from '@app/services/metrics-settings.service';
import { MetricsService } from '@app/services/metrics.service';
import { METRICS_GRANULARITY_STEP_SECONDS, METRICS_GRANULARITY_WINDOW_PERIODS } from '@app/shared/chart-config';
import { formatMetricUnitValue, metricUnit, MetricUnit } from '@app/shared/metric-units';
import { metricAggregation } from '@app/shared/metrics-aggregation';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { metricDescription } from '@app/shared/metrics-descriptions';
import {
  metricChartMode,
  metricLabel,
  metricsServiceDefinition,
  metricsServiceDefinitions,
  metricsServiceLabel,
} from '@app/shared/metrics-labels';
import {
  buildCollapsedMetricWindow,
  buildMetricPointsIndex,
  buildMetricWindow,
  buildServiceMetricWindow,
  buildSparseBarSeriesFromPoints,
  buildSparseLineSeriesFromPoints,
  filterMetricPointsByWindow,
  metricPointsIndexKey,
  MetricSeriesPoint,
  MinuteMetricCollapseCache,
  previousCompletedBucket,
} from '@app/shared/metrics-series';
import { mutedSectionColor, severityColor } from '@app/shared/metrics-severity';
import { clearMetricSyncCrosshair } from '@app/shared/metrics-sync-crosshair';
import { MetricGranularity, MetricPoint } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import { MetricChartCard } from '../metric-chart-card/metric-chart-card';

const NOW_TICK_INTERVAL_MS = 30_000;
const SETTINGS_PANEL_KEY = '__settings__';
const DASHBOARD_PANEL_KEY = '__dashboard__';
const GRANULARITY_OPTIONS: MetricGranularity[] = ['minute', 'hour', 'day'];
const MINUTE_COLLAPSE_CARD_WIDTH_THRESHOLD_PX = 600;
const COLLAPSED_MINUTE_STEP_SECONDS = 5 * 60;

interface MetricChartCardData {
  key: string;
  label: string;
  technicalName: string;
  value: number;
  displayValue: string;
  unit: MetricUnit;
  granularity: MetricGranularity;
  color: string;
  series: MetricSeriesPoint[];
  chartMode: MetricChartMode;
  windowStartBucket: number;
  windowEndBucket: number;
  displayStepSeconds: number;
  description: string;
}

interface MetricGroupData {
  id: string;
  label: string;
  cards: MetricChartCardData[];
}

interface ServiceMetricsData {
  groups: MetricGroupData[];
  dashboardCards: MetricChartCardData[];
}

interface DashboardMetricOption {
  name: string;
  label: string;
}

interface MetricsServiceOption {
  service: string;
  label: string;
}

@Component({
  selector: 'metrics-dashboard',
  templateUrl: './metrics-dashboard.html',
  imports: [VButton, VCard, VCheckbox, VExpand, VInput, VIcon, VToggle, MetricChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboard implements OnInit, OnDestroy {
  protected readonly metricsService = inject(MetricsService);
  protected readonly metricsHealthService = inject(MetricsHealthService);
  protected readonly Icon = IconName;
  protected readonly settingsPanelKey = SETTINGS_PANEL_KEY;
  protected readonly dashboardPanelKey = DASHBOARD_PANEL_KEY;

  private readonly metricsSettingsService = inject(MetricsSettingsService);

  private readonly now$$ = signal(Date.now());
  protected readonly cardWidthPx$$ = this.metricsSettingsService.cardWidthPx$$;
  protected readonly cardHeightPx$$ = this.metricsSettingsService.cardHeightPx$$;
  protected readonly granularityOptions = GRANULARITY_OPTIONS;
  protected readonly granularityToggleItems: VToggleItem[] = this.granularityOptions.map((granularity) => ({
    id: granularity,
    label: this.granularityLabel(granularity),
  }));
  protected readonly selectedGranularity$$ = this.metricsSettingsService.granularity$$;
  protected readonly syncCrosshairEnabled$$ = this.metricsSettingsService.syncCrosshairEnabled$$;
  protected readonly forceZeroBaselineEnabled$$ = this.metricsSettingsService.forceZeroBaselineEnabled$$;
  protected readonly useCollapsedMinutes$$ = computed(
    () => this.cardWidthPx$$() < MINUTE_COLLAPSE_CARD_WIDTH_THRESHOLD_PX,
  );
  protected readonly dashboardSelection$$ = this.metricsSettingsService.dashboardSelection$$;
  protected readonly dashboardServiceSelection$$ = this.metricsSettingsService.dashboardServiceSelection$$;
  protected readonly isSavingSettings$$ = this.metricsSettingsService.isSaving$$;
  private nowTickIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly minuteMetricCollapseCache = new MinuteMetricCollapseCache();

  protected readonly serviceOptions$$ = computed<MetricsServiceOption[]>(() => {
    const discoveredServices = new Set<string>();
    for (const definition of metricsServiceDefinitions()) {
      discoveredServices.add(definition.service);
    }
    for (const service of this.metricsHealthService.services$$()) {
      discoveredServices.add(service.service);
    }
    for (const point of this.metricsService.points$$()) {
      discoveredServices.add(point.service);
    }

    return Array.from(discoveredServices)
      .map((service) => ({
        service,
        label: metricsServiceLabel(service),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  });

  protected readonly serviceMetricsData$$ = computed<Map<string, ServiceMetricsData>>(() => {
    const granularity = this.selectedGranularity$$();
    const stepSeconds = METRICS_GRANULARITY_STEP_SECONDS[granularity];
    const useCollapsedMinutes = granularity === 'minute' && this.useCollapsedMinutes$$();
    const dashboardSelection = this.dashboardSelection$$();
    const fallbackWindow = buildMetricWindow(
      previousCompletedBucket(this.now$$(), stepSeconds),
      METRICS_GRANULARITY_WINDOW_PERIODS[granularity],
      stepSeconds,
    );
    const points = this.metricsService.points$$().filter((point) => point.granularity === granularity);
    const pointsByService = new Map<string, MetricPoint[]>();
    for (const point of points) {
      const servicePoints = pointsByService.get(point.service);
      if (servicePoints) {
        servicePoints.push(point);
        continue;
      }
      pointsByService.set(point.service, [point]);
    }

    const result = new Map<string, ServiceMetricsData>();
    for (const option of this.serviceOptions$$()) {
      const definition = metricsServiceDefinition(option.service);
      const servicePoints = pointsByService.get(option.service) ?? [];
      const serviceWindow = buildServiceMetricWindow(
        servicePoints,
        fallbackWindow.endBucket,
        METRICS_GRANULARITY_WINDOW_PERIODS[granularity],
        stepSeconds,
      );
      const displayWindow = useCollapsedMinutes
        ? buildCollapsedMetricWindow(serviceWindow, COLLAPSED_MINUTE_STEP_SECONDS)
        : serviceWindow;
      const displayStepSeconds = useCollapsedMinutes ? COLLAPSED_MINUTE_STEP_SECONDS : stepSeconds;
      const pointsIndex = buildMetricPointsIndex(servicePoints, serviceWindow.startBucket, serviceWindow.endBucket);

      const buildCard = (name: string): MetricChartCardData => {
        const key = metricPointsIndexKey(option.service, name);
        const metricPoints = pointsIndex.get(key) ?? [];
        const displayPoints = useCollapsedMinutes
          ? filterMetricPointsByWindow(
              this.minuteMetricCollapseCache.collapse(
                key,
                metricPoints,
                metricAggregation(name),
                COLLAPSED_MINUTE_STEP_SECONDS,
              ),
              displayWindow.startBucket,
              displayWindow.endBucket,
            )
          : metricPoints;
        const chartMode = metricChartMode(option.service, name);
        const series =
          chartMode === 'bar'
            ? buildSparseBarSeriesFromPoints(displayPoints)
            : buildSparseLineSeriesFromPoints(displayPoints, displayStepSeconds);
        const rawValue = metricPoints[metricPoints.length - 1]?.value ?? 0;
        const color = definition?.metricColors[name] ?? '#578f92';
        const unit = metricUnit(name);
        return {
          key,
          label: metricLabel(option.service, name),
          technicalName: name,
          value: rawValue,
          displayValue: formatMetricUnitValue(unit, rawValue),
          unit,
          granularity,
          color,
          series,
          chartMode,
          windowStartBucket: displayWindow.startBucket,
          windowEndBucket: displayWindow.endBucket,
          displayStepSeconds,
          description: metricDescription(option.service, name),
        };
      };

      const groups = (definition?.groups ?? []).map((group) => ({
        id: group.id,
        label: group.label,
        cards: group.metrics.map(buildCard),
      }));

      const selectedMetrics = Object.entries(dashboardSelection[option.service] ?? {});
      selectedMetrics.sort(
        ([leftName, leftOrder], [rightName, rightOrder]) => leftOrder - rightOrder || leftName.localeCompare(rightName),
      );
      const dashboardCards = selectedMetrics.map(([name]) => buildCard(name));

      result.set(option.service, { groups, dashboardCards });
    }
    return result;
  });

  protected readonly dashboardRows$$ = computed<MetricGroupData[]>(() => {
    const data = this.serviceMetricsData$$();
    const serviceSelection = this.dashboardServiceSelection$$();
    const rows: { id: string; label: string; order: number; cards: MetricChartCardData[] }[] = [];
    for (const option of this.serviceOptions$$()) {
      const order = serviceSelection[option.service];
      if (order === undefined) continue;
      const cards = data.get(option.service)?.dashboardCards ?? [];
      if (cards.length === 0) continue;
      rows.push({ id: option.service, label: option.label, order, cards });
    }
    rows.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
    return rows.map(({ id, label, cards }) => ({ id, label, cards }));
  });

  protected readonly dashboardMetricOptionsByService$$ = computed<Map<string, DashboardMetricOption[]>>(() => {
    const observedNamesByService = new Map<string, Set<string>>();
    for (const point of this.metricsService.points$$()) {
      const observedNames = observedNamesByService.get(point.service);
      if (observedNames) {
        observedNames.add(point.name);
        continue;
      }
      observedNamesByService.set(point.service, new Set([point.name]));
    }

    const result = new Map<string, DashboardMetricOption[]>();
    for (const option of this.serviceOptions$$()) {
      const definition = metricsServiceDefinition(option.service);
      const names = definition
        ? definition.groups.flatMap((group) => group.metrics)
        : Array.from(observedNamesByService.get(option.service) ?? []).sort();
      result.set(
        option.service,
        names.map((name) => ({ name, label: metricLabel(option.service, name) })),
      );
    }
    return result;
  });

  public ngOnInit(): void {
    this.metricsService.subscribe();
    this.nowTickIntervalId = setInterval(() => this.now$$.set(Date.now()), NOW_TICK_INTERVAL_MS);
  }

  public ngOnDestroy(): void {
    this.metricsService.unsubscribe();
    if (this.nowTickIntervalId !== null) {
      clearInterval(this.nowTickIntervalId);
    }
  }

  protected serviceLabel(service: string): string {
    return metricsServiceLabel(service);
  }

  protected serviceColor(service: string): string {
    const severity =
      this.metricsHealthService.services$$().find((entry) => entry.service === service)?.severity ?? null;
    return severityColor(severity);
  }

  // Only the selected section button keeps its full severity/primary color —
  // the rest get muted toward the theme's muted-text gray so the active tab stands out.
  protected sectionButtonColor(service: string): string {
    const color = this.serviceColor(service);
    return this.isServiceExpanded(service) ? color : mutedSectionColor(color);
  }

  // Can't feed `var(--v-color-primary)` into mutedSectionColor() here: the muted
  // result is assigned back onto that very same custom property on the button's
  // host, and a custom property that references itself is invalid per spec.
  // `--v-color-primary-muted` (set once, further up the tree in the template)
  // is a separate variable name, so no cycle.
  protected dashboardButtonColor(): string | undefined {
    return this.isServiceExpanded(this.dashboardPanelKey) ? undefined : 'var(--v-color-primary-muted)';
  }

  protected granularityLabel(granularity: MetricGranularity): string {
    switch (granularity) {
      case 'hour':
        return 'H';
      case 'day':
        return 'D';
      default:
        return 'M';
    }
  }

  protected selectGranularity(granularity: MetricGranularity): void {
    clearMetricSyncCrosshair();
    this.metricsSettingsService.setGranularity(granularity);
  }

  protected granularityToggleValue(): string[] {
    return [this.selectedGranularity$$()];
  }

  // v-toggle deselects to [] when the already-active item is clicked again — ignore
  // that instead of clearing the granularity, since exactly one must stay selected.
  protected onGranularityToggleChange(value: string[]): void {
    const next = value[0] as MetricGranularity | undefined;
    if (!next) return;
    this.selectGranularity(next);
  }

  protected isServiceExpanded(service: string): boolean {
    if (service === SETTINGS_PANEL_KEY) {
      return this.metricsSettingsService.settingsExpanded$$();
    }
    return service === this.selectedService();
  }

  protected toggleServiceExpanded(service: string): void {
    if (service === SETTINGS_PANEL_KEY) {
      this.metricsSettingsService.setSettingsExpanded(!this.metricsSettingsService.settingsExpanded$$());
      return;
    }

    if (service === this.selectedService()) {
      return;
    }

    clearMetricSyncCrosshair();
    this.metricsSettingsService.setSelectedService(service);
  }

  protected onCardWidthChange(value: string): void {
    const widthPx = Number(value);
    if (!Number.isFinite(widthPx) || widthPx <= 0) return;
    this.metricsSettingsService.setCardWidthPx(widthPx);
  }

  protected onCardHeightChange(value: string): void {
    const heightPx = Number(value);
    if (!Number.isFinite(heightPx) || heightPx <= 0) return;
    this.metricsSettingsService.setCardHeightPx(heightPx);
  }

  protected onSyncCrosshairEnabledChange(value: boolean): void {
    this.metricsSettingsService.setSyncCrosshairEnabled(value);
    if (!value) {
      clearMetricSyncCrosshair();
    }
  }

  protected toggleForceZeroBaseline(): void {
    this.metricsSettingsService.setForceZeroBaselineEnabled(!this.forceZeroBaselineEnabled$$());
  }

  protected clearMetricsCache(): void {
    this.metricsService.clearCache();
  }

  protected warnAfterSeconds(service: string): number {
    return this.metricsHealthService.severityThresholds(service).warnAfterSeconds;
  }

  protected errorAfterSeconds(service: string): number {
    return this.metricsHealthService.severityThresholds(service).errorAfterSeconds;
  }

  protected setWarnAfterSeconds(service: string, rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) return;
    const current = this.metricsHealthService.severityThresholds(service);
    this.metricsHealthService.setSeverityThresholds(service, { ...current, warnAfterSeconds: value });
  }

  protected setErrorAfterSeconds(service: string, rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) return;
    const current = this.metricsHealthService.severityThresholds(service);
    this.metricsHealthService.setSeverityThresholds(service, { ...current, errorAfterSeconds: value });
  }

  protected isDashboardMetricEnabled(service: string, name: string): boolean {
    return this.dashboardSelection$$()[service]?.[name] !== undefined;
  }

  protected dashboardMetricOrder(service: string, name: string): number {
    return this.dashboardSelection$$()[service]?.[name] ?? 0;
  }

  protected toggleDashboardMetric(service: string, name: string, enabled: boolean): void {
    const current = this.dashboardSelection$$();
    const serviceSelection = { ...current[service] };
    if (enabled) {
      serviceSelection[name] = this.nextDashboardOrder(service);
    } else {
      delete serviceSelection[name];
    }

    const next = { ...current };
    if (Object.keys(serviceSelection).length > 0) {
      next[service] = serviceSelection;
    } else {
      delete next[service];
    }
    this.metricsSettingsService.setDashboardSelection(next);

    if (enabled) {
      this.ensureDashboardServiceEnabled(service);
    }
  }

  protected setDashboardMetricOrder(service: string, name: string, rawValue: string): void {
    const order = Number(rawValue);
    if (!Number.isFinite(order)) return;

    const current = this.dashboardSelection$$();
    if (current[service]?.[name] === undefined) return;

    this.metricsSettingsService.setDashboardSelection({
      ...current,
      [service]: { ...current[service], [name]: order },
    });
  }

  protected isDashboardServiceEnabled(service: string): boolean {
    return this.dashboardServiceSelection$$()[service] !== undefined;
  }

  protected dashboardServiceOrder(service: string): number {
    return this.dashboardServiceSelection$$()[service] ?? 0;
  }

  protected toggleDashboardService(service: string, enabled: boolean): void {
    if (enabled) {
      this.ensureDashboardServiceEnabled(service);
      return;
    }

    const next = { ...this.dashboardServiceSelection$$() };
    delete next[service];
    this.metricsSettingsService.setDashboardServiceSelection(next);
  }

  protected setDashboardServiceOrder(service: string, rawValue: string): void {
    const order = Number(rawValue);
    if (!Number.isFinite(order)) return;

    const current = this.dashboardServiceSelection$$();
    if (current[service] === undefined) return;

    this.metricsSettingsService.setDashboardServiceSelection({ ...current, [service]: order });
  }

  private nextDashboardOrder(service: string): number {
    const orders = Object.values(this.dashboardSelection$$()[service] ?? {});
    return orders.length > 0 ? Math.max(...orders) + 1 : 1;
  }

  private nextDashboardServiceOrder(): number {
    const orders = Object.values(this.dashboardServiceSelection$$());
    return orders.length > 0 ? Math.max(...orders) + 1 : 1;
  }

  private ensureDashboardServiceEnabled(service: string): void {
    const current = this.dashboardServiceSelection$$();
    if (current[service] !== undefined) return;
    this.metricsSettingsService.setDashboardServiceSelection({
      ...current,
      [service]: this.nextDashboardServiceOrder(),
    });
  }

  private selectedService(): string | null {
    const stored = this.metricsSettingsService.selectedService$$();
    if (stored === DASHBOARD_PANEL_KEY) {
      return DASHBOARD_PANEL_KEY;
    }
    if (stored && this.serviceOptions$$().some((option) => option.service === stored)) {
      return stored;
    }
    return this.serviceOptions$$()[0]?.service ?? null;
  }
}
