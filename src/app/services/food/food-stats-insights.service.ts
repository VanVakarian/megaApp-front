import { computed, inject, Injectable, Signal } from '@angular/core';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { FoodDayBand, isFoodStreakSuccessBand, resolveFoodDayBand } from '@app/shared/food-day-band';
import { FoodStatsTopProduct } from '@app/shared/types';

export interface FoodStatsRibbonDay {
  dateIso: string;
  band: FoodDayBand;
  hasNoData: boolean;
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
  percent: number;
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
  leastCaloricDay: FoodStatsCaloricDayRecord | null;
  daysInDiary: number;
  totalEntries: number;
  weightChangeSinceStartKg: number | null;
}

interface DayPoint {
  dateIso: string;
  weight: number;
  consumedKcal: number;
  targetKcal: number;
  hasNoData: boolean;
}

interface StreakStats {
  current: number;
  record: number;
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
      hasNoData: data.hasNoData[index],
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
      hasNoData: day.hasNoData,
    })),
  );

  // Share percent divides each product's absolute kcal/weight by the matching window total the
  // backend computed over the same trailing-30-completed-days window (not an all-time total), so
  // it always sums close to 100% across the returned top-10 for whichever metric is active.
  public readonly topProductsByKcalWithShare$$: Signal<FoodStatsTopProductShare[]> = computed(() =>
    this.withSharePercent(
      this.foodStatsService.topProductsByKcal$$(),
      this.foodStatsService.topProductsWindowTotalKcal$$(),
      (product) => product.kcal,
    ),
  );

  public readonly topProductsByWeightWithShare$$: Signal<FoodStatsTopProductShare[]> = computed(() =>
    this.withSharePercent(
      this.foodStatsService.topProductsByWeight$$(),
      this.foodStatsService.topProductsWindowTotalWeight$$(),
      (product) => product.weight,
    ),
  );

  private withSharePercent(
    products: FoodStatsTopProduct[],
    windowTotal: number,
    valueOf: (product: FoodStatsTopProduct) => number,
  ): FoodStatsTopProductShare[] {
    if (windowTotal <= 0) return products.map((product) => ({ ...product, sharePercent: 0 }));
    return products.map((product) => ({
      ...product,
      sharePercent: this.roundTo((valueOf(product) / windowTotal) * 100, 0),
    }));
  }

  private readonly streakStats$$: Signal<StreakStats> = computed(() => this.computeStreakStats(this.completedDays$$()));

  public readonly streak$$: Signal<FoodStatsStreak> = computed(() => {
    const stats = this.streakStats$$();
    return { current: stats.current, record: stats.record };
  });

  public readonly milestones$$: Signal<FoodStatsMilestones> = computed(() => {
    const allDays = this.allDays$$();
    const weightedDays = allDays.filter((day) => day.weight > 0);
    const caloricDays = allDays.filter((day) => day.consumedKcal > 0 && day.targetKcal > 0);
    const today = allDays.length > 0 ? allDays[allDays.length - 1] : null;
    const firstWeightedDay = weightedDays.length > 0 ? weightedDays[0] : null;

    return {
      yearAgo: this.computeYearAgo(allDays, today),
      minWeight: this.pickWeightRecord(weightedDays, (a, b) => (b.weight < a.weight ? b : a)),
      maxWeight: this.pickWeightRecord(weightedDays, (a, b) => (b.weight > a.weight ? b : a)),
      mostCaloricDay: this.pickCaloricRecord(caloricDays, (a, b) => (this.kcalPercent(b) > this.kcalPercent(a) ? b : a)),
      leastCaloricDay: this.pickCaloricRecord(caloricDays, (a, b) => (this.kcalPercent(b) < this.kcalPercent(a) ? b : a)),
      daysInDiary: allDays.length,
      totalEntries: this.foodStatsService.totalEntries$$(),
      weightChangeSinceStartKg:
        today && firstWeightedDay ? this.roundTo(today.weight - firstWeightedDay.weight, 1) : null,
    };
  });

  // A day keeps the streak alive unless it was skipped entirely (no diary entries logged) or the
  // user went over target — being under target still counts, since undereating isn't a failure.
  private isStreakSuccessDay(day: DayPoint): boolean {
    return !day.hasNoData && isFoodStreakSuccessBand(resolveFoodDayBand(day.consumedKcal, day.targetKcal));
  }

  private computeStreakStats(days: DayPoint[]): StreakStats {
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (!this.isStreakSuccessDay(days[i])) break;
      current++;
    }

    let record = 0;
    let running = 0;
    for (const day of days) {
      if (!this.isStreakSuccessDay(day)) {
        running = 0;
        continue;
      }
      running++;
      record = Math.max(record, running);
    }

    return { current, record };
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

  private pickCaloricRecord(
    days: DayPoint[],
    pick: (a: DayPoint, b: DayPoint) => DayPoint,
  ): FoodStatsCaloricDayRecord | null {
    if (days.length === 0) return null;
    const day = days.reduce(pick);
    return { percent: this.roundTo(this.kcalPercent(day), 0), dateIso: day.dateIso };
  }

  private kcalPercent(day: DayPoint): number {
    return (day.consumedKcal / day.targetKcal) * 100;
  }

  // Plain string arithmetic on the "YYYY-MM-DD" key — deliberately avoids new Date(dateIso), which
  // parses date-only strings as UTC midnight and would shift the result by a day for any user
  // whose local timezone is behind UTC once read back through local getters.
  private isoMinusYears(dateIso: string, years: number): string {
    const year = Number(dateIso.slice(0, 4)) - years;
    return `${year}${dateIso.slice(4)}`;
  }

  private roundTo(value: number, places: number): number {
    const multiplier = Math.pow(10, places);
    return Math.round(value * multiplier) / multiplier;
  }
}
