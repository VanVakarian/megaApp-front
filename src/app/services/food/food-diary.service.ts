import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  BodyWeightInterface,
  BodyWeightToUpdate,
  DayTotals,
  Diary,
  DiaryEntry,
  DiaryEntryToCreate,
  DiaryEntryToDelete,
  DiaryEntryToUpdate,
  DiaryEntryWithFullData,
  HistoryEntry,
  IncomingWsMessage,
  NutrientDelta,
  ServerResponseWithDiaryId,
  UnifiedDiary,
  UserDataLastModifiedTs,
  WebSocketMessageType,
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

const DEFAULT_NUTRIENTS = {
  targetKcals: 2000,
  targetProtein: 0,
  targetFat: 0,
  targetCarbs: 0,
  targetFiber: 0,
  consumedKcals: 0,
  consumedProtein: 0,
  consumedFat: 0,
  consumedCarbs: 0,
  consumedFiber: 0,
};

@Injectable({
  providedIn: 'root',
})
export class FoodDiaryService extends BaseFoodService {
  private readonly diaryRaw$$: WritableSignal<Diary> = signal({});

  public readonly diary$$: Signal<UnifiedDiary> = computed(() => this.prepUnifiedDiary());

  public readonly selectedDayIso$$: WritableSignal<string> = signal(calculateTodayIsoWithUserTimeShift());
  public readonly selectedDayTotals$$: Signal<DayTotals> = computed(() => this.extractSelectedDayTotals());

  public readonly diaryEntryFocusId$$: WritableSignal<number | null> = signal(null);
  public readonly diaryEntryResetId$$: WritableSignal<number | null> = signal(null);

  private readonly DIARY_STORAGE_KEY = 'food_diary';
  private readonly FETCH_OFFSET = 7;
  private readonly FETCH_THRESHOLD = 3;
  private readonly loadedRange$$: WritableSignal<{ start: string; end: string } | null> = signal(null);
  private readonly fetchMoreDiaryTrigger$ = new Subject<void>();

  private lastSyncTs = 0;

  protected getStorageKey(): string {
    return this.DIARY_STORAGE_KEY;
  }

  private readonly catalogueService = inject(FoodCatalogueService);
  private readonly coefficientsService = inject(FoodCoefficientsService);
  private readonly foodStatsService = inject(FoodStatsService);

