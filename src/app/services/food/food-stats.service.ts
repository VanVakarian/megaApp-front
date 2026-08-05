import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { DayStats, FoodStatsResponse, FoodStatsTopProduct, Stats, StatsChartData } from '@app/shared/types';
import { firstValueFrom } from 'rxjs';
import { dateToIsoNoTimeNoTZ, formatDateTicks } from '../../shared/utils';
import { LocalStorageService } from '../local-storage.service';

interface AggregatedPeriodData {
  data: StatsChartData;
  periodStartIdx: number[];
  periodEndIdx: number[];
}

@Injectable({
  providedIn: 'root',
})
export class FoodStatsService {
  private static readonly DAYS_IN_YEAR = 365;
  private static readonly GRANULARITY_WEEK_SWITCH_DAYS = 370;
  private static readonly GRANULARITY_MONTH_SWITCH_YEARS = 4;
  private static readonly GRANULARITY_MONTH_SWITCH_DAYS =
    FoodStatsService.GRANULARITY_MONTH_SWITCH_YEARS * FoodStatsService.DAYS_IN_YEAR;

  private readonly STATS_STORAGE_KEY = 'food_stats';
  private readonly SLIDER_KEY = 'food_stats_slider';

  private readonly stats$$: WritableSignal<Stats> = signal({});
  private readonly topProductsByKcalSignal$$: WritableSignal<FoodStatsTopProduct[]> = signal([]);
  private readonly topProductsByWeightSignal$$: WritableSignal<FoodStatsTopProduct[]> = signal([]);
  private readonly topProductsWindowTotalKcalSignal$$: WritableSignal<number> = signal(0);
  private readonly topProductsWindowTotalWeightSignal$$: WritableSignal<number> = signal(0);
  private readonly totalEntriesSignal$$: WritableSignal<number> = signal(0);
  public readonly topProductsByKcal$$: Signal<FoodStatsTopProduct[]> = this.topProductsByKcalSignal$$.asReadonly();
  public readonly topProductsByWeight$$: Signal<FoodStatsTopProduct[]> = this.topProductsByWeightSignal$$.asReadonly();
  public readonly topProductsWindowTotalKcal$$: Signal<number> = this.topProductsWindowTotalKcalSignal$$.asReadonly();
  public readonly topProductsWindowTotalWeight$$: Signal<number> = this.topProductsWindowTotalWeightSignal$$.asReadonly();
  public readonly totalEntries$$: Signal<number> = this.totalEntriesSignal$$.asReadonly();
  public readonly statsChartData$$: Signal<StatsChartData> = computed(() => this.prepareChartData());
  public readonly statsChartDataClipped$$: Signal<StatsChartData> = computed(() => this.prepareChartDataClipped());

  private readonly weeklyAggregated$$: Signal<AggregatedPeriodData> = computed(() =>
    this.prepareAggregatedData('week'),
  );
  private readonly monthlyAggregated$$: Signal<AggregatedPeriodData> = computed(() =>
    this.prepareAggregatedData('month'),
  );

  public readonly selectedDateIdxStart$$: WritableSignal<number> = signal(0);
  public readonly selectedDateIdxEnd$$: WritableSignal<number> = signal(0);

  private readonly authService = inject(AuthService);

  private readonly resetOnAuthLossEffect$$ = effect(() => {
    if (this.authService.sessionState$$() === AuthSessionState.Guest) {
      this.reset();
    }
  });

  constructor(
    private http: HttpClient,
    private localStorageService: LocalStorageService,
  ) {
    this.loadStatsFromLocalStorageOnInit();
  }

  public reset(): void {
    this.stats$$.set({});
    this.topProductsByKcalSignal$$.set([]);
    this.topProductsByWeightSignal$$.set([]);
    this.topProductsWindowTotalKcalSignal$$.set(0);
    this.topProductsWindowTotalWeightSignal$$.set(0);
    this.totalEntriesSignal$$.set(0);
    this.selectedDateIdxStart$$.set(0);
    this.selectedDateIdxEnd$$.set(0);
  }

  @exhaustRequest()
  public async getStats(): Promise<void> {
    const cachedResponse = this.loadStatsFromLocalStorage();
    if (cachedResponse && Object.keys(cachedResponse.days).length > 0) {
      this.applyResponse(cachedResponse);
    }

    try {
      const serverResponse = await firstValueFrom(this.http.get<FoodStatsResponse>('/api/food/stats'));
      const isLocalStatsEmpty = Object.keys(this.stats$$()).length === 0;

      this.applyResponse(serverResponse);
      this.saveStatsToLocalStorage();

      this.applyDateRangeOnLoad(isLocalStatsEmpty);
    } catch (error) {
      console.error('Failed fetching stats from server:', error);
    }
  }

