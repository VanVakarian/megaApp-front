import { formatMetricUnitValue } from './metric-units';

describe('formatMetricUnitValue', () => {
  it('returns "0" for non-finite values regardless of unit', () => {
    expect(formatMetricUnitValue('count', NaN)).toBe('0');
    expect(formatMetricUnitValue('count', Infinity)).toBe('0');
  });

  describe('ratio', () => {
    it('formats a fraction as a percentage with 1 decimal', () => {
      expect(formatMetricUnitValue('ratio', 0.5)).toBe('50.0%');
    });
  });

  describe('bytes', () => {
    it('keeps small values in bytes with no decimals', () => {
      expect(formatMetricUnitValue('bytes', 512)).toBe('512 B');
    });

    it('scales up to KiB, with 1 decimal below 10 units', () => {
      expect(formatMetricUnitValue('bytes', 2048)).toBe('2.0 KiB');
    });

    it('shows 1 decimal below 10 units, none at or above 10', () => {
      expect(formatMetricUnitValue('bytes', 1024 * 5)).toBe('5.0 KiB');
      expect(formatMetricUnitValue('bytes', 1024 * 12)).toBe('12 KiB');
    });

    it('caps at the largest unit (TiB) instead of overflowing further', () => {
      expect(formatMetricUnitValue('bytes', 1024 ** 5)).toBe('1024 TiB');
    });
  });

  describe('durationMs', () => {
    it('formats sub-second durations in ms', () => {
      expect(formatMetricUnitValue('durationMs', 500)).toBe('500 мс');
    });

    it('formats durations >= 1s in seconds and ms', () => {
      expect(formatMetricUnitValue('durationMs', 1500)).toBe('1 с 500 мс');
    });

    it('omits the ms part when it is exactly 0', () => {
      expect(formatMetricUnitValue('durationMs', 2000)).toBe('2 с');
    });

    it('preserves the sign for negative durations', () => {
      expect(formatMetricUnitValue('durationMs', -1500)).toBe('-1 с 500 мс');
    });
  });

  describe('humanDuration', () => {
    it('formats minutes only under an hour', () => {
      expect(formatMetricUnitValue('humanDuration', 90)).toBe('1m');
    });

    it('formats hours and minutes under a day', () => {
      expect(formatMetricUnitValue('humanDuration', 3660)).toBe('1h 1m');
    });

    it('formats days and hours at and above a day', () => {
      expect(formatMetricUnitValue('humanDuration', 90000)).toBe('1d 1h');
    });

    it('clamps negative values to 0', () => {
      expect(formatMetricUnitValue('humanDuration', -100)).toBe('0m');
    });
  });

  describe('money', () => {
    it('formats with a $ prefix and 2 decimals', () => {
      expect(formatMetricUnitValue('money', 12.345)).toBe('$12.35');
    });

    it('formats a whole number with trailing zeros', () => {
      expect(formatMetricUnitValue('money', 10)).toBe('$10.00');
    });
  });

  describe('count', () => {
    it('formats an integer with no decimals', () => {
      expect(formatMetricUnitValue('count', 42)).toBe('42');
    });

    it('formats a non-integer with 1 decimal', () => {
      expect(formatMetricUnitValue('count', 42.37)).toBe('42.4');
    });
  });
});
