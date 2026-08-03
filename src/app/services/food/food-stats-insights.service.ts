import { computed, inject, Injectable, Signal } from '@angular/core';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { FOOD_STREAK_SUCCESS_BAND, FoodDayBand, resolveFoodDayBand } from '@app/shared/food-day-band';
import { FoodStatsTopProduct } from '@app/shared/types';
import { dateToIsoNoTimeNoTZ } from '@app/shared/utils';

export interface FoodStatsRibbonDay {
  dateIso: string;
  band: FoodDayBand;
}

export interface FoodStatsStreak {
  current: number;
  record: number;
}

export interface FoodStatsWeightRecord {
  weight: number;
  dateIso: string;
}

export interface FoodStatsCaloricDayRecord {
  kcal: number;
  dateIso: string;
}

export interface FoodStatsStreakRecord {
  length: number;
  dateIso: string;
}

export interface FoodStatsYearAgo {
  dateIso: string;
  weightThen: number;
  weightNow: number;
  deltaKg: number;
}

export interface FoodStatsTopProductShare extends FoodStatsTopProduct {
  sharePercent: number;
}

export interface FoodStatsMilestones {
  yearAgo: FoodStatsYearAgo | null;
  minWeight: FoodStatsWeightRecord | null;
  maxWeight: FoodStatsWeightRecord | null;
  mostCaloricDay: FoodStatsCaloricDayRecord | null;
  bestStreak: FoodStatsStreakRecord | null;
  daysInDiary: number;
  totalEntries: number;
  weightChangeSinceStartKg: number | null;
}

interface DayPoint {
  dateIso: string;
  weight: number;
  consumedKcal: number;
  targetKcal: number;
}

interface StreakStats {
  current: number;
  record: number;
  recordEndDateIso: string | null;
}

const RIBBON_WINDOW_DAYS = 30;
const YEAR_AGO_YEARS = 1;

@Injectable({
  providedIn: 'root',
})
export class FoodStatsInsightsService {
  private readonly foodStatsService = inject(FoodStatsService);

  public readonly totalEntries$$: Signal<number> = this.foodStatsService.totalEntries$$;

  private readonly allDays$$: Signal<DayPoint[]> = computed(() => {
    const data = this.foodStatsService.statsChartData$$();
    return data.dates.map((dateIso, index) => ({
      dateIso,
      weight: data.weights[index],
      consumedKcal: data.kcalsFactual[index],
      targetKcal: data.kcalsTarget[index],
    }));
  });

  // Today is always the last entry (backend always includes it, even with zero consumption) and
  // is excluded everywhere "completed days" are needed — it hasn't finished yet, so its band
  // isn't a fair success/failure verdict.
  private readonly completedDays$$: Signal<DayPoint[]> = computed(() => this.allDays$$().slice(0, -1));

  private readonly ribbonWindowDays$$: Signal<DayPoint[]> = computed(() => this.completedDays$$().slice(-RIBBON_WINDOW_DAYS));

  public readonly ribbon30$$: Signal<FoodStatsRibbonDay[]> = computed(() =>
    this.ribbonWindowDays$$().map((day) => ({
      dateIso: day.dateIso,
      band: resolveFoodDayBand(day.consumedKcal, day.targetKcal),
    })),
  );

  // Same trailing-30-completed-days window the backend used to compute topProducts' absolute
  // kcal — the share percent is a client-side division against that window's total, not against
  // all-time consumption, so it always sums close to 100% across the returned top-5.
  public readonly topProductsWithShare$$: Signal<FoodStatsTopProductShare[]> = computed(() => {
    const products = this.foodStatsService.topProducts$$();
    const windowKcalTotal = this.ribbonWindowDays$$().reduce((sum, day) => sum + day.consumedKcal, 0);
    if (windowKcalTotal <= 0) return products.map((product) => ({ ...product, sharePercent: 0 }));
    return products.map((product) => ({
      ...product,
      sharePercent: this.roundTo((product.kcal / windowKcalTotal) * 100, 0),
    }));
  });