  private readonly loadMoreDiaryEffect$$ = effect(() => {
    if (this.shouldLoadMore()) this.fetchMoreDiaryTrigger$.next();
  });

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadDiaryFromLocalStorage();
    this.subscribe();
  }

  public calculateEntryKcals(entry: DiaryEntry): number {
    const entryWeight = entry.foodWeight / 100;
    const catalogueKcals = this.catalogueService.catalogue$$()[entry.foodCatalogueId]?.kcals ?? 0;
    const coefficient = this.coefficientsService.coefficients$$()[entry.foodCatalogueId] || 1;
    return Math.round(entryWeight * catalogueKcals * coefficient);
  }

  public focusDiaryEntry(diaryEntryId: number): void {
    this.diaryEntryFocusId$$.set(diaryEntryId);
    setTimeout(() => this.diaryEntryFocusId$$.set(null), 100); // clearing the signal after a short delay
  }

  public resetDiaryEntryForm(diaryEntryId: number): void {
    this.diaryEntryResetId$$.set(diaryEntryId);
    setTimeout(() => this.diaryEntryResetId$$.set(null), 100); // clearing the signal after a short delay
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
    const nutrientsDelta = this.calculateEntryNutrients(diaryEntry);

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    const entryWithTempId = { ...diaryEntry, id: tempId };

    this.updateDiaryEntryWithNewValues(entryWithTempId);
    this.updateNutrientsOptimistically(selectedDay, nutrientsDelta, kcalsDelta);
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

    const originalNutrients = this.calculateEntryNutrients(originalEntry);
    const newNutrients = this.calculateEntryNutrients(diaryEntry);
    const nutrientsDelta: NutrientDelta = {
      protein: newNutrients.protein - originalNutrients.protein,
      fat: newNutrients.fat - originalNutrients.fat,
      carbs: newNutrients.carbs - originalNutrients.carbs,
      fiber: newNutrients.fiber - originalNutrients.fiber,
    };

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    this.updateDiaryEntryWithNewValues(diaryEntry);
    this.updateNutrientsOptimistically(selectedDay, nutrientsDelta, kcalsDelta);
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

    const deletedNutrients = this.calculateEntryNutrients(deletedEntry);
    const nutrientsDelta: NutrientDelta = {
      protein: -deletedNutrients.protein,
      fat: -deletedNutrients.fat,
      carbs: -deletedNutrients.carbs,
      fiber: -deletedNutrients.fiber,
    };

    const statsRollback = this.foodStatsService.createStatsRollback(selectedDay);

    this.removeDiaryEntry(diaryEntryId);
    this.updateNutrientsOptimistically(selectedDay, nutrientsDelta, kcalsDelta);
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

  private calculateEntryNutrients(entry: DiaryEntry): NutrientDelta {
    const portionMultiplier = entry.foodWeight / 100;
    const product = this.catalogueService.catalogue$$()[entry.foodCatalogueId];

    return {
      protein: Math.round((product?.protein || 0) * portionMultiplier),
      fat: Math.round((product?.fat || 0) * portionMultiplier),
      carbs: Math.round((product?.carbs || 0) * portionMultiplier),
      fiber: Math.round((product?.fiber || 0) * portionMultiplier),
    };
  }

  public async setUserBodyWeight(bodyWeight: BodyWeightInterface): Promise<boolean> {
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

  private subscribe(): void {
    this.subscribeToRealtimeUpdates();

    this.fetchMoreDiaryTrigger$.subscribe(() => {
      this.loadMoreData();
    });
  }

  private prepUnifiedDiary(): UnifiedDiary {
    const rawDiary = this.diaryRaw$$();
    const catalogue = this.catalogueService.catalogue$$();
    const result: UnifiedDiary = {};

    for (const [dateISO, day] of Object.entries(rawDiary)) {
      const foodEntries: DiaryEntryWithFullData[] = [];

      const targetKcals = day.nutrients?.targetKcals || 2000;
      const consumedKcals = day.nutrients?.consumedKcals || 0;
      const kcalsPercent = this.calculatePercentage(consumedKcals, targetKcals);

      for (const [id, entry] of Object.entries(day.food)) {
        const kcals = this.calculateEntryKcals(entry);
        const percentage = this.calculatePercentage(kcals, targetKcals);

        const formattedEntry: DiaryEntryWithFullData = {
          ...entry,
          foodName: catalogue[entry.foodCatalogueId]?.name || '',
          foodKcals: kcals,
          foodPercent: this.formatPercentage(percentage),
          foodKcalPercentageOfDaysNorm: percentage,
        };

        foodEntries.push(formattedEntry);
      }

      result[dateISO] = {
        food: foodEntries,
        totals: {
          kcalsConsumed: consumedKcals,
          kcalsPercent,
          bodyWeight: day.bodyWeight,
          targetKcals,
          targetProtein: day.nutrients?.targetProtein || 0,
          targetFat: day.nutrients?.targetFat || 0,
          targetCarbs: day.nutrients?.targetCarbs || 0,
          targetFiber: day.nutrients?.targetFiber || 0,
          consumedProtein: day.nutrients?.consumedProtein || 0,
          consumedFat: day.nutrients?.consumedFat || 0,
          consumedCarbs: day.nutrients?.consumedCarbs || 0,
          consumedFiber: day.nutrients?.consumedFiber || 0,
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
    const defaultTotals: DayTotals = {
      kcalsConsumed: 0,
      kcalsPercent: 0,
      bodyWeight: null,
      targetKcals: 2000,
      targetProtein: 0,
      targetFat: 0,
      targetCarbs: 0,
      targetFiber: 0,
      consumedProtein: 0,
      consumedFat: 0,
      consumedCarbs: 0,
      consumedFiber: 0,
    };

    return this.diary$$()[selectedDay]?.totals || defaultTotals;
  }

  private updateNutrientsOptimistically(dateISO: string, nutrientsDelta: NutrientDelta, kcalsDelta: number): void {
    this.diaryRaw$$.update((diary) => {
      const updatedDiary = { ...diary };
      const dayData = updatedDiary[dateISO];

      if (dayData) {
        const currentNutrients = dayData.nutrients || DEFAULT_NUTRIENTS;

        updatedDiary[dateISO] = {
          ...dayData,
          nutrients: {
            ...currentNutrients,
            consumedKcals: (currentNutrients.consumedKcals || 0) + kcalsDelta,
            consumedProtein: (currentNutrients.consumedProtein || 0) + nutrientsDelta.protein,
            consumedFat: (currentNutrients.consumedFat || 0) + nutrientsDelta.fat,
            consumedCarbs: (currentNutrients.consumedCarbs || 0) + nutrientsDelta.carbs,
            consumedFiber: (currentNutrients.consumedFiber || 0) + nutrientsDelta.fiber,
          },
        };
      }

      return updatedDiary;
    });
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

  private subscribeToRealtimeUpdates(): void {
    this.networkService.wsMessages$.subscribe((message: IncomingWsMessage) => {
      if (!message?.type) return;

      switch (message.type) {
        case WebSocketMessageType.SYNC_STATUS:
          if (this.isValidSyncStatusPayload(message.payload)) {
            this.handleSyncStatus(message.payload);
          }
          break;

        case WebSocketMessageType.DIARY_ENTRY_CREATED:
          if (this.isValidNewDiaryEntryPayload(message.payload)) {
            this.handleDiaryEntryCreated(message.payload);
          }
          break;

        case WebSocketMessageType.DIARY_ENTRY_UPDATED:
          if (this.isValidUpdatedDiaryEntryPayload(message.payload)) {
            this.handleDiaryEntryUpdated(message.payload);
          }
          break;

        case WebSocketMessageType.DIARY_ENTRY_DELETED:
          if (this.isValidDeletedDiaryEntryPayload(message.payload)) {
            this.handleDiaryEntryDeleted(message.payload.deletedDiaryEntryId);
          }
          break;

        case WebSocketMessageType.BODY_WEIGHT_UPDATED:
          if (this.isValidBodyWeightUpdatePayload(message.payload)) {
            this.handleBodyWeightUpdated(message.payload);
          }
          break;
      }
    });
  }

  private isValidSyncStatusPayload(payload: UserDataLastModifiedTs): payload is UserDataLastModifiedTs {
    return payload && typeof payload.userDataLastModifiedTs === 'number';
  }

  private async handleSyncStatus(payload: UserDataLastModifiedTs): Promise<void> {
    try {
      const serverUserDataTs = payload.userDataLastModifiedTs;

      if (serverUserDataTs > this.lastSyncTs) {
        await this.loadAllFoodData();
        this.lastSyncTs = Date.now();
      }
    } catch (error) {
      console.error('Failed to handle sync status:', error);
    }
  }

  public async loadAllFoodData(): Promise<void> {
    await Promise.all([
      this.getFoodDiaryFullUpdateRange(),
      this.catalogueService.getCatalogueEntries(),
      this.coefficientsService.getCoefficients(),
      this.foodStatsService.getStats(),
    ]);
  }

  private isValidNewDiaryEntryPayload(payload: DiaryEntryToCreate): payload is DiaryEntryToCreate {
    return (
      payload &&
      typeof payload.id === 'number' &&
      typeof payload.dateISO === 'string' &&
      typeof payload.foodCatalogueId === 'number' &&
      typeof payload.foodWeight === 'number' &&
      Array.isArray(payload.history)
    );
  }

  private handleDiaryEntryCreated(diaryEntry: DiaryEntryToCreate): void {
    const dateISO = diaryEntry.dateISO;

    this.diaryRaw$$.update((diary) => {
      const updatedDiary = { ...diary };
      const dayData = updatedDiary[dateISO] || {
        food: {},
        bodyWeight: null,
        nutrients: DEFAULT_NUTRIENTS,
      };

      updatedDiary[dateISO] = {
        ...dayData,
        food: {
          ...dayData.food,
          [diaryEntry.id]: diaryEntry,
        },
      };

      return updatedDiary;
    });

    this.saveToLocalStorage(this.diaryRaw$$());

    const kcalsDelta = this.calculateEntryKcals(diaryEntry);
    if (kcalsDelta !== 0) {
      this.foodStatsService.updateStatsOptimistically(dateISO, 0, kcalsDelta);
    }
  }

  private isValidUpdatedDiaryEntryPayload(payload: DiaryEntryToUpdate): payload is DiaryEntryToUpdate {
    return (
      payload &&
      typeof payload.id === 'number' &&
      typeof payload.newFoodWeight === 'number' &&
      this.isValidHistoryEntry(payload.newHistoryEntry)
    );
  }

  private isValidHistoryEntry(historyEntry: HistoryEntry): historyEntry is HistoryEntry {
    return historyEntry && typeof historyEntry.action === 'string' && typeof historyEntry.value === 'number';
  }

  private handleDiaryEntryUpdated(updatedDiaryEntry: DiaryEntryToUpdate): void {
    const originalDiary = this.diaryRaw$$();
    let originalEntry: DiaryEntry | null = null;
    let dateISO: string | null = null;

    for (const [date, dayData] of Object.entries(originalDiary)) {
      if (dayData.food[updatedDiaryEntry.id]) {
        originalEntry = dayData.food[updatedDiaryEntry.id];
        dateISO = date;
        break;
      }
    }

    if (!originalEntry || !dateISO) {
      console.warn('Cannot update diary entry: original entry not found', updatedDiaryEntry.id);
      return;
    }

    const originalKcals = this.calculateEntryKcals(originalEntry);

    const updatedEntry: DiaryEntry = {
      ...originalEntry,
      foodWeight: updatedDiaryEntry.newFoodWeight,
      history: [...originalEntry.history, updatedDiaryEntry.newHistoryEntry],
    };

    this.diaryRaw$$.update((diary) => {
      const updatedDiary = { ...diary };
      const dayData = updatedDiary[dateISO!];

      if (dayData) {
        updatedDiary[dateISO!] = {
          ...dayData,
          food: {
            ...dayData.food,
            [updatedDiaryEntry.id]: updatedEntry,
          },
        };
      }

      return updatedDiary;
    });

    this.saveToLocalStorage(this.diaryRaw$$());

    const newKcals = this.calculateEntryKcals(updatedEntry);
    const kcalsDelta = newKcals - originalKcals;

    if (kcalsDelta !== 0) {
      this.foodStatsService.updateStatsOptimistically(dateISO, 0, kcalsDelta);
    }
  }

  private isValidDeletedDiaryEntryPayload(payload: DiaryEntryToDelete): payload is DiaryEntryToDelete {
    return payload && typeof payload.deletedDiaryEntryId === 'number';
  }

  private handleDiaryEntryDeleted(deletedDiaryEntryId: number): void {
    const originalDiary = this.diaryRaw$$();
    let deletedEntry: DiaryEntry | null = null;
    let dateISO: string | null = null;

    for (const [date, dayData] of Object.entries(originalDiary)) {
      if (dayData.food[deletedDiaryEntryId]) {
        deletedEntry = dayData.food[deletedDiaryEntryId];
        dateISO = date;
        break;
      }
    }

    if (!deletedEntry || !dateISO) {
      console.warn('Cannot delete diary entry: entry not found', deletedDiaryEntryId);
      return;
    }

    const deletedKcals = this.calculateEntryKcals(deletedEntry);

    this.diaryRaw$$.update((diary) => {
      const updatedDiary = { ...diary };
      const dayData = updatedDiary[dateISO!];

      if (dayData) {
        const updatedFood = { ...dayData.food };
        delete updatedFood[deletedDiaryEntryId];

        updatedDiary[dateISO!] = {
          ...dayData,
          food: updatedFood,
        };
      }

      return updatedDiary;
    });

    this.saveToLocalStorage(this.diaryRaw$$());
    this.foodStatsService.updateStatsOptimistically(dateISO, 0, -deletedKcals);
  }

  private isValidBodyWeightUpdatePayload(payload: BodyWeightToUpdate): payload is BodyWeightToUpdate {
    return payload && typeof payload.dateISO === 'string' && typeof payload.newBodyWeight === 'number';
  }

  private handleBodyWeightUpdated(bodyWeightToUpdate: BodyWeightToUpdate): void {
    this.diaryRaw$$.update((diary) => {
      const updatedDiary = { ...diary };
      const dayData = updatedDiary[bodyWeightToUpdate.dateISO] || {
        food: {},
        bodyWeight: null,
        nutrients: DEFAULT_NUTRIENTS,
      };

      updatedDiary[bodyWeightToUpdate.dateISO] = {
        ...dayData,
        bodyWeight: bodyWeightToUpdate.newBodyWeight,
      };

      return updatedDiary;
    });

    this.saveToLocalStorage(this.diaryRaw$$());
  }
}
