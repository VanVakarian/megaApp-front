import { UserSettings } from './types';

export const FETCH_DAYS_RANGE_OFFSET: number = 10; // TODO: create settings item out of this constant

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

export const USER_PREFERRED_MIDNIGHT_OFFSET_HOURS: number = 4;

export const DEFAULT_INPUT_FIELD_PROGRESS_TIMER: number = 2000;

export const DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER: number = 3000;

export const DEFAULT_SETTINGS: UserSettings = {
  selectedChapterFood: false,
  selectedChapterMoney: false,
  darkTheme: false,
  liteVersion: false,
  height: null,
  userName: '',
};

export const BACKGROUND_SYNC_RETRIES_MAX: number = 3;

export const BACKGROUND_SYNC_TIMEOUT_MS: number = 8000;

export const CACHE_SCHEMA_VERSION: number = 1;

export const USER_SCOPED_CACHE_BASE_KEYS: string[] = [
  'settings',
  'food_stats',
  'food_stats_slider',
  'food_catalogue',
  'food_search_cache',
  'food_coefficients',
  'food_diary',
  'food_diary_deleted_day_snapshot',
  'money_settings',
  'money_snapshot',
  'metrics_detail',
];

export const SESSION_BOOTSTRAP_TIMEOUT_MS: number = 9000;

export const NOTIFICATION_PENDING_DELAY_MS: number = 1500;

export const NOTIFICATION_DEFAULT_DURATION_MS: number = 3000;