  // response.topProducts* may be missing on a stale pre-migration localStorage cache — the ?? [] /
  // ?? 0 fallbacks keep loadStatsFromLocalStorageOnInit() from setting signals to undefined.
  private applyResponse(response: FoodStatsResponse): void {
    this.stats$$.set(response.days);
    this.topProductsByKcalSignal$$.set(response.topProductsByKcal ?? []);
    this.topProductsByWeightSignal$$.set(response.topProductsByWeight ?? []);
    this.topProductsWindowTotalKcalSignal$$.set(response.topProductsWindowTotalKcal ?? 0);
    this.topProductsWindowTotalWeightSignal$$.set(response.topProductsWindowTotalWeight ?? 0);
    this.totalEntriesSignal$$.set(response.totalEntries);
  }

  public updateStats(dateIso: string, newWeight: number | null, kcalsDelta: number) {
    if (newWeight === null && !kcalsDelta) return;

    const stats = this.stats$$();
    const dateStats = stats[dateIso] ?? this.buildFallbackDayStats(stats, dateIso);

    this.stats$$.set({
      ...stats,
      [dateIso]: {
        ...dateStats,
        weight: newWeight === null ? dateStats.weight : newWeight,
        consumedKcal: dateStats.consumedKcal + kcalsDelta,
        hasNoData: kcalsDelta !== 0 ? false : dateStats.hasNoData,
      },
    });
  }

  // A new day (typically today) may not exist yet in stats$$ — it only gets added by a full
  // getStats() fetch from the server. Without this fallback, an optimistic update for such a
  // day silently no-ops, and the point only appears after the next full refresh. Carry values
  // forward from the nearest known day at or before dateIso (never a later one, since that would
  // show a not-yet-reached day's target/average on an earlier date). NaN when no such day exists
  // at all (brand new user) so the chart shows a gap instead of a fake zero.
  private buildFallbackDayStats(stats: Stats, dateIso: string): DayStats {
    const priorDates = Object.keys(stats)
      .filter((date) => date <= dateIso)
      .sort();
    const nearestKnown = priorDates.length ? stats[priorDates[priorDates.length - 1]] : null;

    return {
      weight: nearestKnown?.weight ?? Number.NaN,
      weightAvg: nearestKnown?.weightAvg ?? Number.NaN,
      consumedKcal: 0,
      targetKcal: nearestKnown?.targetKcal ?? Number.NaN,
      hasNoData: true,
    };
  }

  private applyDateRangeOnLoad(useDefaultIfNoSaved: boolean): void {
    setTimeout(() => {
      if (this.tryRestoreSavedDateRange()) return;
      if (!useDefaultIfNoSaved) return;
      const total = this.statsChartData$$().dates.length;
      if (total === 0) return;
      this.selectedDateIdxEnd$$.set(total - 1);
      this.clipDateRange(90);
    }, 1);
  }

  public saveDateRange(startIdx: number, endIdx: number): void {
    const dates = this.statsChartData$$().dates;
    const maxIdx = dates.length - 1;
    if (maxIdx < 0) return;
    const startVal = startIdx === 0 ? 'first' : (dates[startIdx] ?? 'first');
    const endVal = endIdx >= maxIdx ? 'last' : (dates[endIdx] ?? 'last');
    this.localStorageService.setUserScoped(this.SLIDER_KEY, { start: startVal, end: endVal });
  }

  private tryRestoreSavedDateRange(): boolean {
    const saved = this.localStorageService.getUserScoped<{ start: string; end: string }>(this.SLIDER_KEY);
    if (!saved) return false;
    const dates = this.statsChartData$$().dates;
    const maxIdx = dates.length - 1;
    if (maxIdx < 0) return false;
    const startIdx = saved.start === 'first' ? 0 : Math.max(0, dates.indexOf(saved.start));
    const rawEndIdx = saved.end === 'last' ? maxIdx : dates.indexOf(saved.end);
    const endIdx = rawEndIdx === -1 ? maxIdx : rawEndIdx;
    if (startIdx >= endIdx) return false;
    this.selectedDateIdxStart$$.set(startIdx);
    this.selectedDateIdxEnd$$.set(endIdx);
    return true;
  }

