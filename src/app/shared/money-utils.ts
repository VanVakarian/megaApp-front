export function convertAmount(
  amount: number,
  fromTicker: string,
  toTicker: string,
  rates: Record<string, number>,
): number {
  if (fromTicker === toTicker) return amount;

  let usdAmount: number;
  if (fromTicker === 'USD') {
    usdAmount = amount;
  } else {
    const fromRate = rates[fromTicker];
    if (typeof fromRate !== 'number' || fromRate <= 0) return amount;
    usdAmount = amount * fromRate;
  }

  if (toTicker === 'USD') return usdAmount;

  const toRate = rates[toTicker];
  if (typeof toRate !== 'number' || toRate <= 0) return usdAmount;
  return usdAmount / toRate;
}
