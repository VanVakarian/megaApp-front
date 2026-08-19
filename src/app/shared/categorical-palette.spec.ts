import type { ChartColors } from '@app/shared/chart-config';
import { createCategoricalPalette } from './categorical-palette';

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

  it('pin() assigns exactly the requested hue, bypassing status exclusion', () => {
    const palette = createCategoricalPalette();
    palette.pin('danger-like', 10); // 10 sits inside the [0,40] status-excluded range
    expect(hueOf(palette.getColor('danger-like', colors))).toBe(10);
  });

  it('keeps auto-assigned hues at least 35deg away from a pinned hue', () => {
    const palette = createCategoricalPalette();
    palette.pin('pinned', 200);
    palette.getColor('pinned', colors);
    for (let i = 0; i < 10; i++) {
      const hue = hueOf(palette.getColor(`auto-${i}`, colors));
      expect(circularHueDistance(hue, 200)).toBeGreaterThanOrEqual(35);
    }
  });

  it('keeps two palette instances independent (a pin in one does not affect the other)', () => {
    const paletteA = createCategoricalPalette();
    const paletteB = createCategoricalPalette();
    paletteA.pin('shared-key', 200);

    const hueAInB = hueOf(paletteB.getColor('shared-key', colors));
    expect(hueAInB).not.toBe(200);
  });

  it('applies alpha suffix only when alpha is provided', () => {
    const palette = createCategoricalPalette();
    const opaque = palette.getColor('with-alpha', colors);
    const transparent = palette.getColor('with-alpha', colors, 0.5);
    expect(opaque).not.toContain('/');
    expect(transparent).toBe(`${opaque.slice(0, -1)} / 0.5)`);
  });
});