  private prepareChartData(): StatsChartData {
    const stats = this.stats$$() || {};
    const result: StatsChartData = {
      dates: [],
      weights: [],
      weightsAvg: [],
      kcalsFactual: [],
      kcalsVirtual: [],
      kcalsTarget: [],
      hasNoData: [],
    };

    Object.entries(stats).forEach(([date, dayStats]) => {
      const { weight, weightAvg, consumedKcal, targetKcal, hasNoData } = dayStats;
      const hasKcal = consumedKcal !== undefined && consumedKcal !== null;
      result.dates.push(date);
      result.weights.push(weight);
      result.weightsAvg.push(weightAvg);
      result.kcalsFactual.push(!hasKcal ? Number.NaN : consumedKcal);
      // No imputation is done for missing days — this series is currently always zero.
      result.kcalsVirtual.push(!hasKcal ? Number.NaN : 0);
      result.kcalsTarget.push(targetKcal);
      result.hasNoData.push(hasNoData);
    });

    return result;
  }

  private prepareChartDataClipped(): StatsChartData {
    const data = this.statsChartData$$();
    const start = this.selectedDateIdxStart$$();
    const end = this.selectedDateIdxEnd$$();

    const dates = data.dates.slice(start, end + 1);
    const weights = data.weights.slice(start, end + 1);
    const weightsAvg = data.weightsAvg.slice(start, end + 1);
    const kcalsFactual = data.kcalsFactual.slice(start, end + 1);
    const kcalsVirtual = data.kcalsVirtual.slice(start, end + 1);
    const kcalsTarget = data.kcalsTarget.slice(start, end + 1);
    const hasNoData = data.hasNoData.slice(start, end + 1);

    const daysCount = dates.length;
    const granularity = this.resolveGranularity(daysCount);

    if (granularity === 'week') {
      return this.sliceAggregatedData(this.weeklyAggregated$$(), start, end, true);
    }

    if (granularity === 'month') {
      return this.sliceAggregatedData(this.monthlyAggregated$$(), start, end, true);
    }

    return {
      dates: dates.map(formatDateTicks),
      weights,
      weightsAvg,
      kcalsFactual,
      kcalsVirtual,
      kcalsTarget,
      hasNoData,
    };
  }

  private resolveGranularity(daysCount: number): 'day' | 'week' | 'month' {
    if (daysCount > FoodStatsService.GRANULARITY_MONTH_SWITCH_DAYS) return 'month';
    if (daysCount > FoodStatsService.GRANULARITY_WEEK_SWITCH_DAYS - 7) return 'week';
    return 'day';
  }

