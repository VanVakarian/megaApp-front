import type { ChartColors } from '@app/shared/chart-config';

// Golden angle: the standard way to place N points around a circle so they stay maximally
// spread regardless of N — no clustering, no fixed palette-length ceiling to wrap around.
const GOLDEN_ANGLE_DEG = 137.508;

// Hue bands reserved for the app's status colors (--v-color-danger/warning/success), so an
// auto-picked category swatch is never mistakable for an error/warning/success indicator
// elsewhere in the UI. Red and orange sit next to each other and are merged into one band.
const STATUS_EXCLUDED_HUE_RANGES: readonly [number, number][] = [
  [350, 360],
  [0, 40],
  [125, 160],
];

// How close (in degrees) an auto-picked hue is allowed to land next to a manually pinned one.
// Pins themselves are exempt from every exclusion rule below — that's the point of choosing one
// deliberately — but auto colors still steer clear of them so a pinned category stays visually
// unique against the rest of the chart.
const PIN_EXCLUSION_RADIUS_DEG = 35;

// The golden-angle scan lands within ~1deg of any point after this many steps, so if none of them
// is allowed, no hue is.
const MAX_AUTO_HUE_ATTEMPTS = 360;

function isStatusExcluded(hue: number): boolean {
  return STATUS_EXCLUDED_HUE_RANGES.some(([start, end]) => hue >= start && hue <= end);
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

// Next golden-angle hue that is neither a status color nor close to a pinned one. `cursor` is the
// caller's scan position, so a palette keeps drawing from where it left off.
function scanAutoHue(cursor: { step: number }, pinnedHues: readonly number[]): number {
  const isExcluded = (candidate: number): boolean =>
    isStatusExcluded(candidate) ||
    pinnedHues.some((pinnedHue) => circularHueDistance(candidate, pinnedHue) < PIN_EXCLUSION_RADIUS_DEG);
  const nextCandidate = (): number => (cursor.step++ * GOLDEN_ANGLE_DEG) % 360;

  for (let attempt = 0; attempt < MAX_AUTO_HUE_ATTEMPTS; attempt++) {
    const hue = nextCandidate();
    if (!isExcluded(hue)) return hue;
  }
  // Pins chosen by the user plus the status bands can cover the whole circle; take the next hue
  // as it is rather than scan forever.
  return nextCandidate();
}

// Same lightness-inversion logic as CHART_COLORS_LIGHT/DARK's main/secondary/virtual roles,
// generalized from 3 fixed roles to N generated hues: one fixed OKLCH lightness/chroma recipe
// per theme, hue is the only thing that varies between categories. Perceptually uniform in
// OKLCH (unlike HSL), so every category reads as equally prominent regardless of its hue.
const LIGHTNESS_CHROMA_BY_THEME = {
  light: { lightness: 0.7, chroma: 0.2 },
  dark: { lightness: 0.7, chroma: 0.2 },
};

// Alpha for a muted (non-hovered) category segment when another category is highlighted across
// a stacked-bar chart (see category-hover-highlight.ts). One value for both themes: the OKLCH
// lightness/chroma recipe above already normalizes perceived weight per theme, so the same alpha
// reads as an equivalently muted tone against either theme's chart background.
export const CATEGORY_DIM_ALPHA = 0.25;

export function hueToColor(hue: number, colors: ChartColors, alpha?: number): string {
  const { lightness, chroma } = colors.isDark ? LIGHTNESS_CHROMA_BY_THEME.dark : LIGHTNESS_CHROMA_BY_THEME.light;
  const h = hue.toFixed(1);
  return alpha === undefined ? `oklch(${lightness} ${chroma} ${h})` : `oklch(${lightness} ${chroma} ${h} / ${alpha})`;
}

export interface SeriesHueInput {
  id: number;
  // A hue the user picked for this series, or null for "pick one automatically".
  hue: number | null;
}

// Hue of every series of one chart. Pinned series keep their hue; the rest get golden-angle hues
// that avoid status colors and pinned neighbours, handed out in ascending id order. The result
// depends only on the set of series — not on render order, enabled checkboxes or data — so a new
// series (highest id) never recolors the others.
export function assignSeriesHues(series: readonly SeriesHueInput[]): Map<number, number> {
  const hues = new Map<number, number>();
  for (const item of series) {
    if (item.hue !== null) hues.set(item.id, item.hue);
  }
  const pinnedHues = Array.from(hues.values());
  const cursor = { step: 0 };
  const auto = series.filter((item) => item.hue === null).sort((a, b) => a.id - b.id);
  for (const item of auto) hues.set(item.id, scanAutoHue(cursor, pinnedHues));
  return hues;
}

export interface CategoricalPalette {
  // Stable per-identity categorical color: same `key` always yields the same hue, independent
  // of call order or how many other keys exist. Falls back to the next unclaimed hue in a
  // continuous golden-angle scan the first time a key is seen, shared across every key in this
  // palette so two keys can never collide on the same hue.
  getColor(key: string, colors: ChartColors, alpha?: number): string;
}

// One palette = one independent hue pool (the balance chart's accounts have their own instance).
export function createCategoricalPalette(): CategoricalPalette {
  const assignedHues = new Map<string, number>();
  const cursor = { step: 0 };

  function hueForKey(key: string): number {
    const existing = assignedHues.get(key);
    if (existing !== undefined) return existing;
    const hue = scanAutoHue(cursor, []);
    assignedHues.set(key, hue);
    return hue;
  }

  function getColor(key: string, colors: ChartColors, alpha?: number): string {
    return hueToColor(hueForKey(key), colors, alpha);
  }

  return { getColor };
}
