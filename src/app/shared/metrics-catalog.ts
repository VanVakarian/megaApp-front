import { MetricAggregation } from '@app/shared/metrics-aggregation';
import { MetricChartMode } from '@app/shared/metrics-chart-mode';
import { MetricUnit } from '@app/shared/metric-units';
import { DEFAULT_METRIC_COLOR, MetricConfig, MetricsServiceDefinition } from '@app/shared/metrics-catalog-metric';
import { HARDWARE_METRICS_DEFINITION } from '@app/shared/metrics-catalog.hardware';
import { MEGAAPP_METRICS_DEFINITION } from '@app/shared/metrics-catalog.megaapp';
import { SOZVON_KONSPEKT_METRICS_DEFINITION } from '@app/shared/metrics-catalog.sozvon-konspekt';
import { SPREAD_CAPTURE_BOT_METRICS_DEFINITION } from '@app/shared/metrics-catalog.spread-capture-bot';
import { SPREAD_CAPTURE_BOT_V4_METRICS_DEFINITION } from '@app/shared/metrics-catalog.spread-capture-bot-v4';

export type { MetricsGroupDefinition, MetricsServiceDefinition } from '@app/shared/metrics-catalog-metric';

const UNCATALOGUED_DEFAULTS = {
  aggregation: 'avgRound' as MetricAggregation,
  unit: 'count' as MetricUnit,
  chartMode: 'sparse-line' as MetricChartMode,
  color: DEFAULT_METRIC_COLOR,
  description: 'Метрика ещё не описана в каталоге — показано значение по умолчанию.',
};

interface ResolvedCatalog {
  definition: MetricsServiceDefinition;
  byName: ReadonlyMap<string, MetricConfig>;
}

function buildCatalog(definition: MetricsServiceDefinition): ResolvedCatalog {
  const byName = new Map<string, MetricConfig>();
  for (const group of definition.groups) {
    for (const config of group.metrics) {
      if (byName.has(config.name)) {
        throw new Error(`Duplicate metric name "${config.name}" in service "${definition.service}"`);
      }
      byName.set(config.name, config);
    }
  }
  return { definition, byName };
}

const STATIC_CATALOGS: ResolvedCatalog[] = [
  buildCatalog(SPREAD_CAPTURE_BOT_METRICS_DEFINITION),
  buildCatalog(SPREAD_CAPTURE_BOT_V4_METRICS_DEFINITION),
  buildCatalog(MEGAAPP_METRICS_DEFINITION),
  buildCatalog(SOZVON_KONSPEKT_METRICS_DEFINITION),
];

const STATIC_CATALOG_BY_SERVICE = new Map<string, ResolvedCatalog>(
  STATIC_CATALOGS.map((catalog) => [catalog.definition.service, catalog]),
);

const HARDWARE_CATALOG = buildCatalog(HARDWARE_METRICS_DEFINITION);
const HARDWARE_SERVICE_PREFIX = 'hardware:';

const METRICS_SERVICE_VARIANTS: Record<string, { baseService: string; label: string }> = {
  'megaapp-test': { baseService: 'megaapp', label: 'MegaApp Test' },
};

function isHardwareService(service: string): boolean {
  return service.startsWith(HARDWARE_SERVICE_PREFIX);
}

function hardwareServiceLabel(service: string): string {
  const suffix = service.slice(HARDWARE_SERVICE_PREFIX.length).trim();
  return suffix ? `Hardware: ${suffix}` : HARDWARE_CATALOG.definition.label;
}

function resolveCatalog(service: string): ResolvedCatalog | null {
  const direct = STATIC_CATALOG_BY_SERVICE.get(service);
  if (direct) return direct;
  if (isHardwareService(service)) return HARDWARE_CATALOG;

  const variant = METRICS_SERVICE_VARIANTS[service];
  if (variant) return STATIC_CATALOG_BY_SERVICE.get(variant.baseService) ?? null;

  return null;
}

export function metricsServiceLabel(service: string): string {
  if (isHardwareService(service)) return hardwareServiceLabel(service);
  const variant = METRICS_SERVICE_VARIANTS[service];
  if (variant) return variant.label;
  return STATIC_CATALOG_BY_SERVICE.get(service)?.definition.label ?? service;
}

export function metricsServiceDefinition(service: string | null | undefined): MetricsServiceDefinition | null {
  if (!service) return null;
  const catalog = resolveCatalog(service);
  if (!catalog) return null;
  if (service === catalog.definition.service) return catalog.definition;
  // Динамический hardware-хост или megaapp-test-вариант — те же группы/метрики, другие service/label.
  return { ...catalog.definition, service, label: metricsServiceLabel(service) };
}

export function metricsServiceDefinitions(): MetricsServiceDefinition[] {
  return STATIC_CATALOGS.map((catalog) => catalog.definition);
}

export function metricsCatalogKnownNames(service: string): ReadonlySet<string> {
  const catalog = resolveCatalog(service);
  return catalog ? new Set(catalog.byName.keys()) : new Set();
}

function lookupMetric(service: string, name: string): MetricConfig | null {
  return resolveCatalog(service)?.byName.get(name) ?? null;
}

export function metricLabel(service: string, name: string): string {
  return lookupMetric(service, name)?.label ?? name;
}

export function metricDescription(service: string, name: string): string {
  return lookupMetric(service, name)?.description ?? UNCATALOGUED_DEFAULTS.description;
}

export function metricAggregation(service: string, name: string): MetricAggregation {
  return lookupMetric(service, name)?.aggregation ?? UNCATALOGUED_DEFAULTS.aggregation;
}

export function metricUnit(service: string, name: string): MetricUnit {
  return lookupMetric(service, name)?.unit ?? UNCATALOGUED_DEFAULTS.unit;
}

export function metricColor(service: string, name: string): string {
  return lookupMetric(service, name)?.color ?? UNCATALOGUED_DEFAULTS.color;
}

export function metricChartMode(service: string, name: string): MetricChartMode {
  return lookupMetric(service, name)?.chartMode ?? UNCATALOGUED_DEFAULTS.chartMode;
}