  private prepareAggregatedData(period: 'week' | 'month'): AggregatedPeriodData {
    const data = this.statsChartData$$();
    if (data.dates.length === 0) {
      return { data: this.createEmptyChartData(), periodStartIdx: [], periodEndIdx: [] };
    }

    const periodStartIsos: string[] = [];
    const periodStartIdx: number[] = [];
    const periodEndIdx: number[] = [];
    const expectedDays: number[] = [];
    const weightsSum: number[] = [];
    const weightsCount: number[] = [];
    const weightsAvgSum: number[] = [];
    const weightsAvgCount: number[] = [];
    const kcalsFactualSum: number[] = [];
    const kcalsVirtualSum: number[] = [];
    const kcalsCount: number[] = [];
    const kcalsTargetSum: number[] = [];
    const kcalsTargetCount: number[] = [];

    let lastPeriodStartIso = '';
    let groupIndex = -1;

    data.dates.forEach((dateIso, index) => {
      const periodStartIso = period === 'week' ? this.getWeekStartIso(dateIso) : this.getMonthStartIso(dateIso);
      const isNewPeriod = periodStartIso !== lastPeriodStartIso;

      if (isNewPeriod) {
        lastPeriodStartIso = periodStartIso;
        groupIndex += 1;
        periodStartIsos.push(periodStartIso);
        periodStartIdx.push(index);
        periodEndIdx.push(index);
        expectedDays.push(period === 'week' ? 7 : this.getMonthDaysCount(periodStartIso));
        weightsSum.push(0);
        weightsCount.push(0);
        weightsAvgSum.push(0);
        weightsAvgCount.push(0);
        kcalsFactualSum.push(0);
        kcalsVirtualSum.push(0);
        kcalsCount.push(0);
        kcalsTargetSum.push(0);
        kcalsTargetCount.push(0);
      } else {
        periodEndIdx[groupIndex] = index;
      }

      const weightValue = data.weights[index];
      const weightAvgValue = data.weightsAvg[index];
      const kcalsFactualValue = data.kcalsFactual[index];
      const kcalsVirtualValue = data.kcalsVirtual[index];
      const kcalsTargetValue = data.kcalsTarget[index];
      const hasFactualKcal =
        kcalsFactualValue !== undefined && kcalsFactualValue !== null && !Number.isNaN(kcalsFactualValue);
      const hasVirtualKcal =
        kcalsVirtualValue !== undefined && kcalsVirtualValue !== null && !Number.isNaN(kcalsVirtualValue);

      if (weightValue !== undefined && weightValue !== null) {
        weightsSum[groupIndex] += weightValue;
        weightsCount[groupIndex] += 1;
      }
      if (weightAvgValue !== undefined && weightAvgValue !== null) {
        weightsAvgSum[groupIndex] += weightAvgValue;
        weightsAvgCount[groupIndex] += 1;
      }
      if (hasFactualKcal || hasVirtualKcal) {
        kcalsFactualSum[groupIndex] += hasFactualKcal ? kcalsFactualValue : 0;
        kcalsVirtualSum[groupIndex] += hasVirtualKcal ? kcalsVirtualValue : 0;
        kcalsCount[groupIndex] += 1;
      }
      if (kcalsTargetValue !== undefined && kcalsTargetValue !== null) {
        kcalsTargetSum[groupIndex] += kcalsTargetValue;
        kcalsTargetCount[groupIndex] += 1;
      }
    });

    const aggregated = this.createEmptyChartData();
    const aggregatedStartIdx: number[] = [];
    const aggregatedEndIdx: number[] = [];

    for (let i = 0; i <= groupIndex; i += 1) {
      const weightsComplete = weightsCount[i] === expectedDays[i];
      const weightsAvgComplete = weightsAvgCount[i] === expectedDays[i];
      const kcalsComplete = kcalsCount[i] === expectedDays[i];
      const kcalsTargetComplete = kcalsTargetCount[i] === expectedDays[i];
      const hasAnyCompleteSeries = weightsComplete || weightsAvgComplete || kcalsComplete || kcalsTargetComplete;

      if (!hasAnyCompleteSeries) continue;

      aggregated.dates.push(formatDateTicks(periodStartIsos[i]));
      aggregated.weights.push(weightsComplete ? weightsSum[i] / weightsCount[i] : Number.NaN);
      aggregated.weightsAvg.push(weightsAvgComplete ? weightsAvgSum[i] / weightsAvgCount[i] : Number.NaN);
      aggregated.kcalsFactual.push(kcalsComplete ? kcalsFactualSum[i] / kcalsCount[i] : Number.NaN);
      aggregated.kcalsVirtual.push(kcalsComplete ? kcalsVirtualSum[i] / kcalsCount[i] : Number.NaN);
      aggregated.kcalsTarget.push(kcalsTargetComplete ? kcalsTargetSum[i] / kcalsTargetCount[i] : Number.NaN);
      // Not meaningful at week/month granularity — only the daily series feeds the streak calendar.
      aggregated.hasNoData.push(false);
      aggregatedStartIdx.push(periodStartIdx[i]);
      aggregatedEndIdx.push(periodEndIdx[i]);
    }

    return {
      data: aggregated,
      periodStartIdx: aggregatedStartIdx,
      periodEndIdx: aggregatedEndIdx,
    };
  }

  private sliceAggregatedData(
    aggregated: AggregatedPeriodData,
    startDayIdx: number,
    endDayIdx: number,
    hideWeights: boolean,
  ): StatsChartData {
    const startPeriodIdx = this.findFirstIndexGte(aggregated.periodStartIdx, startDayIdx);
    const endPeriodIdx = this.findLastIndexLte(aggregated.periodEndIdx, endDayIdx);

    if (startPeriodIdx > endPeriodIdx) return this.createEmptyChartData();

    const sliced: StatsChartData = {
      dates: aggregated.data.dates.slice(startPeriodIdx, endPeriodIdx + 1),
      weights: aggregated.data.weights.slice(startPeriodIdx, endPeriodIdx + 1),
      weightsAvg: aggregated.data.weightsAvg.slice(startPeriodIdx, endPeriodIdx + 1),
      kcalsFactual: aggregated.data.kcalsFactual.slice(startPeriodIdx, endPeriodIdx + 1),
      kcalsVirtual: aggregated.data.kcalsVirtual.slice(startPeriodIdx, endPeriodIdx + 1),
      kcalsTarget: aggregated.data.kcalsTarget.slice(startPeriodIdx, endPeriodIdx + 1),
      hasNoData: aggregated.data.hasNoData.slice(startPeriodIdx, endPeriodIdx + 1),
    };

    if (!hideWeights) return sliced;

    return {
      ...sliced,
      weights: sliced.weights.map(() => Number.NaN),
    };
  }

