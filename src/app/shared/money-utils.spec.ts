import { convertAmount } from './money-utils';

describe('convertAmount', () => {
  it('returns amount unchanged when fromTicker === toTicker', () => {
    expect(convertAmount(100, 'EUR', 'EUR', {})).toBe(100);
  });

  it('converts USD to a target currency via its rate', () => {
    expect(convertAmount(100, 'USD', 'EUR', { EUR: 0.5 })).toBe(200);
  });

  it('converts a source currency to USD via its rate', () => {
    expect(convertAmount(100, 'EUR', 'USD', { EUR: 0.5 })).toBe(50);
  });

  it('converts between two non-USD currencies via USD as pivot', () => {
    expect(convertAmount(100, 'EUR', 'GBP', { EUR: 0.5, GBP: 0.25 })).toBe(200);
  });

  it('falls back to the original amount when fromTicker rate is missing', () => {
    expect(convertAmount(100, 'EUR', 'USD', {})).toBe(100);
  });

  it('falls back to the original amount when fromTicker rate is zero or negative', () => {
    expect(convertAmount(100, 'EUR', 'USD', { EUR: 0 })).toBe(100);
    expect(convertAmount(100, 'EUR', 'USD', { EUR: -1 })).toBe(100);
  });

  it('falls back to the USD amount when toTicker rate is missing', () => {
    expect(convertAmount(100, 'USD', 'EUR', {})).toBe(100);
  });

  it('falls back to the USD amount when toTicker rate is zero or negative', () => {
    expect(convertAmount(100, 'USD', 'EUR', { EUR: 0 })).toBe(100);
    expect(convertAmount(100, 'USD', 'EUR', { EUR: -1 })).toBe(100);
  });
});
