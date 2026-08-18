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

function isStatusExcluded(hue: number): boolean {
  return STATUS_EXCLUDED_HUE_RANGES.some(([start, end]) => hue >= start && hue <= end);
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

// Same lightness-inversion logic as CHART_COLORS_LIGHT/DARK's main/secondary/virtual roles,
// generalized from 3 fixed roles to N generated hues: one fixed OKLCH lightness/chroma recipe
// per theme, hue is the only thing that varies between categories. Perceptually uniform in
// OKLCH (unlike HSL), so every category reads as equally prominent regardless of its hue.
const LIGHTNESS_CHROMA_BY_THEME = {
  light: { lightness: 0.7, chroma: 0.2 },
  dark: { lightness: 0.7, chroma: 0.2 },
};

// Named reference points on the hue circle, for pin() calls that want a recognizable color
// instead of a bare degree number. Red/Orange/Green intentionally sit at the same hues as the
// app's status colors (danger/warning/success) — pin() deliberately bypasses
// STATUS_EXCLUDED_HUE_RANGES, so picking e.g. CategoricalHue.Green is exactly "the green
// everyone already expects", not an approximation of it.
export const CategoricalHue = {
  Red: 20,
  Orange: 40,
  Yellow: 75,
  Green: 142,
  Teal: 180,
  Blue: 250,
  Purple: 280,
  Lilac: 300,
  Pink: 330,
} as const;

export type CategoricalHue = (typeof CategoricalHue)[keyof typeof CategoricalHue];

function toColorString(hue: number, colors: ChartColors, alpha: number | undefined): string {
  const { lightness, chroma } = colors.isDark ? LIGHTNESS_CHROMA_BY_THEME.dark : LIGHTNESS_CHROMA_BY_THEME.light;
  const h = hue.toFixed(1);
  return alpha === undefined ? `oklch(${lightness} ${chroma} ${h})` : `oklch(${lightness} ${chroma} ${h} / ${alpha})`;
}

export interface CategoricalPalette {
  // Reserves `hue` for `key` (e.g. a category name). Call this for every pin before the first
  // getColor() of the palette — pins steer auto-picked hues away from themselves, so pinning
  // after auto colors already landed nearby won't retroactively move those.
  pin(key: string, hue: number): void;
  // Stable per-identity categorical color: same `key` always yields the same hue, independent
  // of call order or how many other keys exist. Falls back to the next unclaimed hue in a
  // continuous golden-angle scan the first time a key is seen, shared across every key in this
  // palette so two keys can never collide on the same hue.
  getColor(key: string, colors: ChartColors, alpha?: number): string;
}

// One palette = one independent hue pool. Chart domains (expense categories, income sources,
// balance accounts) each get their own instance so a pin in one domain doesn't eat into another
// domain's available hue space.
export function createCategoricalPalette(): CategoricalPalette {
  const pinnedHues = new Map<string, number>();
  const assignedHues = new Map<string, number>();
  let nextRawStep = 0;

  function isAutoExcluded(hue: number): boolean {
    if (isStatusExcluded(hue)) return true;
    for (const pinnedHue of pinnedHues.values()) {
      if (circularHueDistance(hue, pinnedHue) < PIN_EXCLUSION_RADIUS_DEG) return true;
    }
    return false;
  }

  function nextAutoHue(): number {
    let hue: number;
    do {
      hue = (nextRawStep * GOLDEN_ANGLE_DEG) % 360;
      nextRawStep++;
    } while (isAutoExcluded(hue));
    return hue;
  }

  function pin(key: string, hue: number): void {
    pinnedHues.set(key, hue);
    assignedHues.set(key, hue);
  }

  function hueForKey(key: string): number {
    const existing = assignedHues.get(key);
    if (existing !== undefined) return existing;
    const hue = nextAutoHue();
    assignedHues.set(key, hue);
    return hue;
  }

  function getColor(key: string, colors: ChartColors, alpha?: number): string {
    return toColorString(hueForKey(key), colors, alpha);
  }

  return { pin, getColor };
}
