import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { Stats, StatsChartData } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { formatDateTicks } from '../../shared/utils';
import { LocalStorageService } from '../local-storage.service';

@Injectable({
  providedIn: 'root',
})
export class FoodStatsService {
  private readonly STATS_STORAGE_KEY = 'food_stats';

  private readonly stats$$: WritableSignal<Stats> = signal({});
  public readonly statsChartData$$: Signal<StatsChartData> = computed(() => this.prepareChartData());
  public readonly statsChartDataClipped$$: Signal<StatsChartData> = computed(() => this.prepareChartDataClipped());

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
    setTimeout(() => this.clipDateRange(90), 1);
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

    return {
      dates: data.dates.slice(start, end + 1).map(formatDateTicks),
      weights: data.weights.slice(start, end + 1),
      weightsAvg: data.weightsAvg.slice(start, end + 1),
      kcals: data.kcals.slice(start, end + 1),
      kcalsTarget: data.kcalsTarget.slice(start, end + 1),
    };
  }

  public clipDateRange(daysAmtToShow: number) {
    const totalDaysAvailable = this.statsChartData$$().dates.length;
    const isShowAllDays = daysAmtToShow === -1;
    const hasEnoughDaysForDisplay = totalDaysAvailable > daysAmtToShow;
    const firstDayIndex = isShowAllDays || !hasEnoughDaysForDisplay ? 0 : totalDaysAvailable - daysAmtToShow;

    this.selectedDateIdxStart$$.set(firstDayIndex);
    this.selectedDateIdxEnd$$.set(totalDaysAvailable - 1);
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
