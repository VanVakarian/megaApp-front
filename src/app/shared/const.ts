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

// Registered cache entities and their current schema version. Bumping one key's version
// invalidates only that key — unlike the old single global CACHE_SCHEMA_VERSION, which
// invalidated everything at once whenever any one entity's format changed.
// A baseKey missing here is treated as retired: buildCacheKey/buildDeviceCacheKey refuse it
// (dev-mode), and any leftover stored copy is swept up by the next purge pass — this is also
// how a genuinely removed key (renamed or dropped) gets cleaned out, no separate obsolete-list
// needed. `food_diary` (pre-IndexedDB-migration localStorage blob) is intentionally absent for
// that reason — any leftover copy just gets purged.
export const CACHE_KEY_VERSIONS: Readonly<Record<string, number>> = {
  settings: 4,
  food_stats: 4,
  food_stats_slider: 4,
  food_catalogue: 4,
  food_search_cache: 4,
  food_personal_kcals: 4,
  food_diary_deleted_day_snapshot: 4,
  food_stats_accordion_open_blocks: 1,
  food_stats_top_products_metric: 1,
  money_settings: 4,
  money_snapshot: 4,
  metrics_detail: 4,
  metrics_settings: 4,
  metrics_granularity: 4,
  metrics_active_card_layout_mode: 4,
  metrics_active_tooltip_mode: 4,
  metrics_force_zero_baseline_enabled: 4,
  metrics_anomaly_filter_enabled: 4,
  performance_metrics_queue: 1,
  sync_pending_operation: 4,
  navbar_collapsed: 1,
};

// Owned here (not in idb-cache.ts) so IDB_STORE_SCHEMA_CHECKPOINTS below can key off the same
// constant instead of a bare string literal that could silently drift out of sync with it.
export const DIARY_DAYS_STORE_NAME = 'foodDiaryDays';

// IndexedDB dedicated per-record stores (see idb-cache.ts) can't carry a version in their keys
// the way localStorage/kv entries do (their keys are business data — dates — not ours to
// suffix). Instead each store records the IndexedDB DB_VERSION at which its record shape last
// changed; onupgradeneeded wipes and recreates only stores whose checkpoint is newer than the
// DB's previous version, leaving every other store untouched.
export const IDB_STORE_SCHEMA_CHECKPOINTS: Readonly<Record<string, number>> = {
  [DIARY_DAYS_STORE_NAME]: 2,
};

export const SESSION_BOOTSTRAP_TIMEOUT_MS: number = 9000;

export const NOTIFICATION_PENDING_DELAY_MS: number = 1500;

export const NOTIFICATION_DEFAULT_DURATION_MS: number = 3000;