  private findFirstIndexGte(arr: number[], value: number): number {
    let left = 0;
    let right = arr.length - 1;
    let result = arr.length;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] >= value) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result;
  }

  private findLastIndexLte(arr: number[], value: number): number {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] <= value) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  private getWeekStartIso(dateIso: string): string {
    const date = new Date(dateIso);
    const day = date.getDay();
    const diff = (day + 6) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - diff);
    return dateToIsoNoTimeNoTZ(weekStart);
  }

  private getMonthStartIso(dateIso: string): string {
    const date = new Date(dateIso);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    return dateToIsoNoTimeNoTZ(monthStart);
  }

  private getMonthDaysCount(periodStartIso: string): number {
    const date = new Date(periodStartIso);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private createEmptyChartData(): StatsChartData {
    return {
      dates: [],
      weights: [],
      weightsAvg: [],
      kcalsFactual: [],
      kcalsVirtual: [],
      kcalsTarget: [],
      hasNoData: [],
    };
  }

  public clipDateRange(daysAmtToShow: number) {
    const [start, end] = this.getClipRange(daysAmtToShow);
    this.selectedDateIdxStart$$.set(start);
    this.selectedDateIdxEnd$$.set(end);
  }

  public getClipRange(daysAmtToShow: number): [number, number] {
    const totalDaysAvailable = this.statsChartData$$().dates.length;
    const isShowAllDays = daysAmtToShow === -1;
    const hasEnoughDaysForDisplay = totalDaysAvailable > daysAmtToShow;
    const lastDayIndex = totalDaysAvailable - 1;

    if (totalDaysAvailable === 0) {
      return [0, 0];
    }

    if (isShowAllDays || !hasEnoughDaysForDisplay) {
      return [0, lastDayIndex];
    }

    const currentEnd = this.selectedDateIdxEnd$$();
    const boundedEnd = currentEnd < 0 || currentEnd > lastDayIndex ? lastDayIndex : currentEnd;
    const desiredLength = daysAmtToShow;
    const desiredStart = boundedEnd - desiredLength + 1;

    if (desiredStart >= 0) {
      return [desiredStart, boundedEnd];
    }

    const missingLeft = Math.abs(desiredStart);
    const shiftedEnd = Math.min(lastDayIndex, boundedEnd + missingLeft);
    return [0, shiftedEnd];
  }

  private saveStatsToLocalStorage(): void {
    const response: FoodStatsResponse = {
      days: this.stats$$(),
      topProductsByKcal: this.topProductsByKcalSignal$$(),
      topProductsByWeight: this.topProductsByWeightSignal$$(),
      topProductsWindowTotalKcal: this.topProductsWindowTotalKcalSignal$$(),
      topProductsWindowTotalWeight: this.topProductsWindowTotalWeightSignal$$(),
      totalEntries: this.totalEntriesSignal$$(),
    };
    this.localStorageService.setUserScoped(this.STATS_STORAGE_KEY, response);
  }

  private loadStatsFromLocalStorage(): FoodStatsResponse | null {
    const saved = this.localStorageService.getUserScoped<FoodStatsResponse>(this.STATS_STORAGE_KEY);
    // Stale cache from before the {days, topProducts, totalEntries} envelope was introduced —
    // saved.days would be undefined and crash Object.keys() downstream. Treat as no cache.
    if (!saved || typeof saved.days !== 'object' || saved.days === null) return null;
    return saved;
  }

  private loadStatsFromLocalStorageOnInit(): void {
    const savedResponse = this.loadStatsFromLocalStorage();
    if (savedResponse && Object.keys(savedResponse.days).length > 0) {
      this.applyResponse(savedResponse);
      this.applyDateRangeOnLoad(true);
    }
  }

  public createStatsRollback(dateIso: string): () => void {
    const originalStats = { ...this.stats$$() };
    return () => {
      this.stats$$.set(originalStats);
      this.saveStatsToLocalStorage();
    };
  }

  public updateStatsOptimistically(dateIso: string, newWeight: number | null, kcalsDelta: number): void {
    this.updateStats(dateIso, newWeight, kcalsDelta);
    this.saveStatsToLocalStorage();
  }
}