  private readonly streakStats$$: Signal<StreakStats> = computed(() => this.computeStreakStats(this.completedDays$$()));

  public readonly streak$$: Signal<FoodStatsStreak> = computed(() => {
    const stats = this.streakStats$$();
    return { current: stats.current, record: stats.record };
  });

  public readonly milestones$$: Signal<FoodStatsMilestones> = computed(() => {
    const allDays = this.allDays$$();
    const streakStats = this.streakStats$$();
    const weightedDays = allDays.filter((day) => day.weight > 0);
    const caloricDays = allDays.filter((day) => day.consumedKcal > 0);
    const today = allDays.length > 0 ? allDays[allDays.length - 1] : null;
    const firstWeightedDay = weightedDays.length > 0 ? weightedDays[0] : null;

    return {
      yearAgo: this.computeYearAgo(allDays, today),
      minWeight: this.pickWeightRecord(weightedDays, (a, b) => (b.weight < a.weight ? b : a)),
      maxWeight: this.pickWeightRecord(weightedDays, (a, b) => (b.weight > a.weight ? b : a)),
      mostCaloricDay: this.pickCaloricRecord(caloricDays),
      bestStreak:
        streakStats.record > 0 && streakStats.recordEndDateIso
          ? { length: streakStats.record, dateIso: streakStats.recordEndDateIso }
          : null,
      daysInDiary: allDays.length,
      totalEntries: this.foodStatsService.totalEntries$$(),
      weightChangeSinceStartKg:
        today && firstWeightedDay ? this.roundTo(today.weight - firstWeightedDay.weight, 1) : null,
    };
  });

  private computeStreakStats(days: DayPoint[]): StreakStats {
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (resolveFoodDayBand(days[i].consumedKcal, days[i].targetKcal) !== FOOD_STREAK_SUCCESS_BAND) break;
      current++;
    }

    let record = 0;
    let recordEndDateIso: string | null = null;
    let running = 0;
    for (const day of days) {
      if (resolveFoodDayBand(day.consumedKcal, day.targetKcal) !== FOOD_STREAK_SUCCESS_BAND) {
        running = 0;
        continue;
      }
      running++;
      if (running > record) {
        record = running;
        recordEndDateIso = day.dateIso;
      }
    }

    return { current, record, recordEndDateIso };
  }

  private computeYearAgo(allDays: DayPoint[], today: DayPoint | null): FoodStatsYearAgo | null {
    if (!today || today.weight <= 0) return null;
    const yearAgoIso = this.isoMinusYears(today.dateIso, YEAR_AGO_YEARS);
    const match = allDays.find((day) => day.dateIso === yearAgoIso);
    if (!match || match.weight <= 0) return null;

    return {
      dateIso: yearAgoIso,
      weightThen: match.weight,
      weightNow: today.weight,
      deltaKg: this.roundTo(today.weight - match.weight, 1),
    };
  }

  private pickWeightRecord(days: DayPoint[], pick: (a: DayPoint, b: DayPoint) => DayPoint): FoodStatsWeightRecord | null {
    if (days.length === 0) return null;
    const day = days.reduce(pick);
    return { weight: day.weight, dateIso: day.dateIso };
  }

  private pickCaloricRecord(days: DayPoint[]): FoodStatsCaloricDayRecord | null {
    if (days.length === 0) return null;
    const day = days.reduce((a, b) => (b.consumedKcal > a.consumedKcal ? b : a));
    return { kcal: day.consumedKcal, dateIso: day.dateIso };
  }

  private isoMinusYears(dateIso: string, years: number): string {
    const date = new Date(dateIso);
    date.setFullYear(date.getFullYear() - years);
    return dateToIsoNoTimeNoTZ(date);
  }

  private roundTo(value: number, places: number): number {
    const multiplier = Math.pow(10, places);
    return Math.round(value * multiplier) / multiplier;
  }
}
