export const FoodDayBand = {
  Under: 'under',
  Normal: 'normal',
  SlightOver: 'slightOver',
  Over: 'over',
} as const;

export type FoodDayBand = (typeof FoodDayBand)[keyof typeof FoodDayBand];

const UNDER_MAX_PERCENT = 85;
const NORMAL_MAX_PERCENT = 105;
const SLIGHT_OVER_MAX_PERCENT = 120;

export function resolveFoodDayBand(consumedKcal: number, targetKcal: number): FoodDayBand {
  if (!targetKcal) return FoodDayBand.Normal;
  const percent = (consumedKcal / targetKcal) * 100;
  if (percent < UNDER_MAX_PERCENT) return FoodDayBand.Under;
  if (percent <= NORMAL_MAX_PERCENT) return FoodDayBand.Normal;
  if (percent <= SLIGHT_OVER_MAX_PERCENT) return FoodDayBand.SlightOver;
  return FoodDayBand.Over;
}

export const FOOD_DAY_BAND_COLOR_VAR: Record<FoodDayBand, string> = {
  [FoodDayBand.Under]: 'var(--v-color-text-muted)',
  [FoodDayBand.Normal]: 'var(--v-color-success)',
  [FoodDayBand.SlightOver]: 'var(--v-color-warning)',
  [FoodDayBand.Over]: 'var(--v-color-danger)',
};

export const FOOD_DAY_BAND_LABEL: Record<FoodDayBand, string> = {
  [FoodDayBand.Under]: 'Недобор',
  [FoodDayBand.Normal]: 'В норме',
  [FoodDayBand.SlightOver]: 'Небольшой перебор',
  [FoodDayBand.Over]: 'Сильный перебор',
};

export const FOOD_STREAK_SUCCESS_BAND = FoodDayBand.Normal;
