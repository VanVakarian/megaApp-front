import { Chart, ChartType, Plugin } from 'chart.js';

export interface MetricSyncCrosshairOptions {
  enabled: boolean;
  windowStartBucket: number;
  windowEndBucket: number;
  displayStepSeconds: number;
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    metricSyncCrosshair?: MetricSyncCrosshairOptions;
  }
}

const CROSSHAIR_LINE_COLOR = 'rgba(59, 130, 246, 0.65)';
const CROSSHAIR_LINE_DASH = [4, 4];
const CROSSHAIR_LINE_WIDTH = 1;

const registeredCharts = new Set<Chart>();

let hoverBucket: number | null = null;
let redrawScheduled = false;

function requestCrosshairRedraw(): void {
  if (redrawScheduled) {
    return;
  }

  redrawScheduled = true;
  requestAnimationFrame(() => {
    redrawScheduled = false;
    for (const chart of registeredCharts) {
      chart.update('none');
    }
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readMetricSyncCrosshairOptions(options: unknown): MetricSyncCrosshairOptions | null {
  if (!options || typeof options !== 'object') {
    return null;
  }

  const candidate = options as Partial<MetricSyncCrosshairOptions>;
  if (
    typeof candidate.enabled !== 'boolean' ||
    !Number.isFinite(candidate.windowStartBucket) ||
    !Number.isFinite(candidate.windowEndBucket) ||
    !Number.isFinite(candidate.displayStepSeconds)
  ) {
    return null;
  }

  return {
    enabled: candidate.enabled,
    windowStartBucket: candidate.windowStartBucket as number,
    windowEndBucket: candidate.windowEndBucket as number,
    displayStepSeconds: candidate.displayStepSeconds as number,
  };
}

function resolveHoverBucket(chart: Chart, options: MetricSyncCrosshairOptions, eventX: number): number | null {
  const tooltipBucket = chart.tooltip?.dataPoints?.[0]?.parsed?.x;
  if (Number.isFinite(tooltipBucket)) {
    return tooltipBucket as number;
  }

  const xScale = chart.scales['x'];
  if (!xScale) {
    return null;
  }

  const rawBucket = xScale.getValueForPixel(eventX);
  if (typeof rawBucket !== 'number' || !Number.isFinite(rawBucket)) {
    return null;
  }

  const relativeBucket = (rawBucket - options.windowStartBucket) / options.displayStepSeconds;
  const snappedBucket = options.windowStartBucket + Math.round(relativeBucket) * options.displayStepSeconds;
  return clamp(snappedBucket, options.windowStartBucket, options.windowEndBucket);
}

export function clearMetricSyncCrosshair(): void {
  if (hoverBucket === null) {
    return;
  }

  hoverBucket = null;
  requestCrosshairRedraw();
}

export const metricSyncCrosshairPlugin: Plugin<'line' | 'bar'> = {
  id: 'metricSyncCrosshair',
  afterInit(chart) {
    registeredCharts.add(chart);
  },
  afterDestroy(chart) {
    registeredCharts.delete(chart);
    if (registeredCharts.size === 0) {
      hoverBucket = null;
    }
  },
  afterEvent(chart, args, pluginOptions) {
    const options = readMetricSyncCrosshairOptions(pluginOptions);
    if (!options?.enabled) {
      return;
    }

    if (args.event.type === 'mouseout') {
      clearMetricSyncCrosshair();
      return;
    }

    if (args.event.type !== 'mousemove' || !args.inChartArea) {
      return;
    }

    if (typeof args.event.x !== 'number') {
      return;
    }

    const nextHoverBucket = resolveHoverBucket(chart, options, args.event.x);
    if (nextHoverBucket === null || nextHoverBucket === hoverBucket) {
      return;
    }

    hoverBucket = nextHoverBucket;
    requestCrosshairRedraw();
  },
  afterDraw(chart, _args, pluginOptions) {
    const options = readMetricSyncCrosshairOptions(pluginOptions);
    if (!options?.enabled || hoverBucket === null) {
      return;
    }

    const currentHoverBucket = hoverBucket;

    if (currentHoverBucket < options.windowStartBucket || currentHoverBucket > options.windowEndBucket) {
      return;
    }

    const xScale = chart.scales['x'];
    if (!xScale) {
      return;
    }

    const x = xScale.getPixelForValue(currentHoverBucket);
    const { left, right, top, bottom } = chart.chartArea;
    if (x < left || x > right) {
      return;
    }

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = CROSSHAIR_LINE_WIDTH;
    ctx.strokeStyle = CROSSHAIR_LINE_COLOR;
    ctx.setLineDash(CROSSHAIR_LINE_DASH);
    ctx.stroke();
    ctx.restore();
  },
};
