import type { ChartColors } from '@app/shared/chart-config';
import { assignSeriesHues, createCategoricalPalette, hueToColor } from './categorical-palette';

const colors: ChartColors = {
  main: '',
  mainAlpha: '',
  secondary: '',
  secondaryAlpha: '',
  virtual: '',
  virtualAlpha: '',
  text: '',
  grid: '',
  isDark: false,
};

// Mirrors the private STATUS_EXCLUDED_HUE_RANGES in categorical-palette.ts — kept in the test
// deliberately (not imported, it's not exported), so this asserts the observable contract
// ("auto hues never land here") rather than reaching into the implementation.
const STATUS_EXCLUDED_HUE_RANGES: readonly [number, number][] = [
  [350, 360],
  [0, 40],
  [125, 160],
];

function isInExcludedRange(hue: number): boolean {
  return STATUS_EXCLUDED_HUE_RANGES.some(([start, end]) => hue >= start && hue <= end);
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function hueOf(colorString: string): number {
  const match = colorString.match(/^oklch\([\d.]+ [\d.]+ (-?[\d.]+)\)$/);
  if (!match) throw new Error(`unexpected color string format: ${colorString}`);
  return Number(match[1]);
}

describe('createCategoricalPalette', () => {
  it('returns the same color for the same key on repeated calls', () => {
    const palette = createCategoricalPalette();
    const first = palette.getColor('expenses', colors);
    const second = palette.getColor('expenses', colors);
    expect(second).toBe(first);
  });

  it('never auto-assigns a hue inside a status-excluded range', () => {
    const palette = createCategoricalPalette();
    for (let i = 0; i < 20; i++) {
      const hue = hueOf(palette.getColor(`category-${i}`, colors));
      expect(isInExcludedRange(hue)).toBe(false);
    }
  });

  it('assigns pairwise distinct hues to distinct auto-assigned keys', () => {
    const palette = createCategoricalPalette();
    const hues = Array.from({ length: 10 }, (_, i) => hueOf(palette.getColor(`category-${i}`, colors)));
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('keeps palette instances independent: every one starts from the same first hue', () => {
    const paletteA = createCategoricalPalette();
    const paletteB = createCategoricalPalette();
    const firstOfA = hueOf(paletteA.getColor('a1', colors));
    paletteA.getColor('a2', colors);

    expect(hueOf(paletteB.getColor('b1', colors))).toBe(firstOfA);
  });

  it('applies alpha suffix only when alpha is provided', () => {
    const palette = createCategoricalPalette();
    const opaque = palette.getColor('with-alpha', colors);
    const transparent = palette.getColor('with-alpha', colors, 0.5);
    expect(opaque).not.toContain('/');
    expect(transparent).toBe(`${opaque.slice(0, -1)} / 0.5)`);
  });
});

describe('assignSeriesHues', () => {
  const series = (...entries: [number, number | null][]) => entries.map(([id, hue]) => ({ id, hue }));

  it('keeps a pinned hue exactly, even inside a status-excluded range', () => {
    const hues = assignSeriesHues(series([1, 10], [2, null]));
    expect(hues.get(1)).toBe(10);
  });

  it('gives auto series distinct hues outside status ranges and away from pinned ones', () => {
    const hues = assignSeriesHues(
      series([1, 200], ...Array.from({ length: 12 }, (_, i): [number, null] => [i + 2, null])),
    );
    const autoHues = [...hues.entries()].filter(([id]) => id !== 1).map(([, hue]) => hue);
    expect(new Set(autoHues).size).toBe(autoHues.length);
    for (const hue of autoHues) {
      expect(isInExcludedRange(hue)).toBe(false);
      expect(circularHueDistance(hue, 200)).toBeGreaterThanOrEqual(35);
    }
  });

  it('still terminates and hands out hues when the pins and status bands leave no free hue', () => {
    const pins: [number, number | null][] = [50, 110, 170, 230, 290, 350].map((hue, i) => [i + 1, hue]);
    const hues = assignSeriesHues(series(...pins, [10, null], [11, null]));
    expect(hues.size).toBe(8);
    for (const id of [10, 11]) expect(hues.get(id)).toBeGreaterThanOrEqual(0);
    expect(hues.get(10)).not.toBe(hues.get(11));
  });

  it('does not depend on the input order', () => {
    const forward = assignSeriesHues(series([-2, null], [-1, null], [3, null], [7, 90]));
    const reversed = assignSeriesHues(series([7, 90], [3, null], [-1, null], [-2, null]));
    expect([...forward.entries()].sort()).toEqual([...reversed.entries()].sort());
  });

  it('does not recolor existing series when a series with a higher id is added', () => {
    const before = assignSeriesHues(series([1, null], [2, null], [3, 250]));
    const after = assignSeriesHues(series([1, null], [2, null], [3, 250], [9, null]));
    expect(after.get(1)).toBe(before.get(1));
    expect(after.get(2)).toBe(before.get(2));
  });

  it('formats a hue as an oklch color with optional alpha', () => {
    expect(hueToColor(142, colors)).toMatch(/^oklch\([\d.]+ [\d.]+ 142\.0\)$/);
    expect(hueToColor(142, colors, 0.25)).toMatch(/^oklch\([\d.]+ [\d.]+ 142\.0 \/ 0\.25\)$/);
  });
});
