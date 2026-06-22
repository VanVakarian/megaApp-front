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
        fill: false,
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

export const BALANCE_ACCOUNT_PALETTE = [
  'rgb(78, 121, 167)',
  'rgb(242, 142, 43)',
  'rgb(225, 87, 89)',
  'rgb(118, 183, 178)',
  'rgb(89, 161, 79)',
  'rgb(237, 201, 72)',
  'rgb(176, 122, 161)',
  'rgb(255, 157, 167)',
  'rgb(156, 117, 95)',
  'rgb(186, 176, 172)',
  'rgb(211, 114, 149)',
  'rgb(160, 203, 232)',
  'rgb(255, 190, 125)',
  'rgb(134, 188, 182)',
  'rgb(140, 209, 125)',
  'rgb(241, 206, 99)',
];

export const BALANCE_CHART_CONFIG: ChartConfiguration<'line'> = {
  type: 'line',
  data: { labels: [], datasets: [] },
  options: {
    animation: false,
    elements: { line: { tension: 0.3 }, point: { radius: 0, hitRadius: 20 } },
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'nearest',
        intersect: false,
        filter: (item) => {
          const raw = (item.dataset as any)['_rawValues'];
          if (!raw) return item.parsed.y !== 0;
          return raw[item.dataIndex] !== 0;
        },
        callbacks: {
          label: (ctx) => {
            const raw = (ctx.dataset as any)['_rawValues'];
            const value = raw ? raw[ctx.dataIndex] : ctx.parsed.y;
            return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, callback: () => '' },
      },
      y: {
        min: 0,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value as number),
        },
      },
    },
  },
};

export const INCOME_CHART_ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(['Зарплата', 'Проекты', 'Проценты']);

const INCOME_BASE_COLORS: string[] = [
  'rgb(30, 64, 175)',
  'rgb(3, 105, 161)',
  'rgb(180, 83, 9)',
  'rgb(185, 28, 28)',
  'rgb(21, 128, 61)',
  'rgb(15, 118, 110)',
  'rgb(124, 58, 237)',
  'rgb(190, 24, 93)',
];

const INCOME_COLOR_ALPHA = 0.8;

export const INCOME_SERIES_PALETTE = INCOME_BASE_COLORS.map((rgb) =>
  rgb.replace('rgb(', 'rgba(').replace(')', `, ${INCOME_COLOR_ALPHA})`),
);

export const INCOME_VIRTUAL_SERIES = {
  DIVIDENDS: -1,
  CB_CLOSED_PNL: -2,
  CB_OPEN_PNL: -3,
  CRYPTO_CLOSED_PNL: -4,
  CRYPTO_OPEN_PNL: -5,
} as const;

export const INCOME_CHART_CONFIG: ChartConfiguration<'bar'> = {
  type: 'bar',
  data: { labels: [], datasets: [] },
  options: {
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            if (ctx.parsed.y === 0) return '';
            return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(ctx.parsed.y)} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
      },
      y: {
        stacked: true,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value as number),
        },
      },
    },
  },
};

export interface ExpenseCategoryConfig {
  name: string;
  color: string;
}

const EXPENSE_COLOR_ALPHA = 0.85;

export const EXPENSE_CATEGORY_CONFIG: ExpenseCategoryConfig[] = [
  { name: 'Еда', color: 'rgb(103, 184, 66)' },
  { name: 'Алкоголь', color: 'rgb(255, 153, 0)' },
  { name: 'Квартплата', color: 'rgb(74, 134, 232)' },
  { name: 'Развл.', color: 'rgb(56, 118, 29)' },
  { name: 'Отдых', color: 'rgb(230, 102, 0)' },
  { name: 'Проезд', color: 'rgb(111, 168, 220)' },
  { name: 'Одежда', color: 'rgb(204, 0, 0)' },
  { name: 'Связь', color: 'rgb(255, 217, 102)' },
  { name: 'Рекуррентка', color: 'rgb(152, 0, 0)' },
  { name: 'Лекарства', color: 'rgb(28, 69, 135)' },
  { name: 'Хоз.товары', color: 'rgb(234, 153, 153)' },
  { name: 'Запчасти', color: 'rgb(39, 78, 19)' },
  { name: 'Прочее', color: 'rgb(183, 183, 183)' },
  { name: 'Подарок', color: 'rgb(153, 0, 255)' },
  { name: 'Техника', color: 'rgb(255, 0, 0)' },
];

const EXPENSE_FALLBACK_COLOR = 'rgb(183, 183, 183)';

export function rgbToRgba(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}

export function getExpenseCategoryColor(categoryName: string, fallbackIndex: number): string {
  const entry = EXPENSE_CATEGORY_CONFIG.find((c) => c.name === categoryName);
  return rgbToRgba(entry ? entry.color : EXPENSE_FALLBACK_COLOR, EXPENSE_COLOR_ALPHA);
}

export const EXPENSE_CHART_CONFIG: ChartConfiguration<'bar'> = {
  type: 'bar',
  data: { labels: [], datasets: [] },
  options: {
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            if (ctx.parsed.y === 0) return '';
            return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(ctx.parsed.y)} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
      },
      y: {
        stacked: true,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value as number),
        },
      },
    },
  },
};

export const METRICS_WINDOW_MINUTES = 24 * 60;
export const METRICS_TICK_INTERVAL_MINUTES = 6 * 60;

export function createMetricSparklineConfig(color: string): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          borderColor: color,
          backgroundColor: rgbToRgba(color, 0.15),
          borderWidth: 1.5,
          fill: true,
          pointRadius: 0,
          pointHitRadius: 12,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      elements: { line: { tension: 0.3 } },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'nearest', intersect: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.06)' },
          ticks: { maxRotation: 0, autoSkip: false },
        },
        y: {
          min: 0,
          display: false,
          ticks: { precision: 0 },
        },
      },
    },
  };
}

export const METRICS_SERIES_PALETTE: string[] = [
  'rgb(87, 143, 146)',
  'rgb(214, 130, 60)',
  'rgb(180, 83, 9)',
  'rgb(21, 128, 61)',
  'rgb(124, 58, 237)',
];
