import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { Stats, StatsChartData } from '@app/shared/interfaces';
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
  private static readonly GRANULARITY_WEEK_SWITCH_DAYS = 365;
  private static readonly GRANULARITY_MONTH_SWITCH_YEARS = 4;
  private static readonly GRANULARITY_MONTH_SWITCH_DAYS =
    FoodStatsService.GRANULARITY_MONTH_SWITCH_YEARS * FoodStatsService.DAYS_IN_YEAR;

  private readonly STATS_STORAGE_KEY = 'food_stats';

  private readonly stats$$: WritableSignal<Stats> = signal({});
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

  constructor(
    private http: HttpClient,
    private localStorageService: LocalStorageService,
  ) {
    this.loadStatsFromLocalStorageOnInit();
  }

  @exhaustRequest()
  public async getStats(): Promise<void> {
    const cachedStats = this.loadStatsFromLocalStorage();
    if (cachedStats && Object.keys(cachedStats).length > 0) {
      this.stats$$.set(cachedStats);
    }

    try {
      const serverStats = await firstValueFrom(this.http.get<Stats>('/api/food/stats'));
      const isLocalStatsEmpty = Object.keys(this.stats$$()).length === 0;

      this.stats$$.set(serverStats);
      this.saveStatsToLocalStorage();

      if (isLocalStatsEmpty) {
        this.setupInitialDateRange();
      }
    } catch (error) {
      console.error('Failed fetching stats from server:', error);
    }
  }

  public updateStats(dateIso: string, weightDelta: number, kcalsDelta: number) {
    if (!weightDelta && !kcalsDelta) return;

    const stats = this.stats$$();
    const dateStats = stats[dateIso];

    if (dateStats) {
      this.stats$$.set({
        ...stats,
        [dateIso]: [dateStats[0] + weightDelta, dateStats[1], dateStats[2] + kcalsDelta, dateStats[3]],
      });
    }
  }

  private setupInitialDateRange() {
    setTimeout(() => {
      const totalDaysAvailable = this.statsChartData$$().dates.length;
      if (totalDaysAvailable === 0) return;
      this.selectedDateIdxEnd$$.set(totalDaysAvailable - 1);
      this.clipDateRange(90);
    }, 1);
  }

  private prepareChartData(): StatsChartData {
    const stats = this.stats$$() || {};
    const result: StatsChartData = {
      dates: [],
      weights: [],
      weightsAvg: [],
      kcals: [],
      kcalsTarget: [],
    };

    Object.entries(stats).forEach(([date, values]) => {
      const [weight, weightAvg, kcal, kcalTarget] = values;
      result.dates.push(date);
      result.weights.push(weight);
      result.weightsAvg.push(weightAvg);
      result.kcals.push(kcal);
      result.kcalsTarget.push(kcalTarget);
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
    const kcals = data.kcals.slice(start, end + 1);
    const kcalsTarget = data.kcalsTarget.slice(start, end + 1);

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
      kcals,
      kcalsTarget,
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
    const kcalsSum: number[] = [];
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
        kcalsSum.push(0);
        kcalsCount.push(0);
        kcalsTargetSum.push(0);
        kcalsTargetCount.push(0);
      } else {
        periodEndIdx[groupIndex] = index;
      }

      const weightValue = data.weights[index];
      const weightAvgValue = data.weightsAvg[index];
      const kcalsValue = data.kcals[index];
      const kcalsTargetValue = data.kcalsTarget[index];

      if (weightValue !== undefined && weightValue !== null) {
        weightsSum[groupIndex] += weightValue;
        weightsCount[groupIndex] += 1;
      }
      if (weightAvgValue !== undefined && weightAvgValue !== null) {
        weightsAvgSum[groupIndex] += weightAvgValue;
        weightsAvgCount[groupIndex] += 1;
      }
      if (kcalsValue !== undefined && kcalsValue !== null) {
        kcalsSum[groupIndex] += kcalsValue;
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
      aggregated.kcals.push(kcalsComplete ? kcalsSum[i] / kcalsCount[i] : Number.NaN);
      aggregated.kcalsTarget.push(kcalsTargetComplete ? kcalsTargetSum[i] / kcalsTargetCount[i] : Number.NaN);
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
      kcals: aggregated.data.kcals.slice(startPeriodIdx, endPeriodIdx + 1),
      kcalsTarget: aggregated.data.kcalsTarget.slice(startPeriodIdx, endPeriodIdx + 1),
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
      kcals: [],
      kcalsTarget: [],
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
    this.localStorageService.set(this.STATS_STORAGE_KEY, this.stats$$());
  }

  private loadStatsFromLocalStorage(): Stats | null {
    return this.localStorageService.get<Stats>(this.STATS_STORAGE_KEY);
  }

  private loadStatsFromLocalStorageOnInit(): void {
    const savedStats = this.loadStatsFromLocalStorage();
    if (savedStats && Object.keys(savedStats).length > 0) {
      this.stats$$.set(savedStats);
      this.setupInitialDateRange();
    }
  }

  public createStatsRollback(dateIso: string): () => void {
    const originalStats = { ...this.stats$$() };
    return () => {
      this.stats$$.set(originalStats);
      this.saveStatsToLocalStorage();
    };
  }

  public updateStatsOptimistically(dateIso: string, weightDelta: number, kcalsDelta: number): void {
    this.updateStats(dateIso, weightDelta, kcalsDelta);
    this.saveStatsToLocalStorage();
  }
}
