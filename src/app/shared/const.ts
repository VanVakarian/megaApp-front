import { ChartConfiguration } from 'chart.js';

import { Settings } from './interfaces';

export const FETCH_DAYS_RANGE_OFFSET: number = 10; // TODO: create settings item out of this constant

// export const CHART_COLORS_OLD = {
//   primary: 'red',
//   primaryAlpha: '#ff00004f',
//   average: 'blue',
//   averageAlpha: '#adadff'
// };

interface ChartColors {
  main: string;
  mainAlpha: string;
  secondary: string;
  secondaryAlpha: string;
}

export const CHART_COLORS: ChartColors = {
  main: '#578f92',
  mainAlpha: '#578f9250',
  secondary: '#345b5b',
  secondaryAlpha: '#345b5b50',
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
        borderColor: CHART_COLORS.main,
        backgroundColor: CHART_COLORS.main,
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
    scales: {
      x: {
        ticks: {},
      },
      y: {
        ticks: { stepSize: 500 },
      },
    },
  },
};

export const enToRuTransliterationRules: { [key: string]: string } = {
  '`': 'ё',
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
};

export const USER_PREFERRED_MIDNIGHT_OFFSET_HOURS: number = 5;

export const DEFAULT_INPUT_FIELD_PROGRESS_TIMER: number = 2000;
export const DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER: number = 3000;

export const DEFAULT_SETTINGS: Settings = {
  selectedChapterFood: false,
  selectedChapterMoney: false,
  darkTheme: false,
  height: null,
  userName: '',
};

export const DEFAULT_CACHED_REQUEST_VALIDITY_MS: number = 1000;
