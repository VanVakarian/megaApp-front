export const FoodStatsBlock = {
  Ribbon: 'ribbon',
  Streak: 'streak',
  TopProducts: 'topProducts',
  Milestones: 'milestones',
  Charts: 'charts',
} as const;

export type FoodStatsBlock = (typeof FoodStatsBlock)[keyof typeof FoodStatsBlock];

// Fixed order shared by food-stats-columns and food-stats-accordion.
export const FOOD_STATS_BLOCK_ORDER: FoodStatsBlock[] = [
  FoodStatsBlock.Ribbon,
  FoodStatsBlock.Streak,
  FoodStatsBlock.TopProducts,
  FoodStatsBlock.Milestones,
  FoodStatsBlock.Charts,
];
