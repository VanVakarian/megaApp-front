import { HttpClient } from '@angular/common/http';
import { computed, effect, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  BodyWeight,
  DayTotals,
  Diary,
  DiaryEntry,
  DiaryEntryWithFullData,
  ServerResponseWithDiaryId,
  UnifiedDiary,
} from '@app/shared/interfaces';
import { calculateTodayIsoWithUserTimeShift } from '@app/shared/utils';
import { firstValueFrom, Subject } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncOperationType, SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';
import { FoodCatalogueService } from './food-catalogue.service';
import { FoodCoefficientsService } from './food-coefficients.service';
import { FoodStatsService } from './food-stats.service';

@Injectable({
  providedIn: 'root',
})
export class FoodDiaryService extends BaseFoodService {
  private readonly DIARY_STORAGE_KEY = 'food_diary';

  private diaryRaw$$: WritableSignal<Diary> = signal({});
  public diary$$: Signal<UnifiedDiary> = computed(() => this.prepUnifiedDiary());

  public selectedDayIso$$: WritableSignal<string> = signal(calculateTodayIsoWithUserTimeShift());
  public selectedDayTotals$$: Signal<DayTotals> = computed(() => this.extractSelectedDayTotals());

  public diaryEntryClickedFocus$ = new Subject<number>();

  private FETCH_OFFSET = 7;
  private FETCH_THRESHOLD = 3;

  private loadedRange$$: WritableSignal<{ start: string; end: string } | null> = signal(null);
  private fetchMoreDiaryTrigger$ = new Subject<void>();

  protected getStorageKey(): string {
    return this.DIARY_STORAGE_KEY;
  }

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
    private catalogueService: FoodCatalogueService,
    private coefficientsService: FoodCoefficientsService,
    private foodStatsService: FoodStatsService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadDiaryFromLocalStorage();
    this.subscribe();

    effect(() => {
      if (this.shouldLoadMore()) this.fetchMoreDiaryTrigger$.next();
    });

