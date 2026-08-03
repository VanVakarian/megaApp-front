import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CompositeMetricsSettingsService } from '@app/services/composite-metrics-settings.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { MetricsHealthService } from '@app/services/metrics-health.service';
import { CardLayoutMode, MetricsSettingsService, TooltipMode } from '@app/services/metrics-settings.service';
import { MetricsService } from '@app/services/metrics.service';
import { METRICS_GRANULARITY_STEP_SECONDS, METRICS_GRANULARITY_WINDOW_PERIODS } from '@app/shared/chart-config';
import { formatMetricUnitValue } from '@app/shared/metric-units';
import { MetricAggregation } from '@app/shared/metrics-aggregation';
import {
  metricAggregation,
  metricChartMode,
  metricColor,
  metricDescription,
  metricLabel,
  metricsCatalogKnownNames,
  metricsServiceDefinition,
  metricsServiceDefinitions,
  metricUnit,
} from '@app/shared/metrics-catalog';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import {
  buildCollapsedMetricWindow,
  buildMetricPointsIndex,
  buildMetricWindow,
  buildServiceMetricWindow,
  buildSparseBarSeriesFromPoints,
  buildSparseLineSeriesFromPoints,
  filterMetricPointsByWindow,
  metricPointsIndexKey,
  MetricWindow,
  MinuteMetricCollapseCache,
  previousCompletedBucket,
} from '@app/shared/metrics-series';
import { mutedSectionColor, severityColor } from '@app/shared/metrics-severity';
import { clearMetricSyncCrosshair } from '@app/shared/metrics-sync-crosshair';
import { COMPOSITE_SERVICE_KEY, CompositeMetricDefinition, MetricGranularity, MetricPoint } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import {
  MetricCardGrid,
  MetricChartCardData,
  MetricChartCardSeriesDisplay,
} from '../metric-card-grid/metric-card-grid';

const NOW_TICK_INTERVAL_MS = 30_000;
const SETTINGS_PANEL_KEY = '__settings__';
const DASHBOARD_PANEL_KEY = '__dashboard__';
const DEFAULT_COMPOSITE_LABEL = 'Составные метрики';
const GRANULARITY_OPTIONS: MetricGranularity[] = ['minute', 'hour', 'day'];
const COLLAPSED_MINUTE_STEP_SECONDS = 5 * 60;

interface MetricGroupData {
  id: string;
  label: string;
  cards: MetricChartCardData[];
}

interface ServiceMetricsData {
  groups: MetricGroupData[];
  dashboardCards: MetricChartCardData[];
}

interface MetricsServiceOption {
  service: string;
}

