import { ChartConfiguration } from 'chart.js';

interface ChartColors {
  main: string;
  mainAlpha: string;
  secondary: string;
  secondaryAlpha: string;
  virtual: string;
  virtualAlpha: string;
}

export interface MonthLabelsPluginOptions {
  lineColor: string;
  lineWidth: number;
  segmentColor: string;
  segmentWidth: number;
  separatorColorChart: string;
  separatorColorLegend: string;
  separatorWidth: number;
  separatorHeight: number;
  labelColor: string;
  labelFont: string;
  labelPadding: number;
  lineOffset: number;
  labelOffset: number;
  shortMonthSwitchMonths: number;
  yearSwitchMonths: number;
}

export const CHART_COLORS: ChartColors = {
  main: '#578f92',
  mainAlpha: '#578f9250',
  secondary: '#345b5b',
  secondaryAlpha: '#345b5b50',
  virtual: '#9fc9cb',
  virtualAlpha: '#9fc9cb80',
};

export const WEIGHT_CHART_SETTINGS: ChartConfiguration = {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Вес',
        data: [],
        order: 2,
        fill: true,
        borderColor: CHART_COLORS.main,
        backgroundColor: CHART_COLORS.main,
        pointRadius: 2,
        pointHitRadius: 20,
      },
      {
        label: 'Средний вес за 7 дней',
        data: [],
        order: 1,
        borderColor: CHART_COLORS.secondary,
        backgroundColor: CHART_COLORS.secondary,
        pointRadius: 2,
        pointHitRadius: 20,
      },
    ],
  },
  options: {
    animation: false,
    elements: { line: { tension: 0.5 } },
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {},
      },
      y: {
        ticks: { stepSize: 1 },
      },
    },
  },
};

export const KCALS_CHART_SETTINGS: ChartConfiguration = {
  type: 'bar',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Ккал за день',
        data: [],
        order: 2,
        stack: 'kcals',
        borderColor: CHART_COLORS.main,
        backgroundColor: CHART_COLORS.main,
        borderWidth: 1,
        barThickness: 'flex',
        maxBarThickness: 30,
      },
      {
        label: 'Виртуальные ккал',
        data: [],
        order: 2,
        stack: 'kcals',
        borderColor: CHART_COLORS.virtual,
        backgroundColor: CHART_COLORS.virtual,
        borderWidth: 1,
        barThickness: 'flex',
        maxBarThickness: 30,
      },
      {
        label: 'Целевое значение',
        data: [],
        order: 1,
        type: 'line',
        borderColor: CHART_COLORS.secondary,
        backgroundColor: CHART_COLORS.secondary,
        pointRadius: 2,
        pointHitRadius: 20,
      },
    ],
  },
  options: {
    animation: false,
    maintainAspectRatio: false,
    events: [],
    plugins: {
      tooltip: {
        enabled: false,
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {},
      },
      y: {
        stacked: true,
        display: false,
        ticks: {
          display: false,
          stepSize: 500,
        },
      },
    },
  },
};

export const FOOD_STATS_MONTH_LABELS_PADDING = 24;

export const FOOD_STATS_MONTH_LABELS_OPTIONS: MonthLabelsPluginOptions = {
  lineColor: 'rgba(0, 0, 0, 0.2)',
  lineWidth: 1,
  segmentColor: 'rgba(0, 0, 0, 0.35)',
  segmentWidth: 2,
  separatorColorChart: 'rgba(0, 0, 0, 0.1)',
  separatorColorLegend: 'rgba(0, 0, 0, 0.45)',
  separatorWidth: 1,
  separatorHeight: 10,
  labelColor: '#3f4a5a',
  labelFont: '12px system-ui, -apple-system, sans-serif',
  labelPadding: 8,
  lineOffset: 26,
  labelOffset: 3,
  shortMonthSwitchMonths: 6,
  yearSwitchMonths: 8,
};