    // effect(() => { console.log('DIARY RAW has been updated:', this.diaryRaw$$()) }); // prettier-ignore
    // effect(() => { console.log('UNIFIED DIARY has been updated:', this.diary$$()) }); // prettier-ignore
  }

  private subscribe(): void {
    this.subscribeToRealtimeUpdates();

    this.fetchMoreDiaryTrigger$.subscribe(() => {
      this.loadMoreData();
    });
  }

  private subscribeToRealtimeUpdates(): void {
    this.networkService.getMessages().subscribe((message) => {
      if (!message?.type) return;

      switch (message.type) {
        case 'DIARY_ENTRY_CREATED':
        case 'DIARY_ENTRY_UPDATED':
          if (message.payload?.dateISO) {
            this.getFoodDiaryFullUpdateRange(message.payload.dateISO, 0);
            this.foodStatsService.getStats();
          }
          break;

        case 'DIARY_ENTRY_DELETED':
          if (message.payload?.id) {
            const entryDate = this.findDateByEntryId(message.payload.id);
            if (entryDate) {
              this.getFoodDiaryFullUpdateRange(entryDate, 0);
              this.foodStatsService.getStats();
            }
          }
          break;

        case 'BODY_WEIGHT_CREATED':
        case 'BODY_WEIGHT_UPDATED':
          if (message.payload?.dateISO) {
            this.getFoodDiaryFullUpdateRange(message.payload.dateISO, 0);
            this.foodStatsService.getStats();
          }
          break;
      }
    });
  }

  private findDateByEntryId(entryId: number): string | null {
    const diary = this.diaryRaw$$();
    for (const [dateISO, day] of Object.entries(diary)) {
      if (day.food[entryId]) {
        return dateISO;
      }
    }
    return null;
  }

  public calculateEntryKcals(entry: DiaryEntry): number {
    const entryWeight = entry.foodWeight / 100;
    const catalogueKcals = this.catalogueService.catalogue$$()[entry.foodCatalogueId]?.kcals ?? 0;
    const coefficient = this.coefficientsService.coefficients$$()[entry.foodCatalogueId] || 1;
    return Math.round(entryWeight * catalogueKcals * coefficient);
  }

  @exhaustRequest()
  public async getFoodDiaryFullUpdateRange(dateIso?: string, offset?: number): Promise<Diary> {
    const date = dateIso ?? calculateTodayIsoWithUserTimeShift();
    const paramsStr = `date=${date}&offset=${offset ?? this.FETCH_OFFSET}`;

    try {
      const response = await firstValueFrom(this.http.get<Diary>(`/api/food/diary-full-update?${paramsStr}`));

      this.diaryRaw$$.update((diary) => ({ ...diary, ...response }));
      this.saveToLocalStorage(this.diaryRaw$$());
      this.updateLoadedRange(date);
      return response;
    } catch (error) {
      console.error('Failed getting diary range:', error);
      return {};
    }
  }

  public async createDiaryEntry(diaryEntry: DiaryEntry): Promise<{ result: boolean; diaryId: number }> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for creating diary entry');
      return { result: false, diaryId: 0 };
    }

    const tempId = Date.now();
    const originalDiary = { ...this.diaryRaw$$() };

    const kcalsDelta = this.calculateEntryKcals(diaryEntry);
    const selectedDay = this.selectedDayIso$$();

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    const entryWithTempId = { ...diaryEntry, id: tempId };

    this.updateDiaryEntryWithNewValues(entryWithTempId);
    this.saveToLocalStorage(this.diaryRaw$$());

    this.foodStatsService.updateStatsOptimistically(selectedDay, 0, kcalsDelta);

    const successCallback = (response: ServerResponseWithDiaryId) => {
      if (response.result && response.diaryId) {
        this.updateDiaryEntryId(tempId, response.diaryId);
      }
    };

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveToLocalStorage(originalDiary);
      statsRollback();
    };

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/food/diary/',
      data: diaryEntry,
      successCallback: successCallback,
      rollbackCallback: rollbackFunction,
    });

    return { result: true, diaryId: tempId };
  }

  public async editDiaryEntry(diaryEntry: DiaryEntry): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for editing diary entry');
      return false;
    }

    const originalDiary = { ...this.diaryRaw$$() };
    const selectedDay = this.selectedDayIso$$();
    const originalEntry = originalDiary[selectedDay]?.food[diaryEntry.id];

    if (!originalEntry) {
      console.error('Cannot edit diary entry: entry not found');
      return false;
    }

    const originalKcals = this.calculateEntryKcals(originalEntry);
    const newKcals = this.calculateEntryKcals(diaryEntry);
    const kcalsDelta = newKcals - originalKcals;

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    this.updateDiaryEntryWithNewValues(diaryEntry);
    this.saveToLocalStorage(this.diaryRaw$$());

    if (kcalsDelta !== 0) {
      this.foodStatsService.updateStatsOptimistically(selectedDay, 0, kcalsDelta);
    }

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveToLocalStorage(originalDiary);
      if (kcalsDelta !== 0) {
        statsRollback();
      }
    };

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/diary',
      data: diaryEntry,
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  public async deleteDiaryEntry(diaryEntryId: number): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for deleting diary entry');
      return false;
    }

    const selectedDay = this.selectedDayIso$$();
    const originalDiary = { ...this.diaryRaw$$() };
    const deletedEntry = originalDiary[selectedDay]?.food[diaryEntryId];

    if (!deletedEntry) {
      console.error('Cannot delete diary entry: entry not found');
      return false;
    }

    const kcalsDelta = -this.calculateEntryKcals(deletedEntry);

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    this.removeDiaryEntry(diaryEntryId);
    this.saveToLocalStorage(this.diaryRaw$$());

    this.foodStatsService.updateStatsOptimistically(selectedDay, 0, kcalsDelta);

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveToLocalStorage(originalDiary);
      statsRollback();
    };

    this.addSyncOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/food/diary/${diaryEntryId}`,
      data: {},
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  public async setUserBodyWeight(bodyWeight: BodyWeight): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for setting body weight');
      return false;
    }

    const originalDiary = { ...this.diaryRaw$$() };
    const dateISO = bodyWeight.dateISO;

    const currentWeight = originalDiary[dateISO]?.bodyWeight || 0;
    const newWeight = Number(bodyWeight.bodyWeight);
    const weightDelta = newWeight - currentWeight;

    const statsRollback = this.foodStatsService.createStatsRollback(dateISO);

    this.diaryRaw$$.update((diary) => {
      return {
        ...diary,
        [dateISO]: {
          ...diary[dateISO],
          bodyWeight: newWeight,
        },
      };
    });
    this.saveToLocalStorage(this.diaryRaw$$());

    if (weightDelta !== 0) {
      this.foodStatsService.updateStatsOptimistically(dateISO, weightDelta, 0);
    }

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveToLocalStorage(originalDiary);
      if (weightDelta !== 0) {
        statsRollback();
      }
    };

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/food/body-weight',
      data: bodyWeight,
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  private prepUnifiedDiary(): UnifiedDiary {
    const rawDiary = this.diaryRaw$$();
    const catalogue = this.catalogueService.catalogue$$();
    const coefficients = this.coefficientsService.coefficients$$();
    const result: UnifiedDiary = {};

    for (const [dateISO, day] of Object.entries(rawDiary)) {
      const foodEntries: DiaryEntryWithFullData[] = [];
      let kcalsEaten = 0;
      let kcalsPercent = 0;

      for (const [id, entry] of Object.entries(day.food)) {
        const kcals = this.calculateEntryKcals(entry);
        const percentage = this.calculatePercentage(kcals, day.targetKcals);

        const formattedEntry: DiaryEntryWithFullData = {
          ...entry,
          foodName: catalogue[entry.foodCatalogueId]?.name || '',
          foodKcals: kcals,
          foodPercent: this.formatPercentage(percentage),
          foodKcalPercentageOfDaysNorm: percentage,
        };

        foodEntries.push(formattedEntry);
        kcalsEaten += kcals;
        kcalsPercent += percentage;
      }

      result[dateISO] = {
        food: foodEntries,
        totals: {
          kcalsEaten,
          kcalsPercent,
          bodyWeight: day.bodyWeight,
          targetKcals: day.targetKcals,
        },
      };
    }

    return result;
  }

  private formatPercentage(percent: number): string {
    return Math.floor(percent) < 100 ? percent.toFixed(1) : Math.round(percent).toString();
  }

  private calculatePercentage(kcals: number, targetKcals: number): number {
    if (targetKcals === 0) return 0;
    return (kcals / targetKcals) * 100;
  }

  private extractSelectedDayTotals(): DayTotals {
    const selectedDay = this.selectedDayIso$$();
    return this.diary$$()[selectedDay]?.totals || { kcalsEaten: 0, kcalsPercent: 0, bodyWeight: null, targetKcals: 0 };
  }

  private updateDiaryEntryWithNewValues(updatedDiaryEntry: DiaryEntry): void {
    this.diaryRaw$$.update((oldDiary) => {
      const selectedDay = this.selectedDayIso$$();
      const updatedDiary = { ...oldDiary };
      const updatedDay = { ...updatedDiary[selectedDay] };
      const updatedFood = { ...updatedDay.food };

      if (!updatedFood[updatedDiaryEntry.id]) {
        updatedFood[updatedDiaryEntry.id] = {
          id: updatedDiaryEntry.id,
          dateISO: selectedDay,
          foodCatalogueId: updatedDiaryEntry.foodCatalogueId,
          foodWeight: updatedDiaryEntry.foodWeight,
          history: [],
        };
      }

      updatedFood[updatedDiaryEntry.id] = {
        ...updatedFood[updatedDiaryEntry.id],
        foodWeight: updatedDiaryEntry.foodWeight,
        history: [...updatedFood[updatedDiaryEntry.id].history, ...updatedDiaryEntry.history],
      };

      updatedDay.food = updatedFood;
      updatedDiary[selectedDay] = updatedDay;
      return updatedDiary;
    });
  }

  private removeDiaryEntry(diaryEntryId: number): void {
    this.diaryRaw$$.update((oldDiary) => {
      const selectedDay = this.selectedDayIso$$();
      const updatedDiary = { ...oldDiary };
      const updatedDay = { ...updatedDiary[selectedDay] };
      const updatedFood = { ...updatedDay.food };

      delete updatedFood[diaryEntryId];

      updatedDay.food = updatedFood;
      updatedDiary[selectedDay] = updatedDay;
      return updatedDiary;
    });
  }

  private updateDiaryEntryId(tempId: number, realId: number): void {
    this.diaryRaw$$.update((oldDiary) => {
      const selectedDay = this.selectedDayIso$$();
      const updatedDiary = { ...oldDiary };
      const updatedDay = { ...updatedDiary[selectedDay] };
      const updatedFood = { ...updatedDay.food };

      if (updatedFood[tempId]) {
        const entry = { ...updatedFood[tempId], id: realId };
        updatedFood[realId] = entry;
        delete updatedFood[tempId];
      }

      updatedDay.food = updatedFood;
      updatedDiary[selectedDay] = updatedDay;
      return updatedDiary;
    });
    this.saveToLocalStorage(this.diaryRaw$$());
  }

  private shouldLoadMore(): boolean {
    const selectedDay = this.selectedDayIso$$();
    const range = this.loadedRange$$();
    if (!range) return true;

    const start = new Date(range.start);
    const end = new Date(range.end);
    const selected = new Date(selectedDay);

    const daysToStart = Math.floor((selected.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysToEnd = Math.floor((end.getTime() - selected.getTime()) / (1000 * 60 * 60 * 24));

    return daysToStart <= this.FETCH_THRESHOLD || daysToEnd <= this.FETCH_THRESHOLD;
  }

  private async loadMoreData(): Promise<void> {
    const selectedDay = this.selectedDayIso$$();
    const loadedRange = this.loadedRange$$();

    let dateToLoad = selectedDay;
    if (loadedRange) {
      const selected = new Date(selectedDay);
      const start = new Date(loadedRange.start);
      const end = new Date(loadedRange.end);

      if (Math.abs(selected.getTime() - start.getTime()) < Math.abs(selected.getTime() - end.getTime())) {
        const newStart = new Date(start);
        newStart.setDate(start.getDate() - this.FETCH_OFFSET);
        dateToLoad = newStart.toISOString().split('T')[0];
      } else {
        const newEnd = new Date(end);
        newEnd.setDate(end.getDate() + this.FETCH_OFFSET);
        dateToLoad = newEnd.toISOString().split('T')[0];
      }
    }

    await this.getFoodDiaryFullUpdateRange(dateToLoad);
  }

  private updateLoadedRange(centerDate: string): void {
    const center = new Date(centerDate);
    const start = new Date(center);
    const end = new Date(center);

    start.setDate(center.getDate() - this.FETCH_OFFSET);
    end.setDate(center.getDate() + this.FETCH_OFFSET);

    const newRange = {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };

    const currentRange = this.loadedRange$$();
    if (!currentRange) {
      this.loadedRange$$.set(newRange);
      return;
    }

    const newStart = new Date(Math.min(new Date(currentRange.start).getTime(), start.getTime()));
    const newEnd = new Date(Math.max(new Date(currentRange.end).getTime(), end.getTime()));

    this.loadedRange$$.set({
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0],
    });
  }

  private loadDiaryFromLocalStorage(): void {
    const savedDiary = this.loadFromLocalStorage<Diary>();
    if (savedDiary) {
      this.diaryRaw$$.set(savedDiary);
    }
  }
}
