import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';

import { Stats, StatsChartData } from '@app/shared/interfaces';
import { formatDateTicks } from '../shared/utils';

@Injectable({
  providedIn: 'root',
})
export class FoodStatsService {
  public stats$$: WritableSignal<Stats> = signal({});
  public statsChartData$$: Signal<StatsChartData> = computed(() => this.prepareChartData());
  public StatsChartDataClipped$$: Signal<StatsChartData> = computed(() => this.prepareChartDataClipped());

  public forceUpdateTrigger$$ = signal(0);

  public selectedDateIdxStart$$: WritableSignal<number> = signal(-1);
  public selectedDateIdxEnd$$: WritableSignal<number> = signal(Infinity);

  constructor(private http: HttpClient) {
    // effect(() => { console.log('STATS has been updated:', this.stats$$(), Object.keys(this.stats$$()).length) }); // prettier-ignore
    // effect(() => { console.log('STATS CHART DATA has been updated:', this.statsChartData$$(), Object.keys(this.statsChartData$$()).length) }); // prettier-ignore
    // effect(() => { console.log('STATS CHART DATA SLICED has been updated:', this.StatsChartDataClipped$$(), Object.keys(this.StatsChartDataClipped$$()).length) }); // prettier-ignore
    // effect(() => { console.log('SELECTED DATE IDX LOW has been updated:', this.selectedDateIdxStart$$()) }); // prettier-ignore
    // effect(() => { console.log('SELECTED DATE IDX HIGH has been updated:', this.selectedDateIdxEnd$$()) }); // prettier-ignore
  }

  public getStats(): Observable<Stats> {
    return this.http.get<Stats>('/api/food/stats').pipe(
      tap((statsData: Stats) => {
        this.setupInitialData(statsData);
      }),
      catchError((error) => {
        console.error('Failed fetching stats:', error);
        return of({});
      }),
    );
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

  private setupInitialData(statsData: Stats) {
    this.stats$$.set(statsData);
    setTimeout(() => {
      this.clipDateRange(91);
    }, 0);
    setTimeout(() => {
      this.clipDateRange(90);
    }, 0);
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
}