@Component({
  selector: 'metrics-dashboard',
  templateUrl: './metrics-dashboard.html',
  imports: [VButton, VCard, VCheckbox, VExpand, VInput, VIcon, VToggle, MetricCardGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboard implements OnInit, OnDestroy {
  protected readonly metricsService = inject(MetricsService);
  protected readonly metricsHealthService = inject(MetricsHealthService);
  protected readonly deviceInfoService = inject(DeviceInfoService);
  protected readonly Icon = IconName;
  protected readonly CardLayoutMode = CardLayoutMode;
  protected readonly TooltipMode = TooltipMode;
  protected readonly settingsPanelKey = SETTINGS_PANEL_KEY;
  protected readonly dashboardPanelKey = DASHBOARD_PANEL_KEY;
  protected readonly compositeServiceKey = COMPOSITE_SERVICE_KEY;

  private readonly metricsSettingsService = inject(MetricsSettingsService);
  private readonly compositeMetricsSettingsService = inject(CompositeMetricsSettingsService);

  private readonly now$$ = signal(Date.now());
  protected readonly targetWidthPx$$ = computed(() => this.metricsSettingsService.cardSize$$().widthPx);
  protected readonly heightPx$$ = computed(() => this.metricsSettingsService.cardSize$$().heightPx);
  protected readonly expandedHeightPx$$ = computed(() => this.metricsSettingsService.cardSize$$().expandedHeightPx);
  protected readonly cardLayoutMode$$ = this.metricsSettingsService.cardLayoutMode$$;
  protected readonly activeTooltipMode$$ = this.metricsSettingsService.activeTooltipMode$$;
  protected readonly granularityOptions = GRANULARITY_OPTIONS;
  protected readonly granularityToggleItems: VToggleItem[] = this.granularityOptions.map((granularity) => ({
    id: granularity,
    label: this.granularityLabel(granularity),
  }));
  protected readonly selectedGranularity$$ = this.metricsSettingsService.granularity$$;
  protected readonly syncCrosshairEnabled$$ = this.metricsSettingsService.syncCrosshairEnabled$$;
  protected readonly forceZeroBaselineEnabled$$ = this.metricsSettingsService.forceZeroBaselineEnabled$$;
  protected readonly dashboardSelection$$ = this.metricsSettingsService.dashboardSelection$$;
  protected readonly dashboardServiceSelection$$ = this.metricsSettingsService.dashboardServiceSelection$$;
  protected readonly isSavingSettings$$ = this.metricsSettingsService.isSaving$$;
  protected readonly hasUnsavedSettings$$ = this.metricsSettingsService.isDirty$$;
  protected readonly compositeDefinitions$$ = this.compositeMetricsSettingsService.definitions$$;
  private nowTickIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly minuteMetricCollapseCache = new MinuteMetricCollapseCache();
  private readonly isPageScrolled$$ = signal(window.scrollY > 0);
  private readonly onWindowScroll = () => this.isPageScrolled$$.set(window.scrollY > 0);

  protected readonly stickyBarClasses$$ = computed(() => {
    if (!this.deviceInfoService.isDesktopScreen$$()) return '';
    return this.isPageScrolled$$()
      ? 'sticky top-0 z-10 shadow-[0_10px_15px_-10px_rgba(0,0,0,0.3)]'
      : 'sticky top-0 z-10';
  });

  // Which panel is expanded is transient UI state, not persisted anywhere (see
  // metrics-settings.service.ts) — every page load opens on the Dashboard panel.
  private readonly expandedPanel$$ = signal<string>(DASHBOARD_PANEL_KEY);
  private readonly isSettingsPanelExpanded$$ = signal(false);

  // Transient — every page load opens with the composite editor collapsed.
  protected readonly isCompositeSettingsExpanded$$ = signal(false);

  // Transient too — every page load opens with cards in their normal display mode.
  protected readonly isCardEditMode$$ = signal(false);

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

    // Sorted by the raw technical service key, never by the (editable) display
    // label — sorting by the label would reorder this list on every keystroke
    // while typing a custom name in the settings panel below, kicking focus out
    // of the input mid-edit.
    return Array.from(discoveredServices)
      .sort((left, right) => left.localeCompare(right))
      .map((service) => ({ service }));
  });

  // Separate from serviceOptions$$ on purpose: settings panels (dashboard metric
  // picker, severity thresholds) must keep listing every known service so a
  // header-hidden service can still be reconfigured or re-shown. Only the header
  // tab bar and its expanded body use this filtered list.
  protected readonly visibleServiceOptions$$ = computed<MetricsServiceOption[]>(() =>
    this.serviceOptions$$().filter((option) => this.isServiceVisibleInHeader(option.service)),
  );

  // Header tab order follows the same order set for the dashboard cards
  // (dashboardServiceSelection$$), composite included — services without a
  // dashboard order keep their original (alphabetical) relative position, after
  // the ordered ones. Kept separate from serviceOptions$$/visibleServiceOptions$$,
  // which stay alphabetical, since those also drive the Settings panel's service
  // list, and reordering it while its own order input is being typed into would
  // kick focus out mid-edit.
  protected readonly headerEntries$$ = computed<{ service: string; isComposite: boolean }[]>(() => {
    const entries: { service: string; isComposite: boolean }[] = [];
    if (this.isServiceVisibleInHeader(this.compositeServiceKey)) {
      entries.push({ service: this.compositeServiceKey, isComposite: true });
    }
    for (const option of this.visibleServiceOptions$$()) {
      entries.push({ service: option.service, isComposite: false });
    }

    const orderMap = this.dashboardServiceSelection$$();
    return entries
      .map((entry, index) => ({ entry, index, order: orderMap[entry.service] }))
      .sort((left, right) => {
        if (left.order !== undefined && right.order !== undefined) return left.order - right.order;
        if (left.order !== undefined) return -1;
        if (right.order !== undefined) return 1;
        return left.index - right.index;
      })
      .map(({ entry }) => entry);
  });

  protected readonly serviceMetricsData$$ = computed<Map<string, ServiceMetricsData>>(() => {
    const granularity = this.selectedGranularity$$();
    const stepSeconds = METRICS_GRANULARITY_STEP_SECONDS[granularity];
    // 5-minute collapsing only makes sense for the raw minute-granularity feed —
    // hour/day granularity is already bucketed, nothing to collapse further.
    const isMinuteGranularity = granularity === 'minute';
    // The current 5-minute bucket keeps growing as new minute points arrive, so a
    // sum metric looks like it dips right before it — only fully elapsed buckets
    // are safe to compare against each other.
    const lastClosedCollapsedBucket = previousCompletedBucket(this.now$$(), COLLAPSED_MINUTE_STEP_SECONDS);
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

    const buildSeriesDisplay = (
      key: string,
      metricPoints: MetricPoint[],
      aggregation: MetricAggregation,
      chartMode: MetricChartMode,
      useCollapsed: boolean,
      window: MetricWindow,
    ): MetricChartCardSeriesDisplay => {
      const displayWindow = useCollapsed ? buildCollapsedMetricWindow(window, COLLAPSED_MINUTE_STEP_SECONDS) : window;
      const displayStepSeconds = useCollapsed ? COLLAPSED_MINUTE_STEP_SECONDS : stepSeconds;
      const displayPoints = useCollapsed
        ? filterMetricPointsByWindow(
            this.minuteMetricCollapseCache.collapse(key, metricPoints, aggregation, COLLAPSED_MINUTE_STEP_SECONDS),
            displayWindow.startBucket,
            aggregation === 'sum'
              ? Math.min(displayWindow.endBucket, lastClosedCollapsedBucket)
              : displayWindow.endBucket,
          )
        : metricPoints;
      const series =
        chartMode === 'bar'
          ? buildSparseBarSeriesFromPoints(displayPoints)
          : buildSparseLineSeriesFromPoints(displayPoints, displayStepSeconds);
      return {
        series,
        windowStartBucket: displayWindow.startBucket,
        windowEndBucket: displayWindow.endBucket,
        displayStepSeconds,
      };
    };

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
      const pointsIndex = buildMetricPointsIndex(servicePoints, serviceWindow.startBucket, serviceWindow.endBucket);
      const serviceDashboardSelection = dashboardSelection[option.service] ?? {};

      const buildCard = (name: string): MetricChartCardData => {
        const key = metricPointsIndexKey(option.service, name);
        const metricPoints = pointsIndex.get(key) ?? [];
        const aggregation = metricAggregation(option.service, name);
        const chartMode = metricChartMode(option.service, name);
        const display = buildSeriesDisplay(
          key,
          metricPoints,
          aggregation,
          chartMode,
          isMinuteGranularity,
          serviceWindow,
        );
        const fullWidthDisplay = isMinuteGranularity
          ? buildSeriesDisplay(key, metricPoints, aggregation, chartMode, false, serviceWindow)
          : display;
        const rawValue = metricPoints[metricPoints.length - 1]?.value ?? 0;
        const color = metricColor(option.service, name);
        const unit = metricUnit(option.service, name);
        const dashboardOrder = serviceDashboardSelection[name];
        return {
          key,
          label: metricLabel(option.service, name),
          technicalName: name,
          value: rawValue,
          displayValue: formatMetricUnitValue(unit, rawValue),
          unit,
          granularity,
          color,
          chartMode,
          description: metricDescription(option.service, name),
          display,
          fullWidthDisplay,
          isDashboardEnabled: dashboardOrder !== undefined,
          dashboardOrder: dashboardOrder ?? 0,
        };
      };

      const groups = (definition?.groups ?? []).map((group) => ({
        id: group.id,
        label: group.label,
        cards: group.metrics.map((config) => buildCard(config.name)),
      }));

      // Метрики, реально приходящие с бэка для этого сервиса, но ещё не описанные
      // ни в одной группе каталога — отдельный явно подписанный блок вместо того,
      // чтобы молча не показывать их вообще, пока кто-то не вспомнит завести вручную.
      const knownNames = metricsCatalogKnownNames(option.service);
      const observedNames = new Set(servicePoints.map((point) => point.name));
      const discoveredNames = Array.from(observedNames)
        .filter((name) => !knownNames.has(name))
        .sort();
      if (discoveredNames.length > 0) {
        groups.push({
          id: 'uncatalogued',
          label: 'Не в каталоге',
          cards: discoveredNames.map(buildCard),
        });
      }

      const selectedMetrics = Object.entries(dashboardSelection[option.service] ?? {});
      selectedMetrics.sort(
        ([leftName, leftOrder], [rightName, rightOrder]) => leftOrder - rightOrder || leftName.localeCompare(rightName),
      );
      const dashboardCards = selectedMetrics.map(([name]) => buildCard(name));

      result.set(option.service, { groups, dashboardCards });
    }

    const compositeDefinitions = this.compositeDefinitions$$();
    if (compositeDefinitions.length > 0) {
      const buildCompositeCard = (definition: CompositeMetricDefinition): MetricChartCardData | null => {
        if (!definition.metricName || !definition.serviceA || !definition.serviceB) return null;

        const valuesByBucket = (source: string): Map<number, number> => {
          const values = new Map<number, number>();
          for (const point of pointsByService.get(source) ?? []) {
            if (point.name !== definition.metricName) continue;
            values.set(point.bucket, point.value);
          }
          return values;
        };
        const valuesA = valuesByBucket(definition.serviceA);
        const valuesB = valuesByBucket(definition.serviceB);
        const buckets = definition.treatMissingAsZero
          ? new Set([...valuesA.keys(), ...valuesB.keys()])
          : new Set(Array.from(valuesA.keys()).filter((bucket) => valuesB.has(bucket)));
        const metricPoints: MetricPoint[] = Array.from(buckets)
          .sort((left, right) => left - right)
          .map((bucket) => ({
            service: COMPOSITE_SERVICE_KEY,
            name: definition.id,
            granularity,
            bucket,
            value: (valuesA.get(bucket) ?? 0) + (valuesB.get(bucket) ?? 0),
          }));

        const key = metricPointsIndexKey(COMPOSITE_SERVICE_KEY, definition.id);
        const aggregation = metricAggregation(definition.serviceA, definition.metricName);
        const chartMode = metricChartMode(definition.serviceA, definition.metricName);
        const compositeWindow = buildServiceMetricWindow(
          metricPoints,
          fallbackWindow.endBucket,
          METRICS_GRANULARITY_WINDOW_PERIODS[granularity],
          stepSeconds,
        );
        // Regular per-service cards get this trim for free from buildMetricPointsIndex
        // (windowed at index-build time) — composite metricPoints are assembled
        // straight from the full retained history above, so without this they'd leak
        // off-window historical values into the raw (non-collapsed) display's min/max.
        const windowedMetricPoints = filterMetricPointsByWindow(
          metricPoints,
          compositeWindow.startBucket,
          compositeWindow.endBucket,
        );
        const display = buildSeriesDisplay(
          key,
          windowedMetricPoints,
          aggregation,
          chartMode,
          isMinuteGranularity,
          compositeWindow,
        );
        const fullWidthDisplay = isMinuteGranularity
          ? buildSeriesDisplay(key, windowedMetricPoints, aggregation, chartMode, false, compositeWindow)
          : display;
        const rawValue = windowedMetricPoints[windowedMetricPoints.length - 1]?.value ?? 0;
        const unit = metricUnit(definition.serviceA, definition.metricName);
        return {
          key,
          label: `Σ ${metricLabel(definition.serviceA, definition.metricName)}`,
          technicalName: definition.metricName,
          value: rawValue,
          displayValue: formatMetricUnitValue(unit, rawValue),
          unit,
          granularity,
          color: metricColor(definition.serviceA, definition.metricName),
          chartMode,
          description: `Сумма «${definition.metricName}»: ${definition.serviceA} + ${definition.serviceB}`,
          display,
          fullWidthDisplay,
          // No per-card dashboard toggle for composite metrics — the whole
          // section is one on/off switch (Show in dashboard, above), so every
          // defined sum is always part of it.
          isDashboardEnabled: true,
          dashboardOrder: 0,
        };
      };

      // Order in the dashboard follows definition order — no per-card ordering
      // control, since there's no per-card enable step for the user to set it in.
      const compositeCards = compositeDefinitions
        .map(buildCompositeCard)
        .filter((card): card is MetricChartCardData => card !== null);

      result.set(COMPOSITE_SERVICE_KEY, {
        groups: [{ id: 'composite', label: DEFAULT_COMPOSITE_LABEL, cards: compositeCards }],
        dashboardCards: compositeCards,
      });
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
      rows.push({ id: option.service, label: this.resolvedServiceLabel(option.service), order, cards });
    }
    const compositeOrder = serviceSelection[COMPOSITE_SERVICE_KEY];
    const compositeCards = data.get(COMPOSITE_SERVICE_KEY)?.dashboardCards ?? [];
    if (compositeOrder !== undefined && compositeCards.length > 0) {
      rows.push({
        id: COMPOSITE_SERVICE_KEY,
        label: this.resolvedServiceLabel(COMPOSITE_SERVICE_KEY),
        order: compositeOrder,
        cards: compositeCards,
      });
    }
    rows.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
    return rows.map(({ id, label, cards }) => ({ id, label, cards }));
  });

  public ngOnInit(): void {
    this.metricsService.subscribe();
    this.nowTickIntervalId = setInterval(() => this.now$$.set(Date.now()), NOW_TICK_INTERVAL_MS);
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
  }

  public ngOnDestroy(): void {
    this.metricsService.unsubscribe();
    if (this.nowTickIntervalId !== null) {
      clearInterval(this.nowTickIntervalId);
    }
    window.removeEventListener('scroll', this.onWindowScroll);
  }

  protected resolvedServiceLabel(service: string): string {
    const customLabel = this.metricsSettingsService.serviceCustomLabels$$()[service]?.trim();
    if (customLabel) return customLabel;
    return service === COMPOSITE_SERVICE_KEY ? DEFAULT_COMPOSITE_LABEL : service;
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
      return this.isSettingsPanelExpanded$$();
    }
    return service === this.resolvedExpandedPanel();
  }

  protected toggleServiceExpanded(service: string): void {
    if (service === SETTINGS_PANEL_KEY) {
      this.isSettingsPanelExpanded$$.update((value) => !value);
      return;
    }

    if (service === this.resolvedExpandedPanel()) {
      return;
    }

    clearMetricSyncCrosshair();
    this.expandedPanel$$.set(service);
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

  protected onCardExpandedHeightChange(value: string): void {
    const expandedHeightPx = Number(value);
    if (!Number.isFinite(expandedHeightPx) || expandedHeightPx <= 0) return;
    this.metricsSettingsService.setCardExpandedHeightPx(expandedHeightPx);
  }

  protected cycleCardLayoutMode(): void {
    this.metricsSettingsService.cycleCardLayoutMode();
  }

  protected cycleTooltipMode(): void {
    this.metricsSettingsService.cycleActiveTooltipMode();
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

  protected saveSettings(): void {
    this.metricsSettingsService.saveNow();
  }

  protected clearMetricsCache(): void {
    this.metricsService.clearCache();
  }

  protected forceRefreshMetrics(): void {
    this.metricsService.forceRefresh();
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

  protected setDashboardMetricOrder(service: string, name: string, order: number): void {
    const current = this.dashboardSelection$$();
    if (current[service]?.[name] === undefined) return;

    this.metricsSettingsService.setDashboardSelection({
      ...current,
      [service]: { ...current[service], [name]: order },
    });
  }

  protected toggleCardEditMode(): void {
    this.isCardEditMode$$.update((value) => !value);
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

  // Sparse map: only explicit false (hidden) is stored, so a service is visible
  // by default the moment it's discovered, with nothing to migrate for old settings.
  protected isServiceVisibleInHeader(service: string): boolean {
    return this.metricsSettingsService.serviceHeaderVisibility$$()[service] !== false;
  }

  protected toggleServiceVisibleInHeader(service: string, visible: boolean): void {
    const current = this.metricsSettingsService.serviceHeaderVisibility$$();
    const next = { ...current };
    if (visible) {
      delete next[service];
    } else {
      next[service] = false;
    }
    this.metricsSettingsService.setServiceHeaderVisibility(next);
  }

  protected serviceCustomLabel(service: string): string {
    return this.metricsSettingsService.serviceCustomLabels$$()[service] ?? '';
  }

  protected setServiceCustomLabel(service: string, value: string): void {
    const current = this.metricsSettingsService.serviceCustomLabels$$();
    const next = { ...current };
    if (value.trim()) {
      next[service] = value;
    } else {
      delete next[service];
    }
    this.metricsSettingsService.setServiceCustomLabels(next);
  }

  protected toggleCompositeSettingsExpanded(): void {
    this.isCompositeSettingsExpanded$$.update((value) => !value);
  }

  protected addCompositeDefinition(): void {
    this.compositeMetricsSettingsService.addDefinition();
  }

  protected removeCompositeDefinition(id: string): void {
    this.compositeMetricsSettingsService.removeDefinition(id);
  }

  protected setCompositeMetricName(id: string, value: string): void {
    this.compositeMetricsSettingsService.setMetricName(id, value);
  }

  protected setCompositeServiceA(id: string, value: string): void {
    this.compositeMetricsSettingsService.setServiceA(id, value);
  }

  protected setCompositeServiceB(id: string, value: string): void {
    this.compositeMetricsSettingsService.setServiceB(id, value);
  }

  protected setCompositeTreatMissingAsZero(id: string, value: boolean): void {
    this.compositeMetricsSettingsService.setTreatMissingAsZero(id, value);
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

  // Falls back to the Dashboard panel (not "first visible service") the moment the
  // expanded service is hidden from the header — Dashboard is the primary view now.
  private resolvedExpandedPanel(): string {
    const current = this.expandedPanel$$();
    if (current === DASHBOARD_PANEL_KEY) {
      return current;
    }
    if (current === COMPOSITE_SERVICE_KEY) {
      return this.isServiceVisibleInHeader(COMPOSITE_SERVICE_KEY) ? current : DASHBOARD_PANEL_KEY;
    }
    if (this.visibleServiceOptions$$().some((option) => option.service === current)) {
      return current;
    }
    return DASHBOARD_PANEL_KEY;
  }
}
