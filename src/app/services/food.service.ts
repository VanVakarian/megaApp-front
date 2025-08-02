import { HttpClient } from '@angular/common/http';
import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  BodyWeight,
  Catalogue,
  CatalogueEntry,
  CatalogueIds,
  Coefficients,
  DayTotals,
  Diary,
  DiaryEntry,
  DiaryEntryWithFullData,
  ServerResponseBasic,
  ServerResponseWithData,
  ServerResponseWithDiaryId,
  UnifiedDiary,
} from '@app/shared/interfaces';
import { calculateTodayIsoWithUserTimeShift } from '@app/shared/utils';
import { catchError, firstValueFrom, map, Observable, of, Subject } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { SyncOperationType, SyncQueueService } from './sync-queue.service';

const DIARY_STORAGE_KEY = 'food_diary';
const CATALOGUE_STORAGE_KEY = 'food_catalogue';
const CATALOGUE_IDS_SELECTED_STORAGE_KEY = 'food_catalogue_ids_selected';
const COEFFICIENTS_STORAGE_KEY = 'food_coefficients';

@Injectable({
  providedIn: 'root',
})
export class FoodService {
  private diaryRaw$$: WritableSignal<Diary> = signal({});
  public days$$: Signal<string[]> = computed(() => Object.keys(this.diaryRaw$$()));

  public diary$$: Signal<UnifiedDiary> = computed(() => this.prepUnifiedDiary());

  public selectedDayIso$$: WritableSignal<string> = signal(calculateTodayIsoWithUserTimeShift());
  public selectedDayTotals$$: Signal<DayTotals> = computed(() => this.extractSelectedDayTotals());

  public catalogue$$: WritableSignal<Catalogue> = signal({});
  public catalogueIdsSelected$$: WritableSignal<CatalogueIds> = signal([]);
  public catalogueIdsSelectedSorted$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(true)); // prettier-ignore
  public catalogueIdsLeftOutSorted$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(false)); // prettier-ignore

  public coefficients$$: WritableSignal<Coefficients> = signal({});

  public diaryEntryClickedFocus$ = new Subject<number>();

  public postRequestResult$ = new Subject<ServerResponseBasic>();

  private FETCH_OFFSET = 7; // TODO[063]: move to settings
  private FETCH_THRESHOLD = 3; // TODO[063]: move to settings

  private loadedRange$$: WritableSignal<{ start: string; end: string } | null> = signal(null);
  private fetchMoreDiaryTrigger$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private localStorageService: LocalStorageService,
    private networkService: NetworkService,
    private syncQueueService: SyncQueueService,
  ) {
    // effect(() => { console.log('DIARY RAW has been updated:', this.diaryRaw$$()) }); // prettier-ignore
    // effect(() => { console.log('DAYS have been updated:', this.days$$()) }); // prettier-ignore
    // effect(() => { console.log('UNIFIED DIARY has been updated:', this.diary$$()) }); // prettier-ignore
    // effect(() => { console.log('SELECTED DAY has been updated:', this.selectedDayIso$$()) }); // prettier-ignore
    // effect(() => { console.log('SELECTED DAY TOTALS has been updated:', this.selectedDayTotals$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE have been updated:', this.catalogue$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE IDS SELECTED have been updated:', this.catalogueIdsSelected$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST SELECTED have been updated:', this.catalogueIdsSelectedSorted$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST LEFT OUT have been updated:', this.catalogueIdsLeftOutSorted$$()) }); // prettier-ignore
    // effect(() => { console.log('COEFFICIENTS have been updated:', this.coefficients$$()) }); // prettier-ignore

    effect(() => {
      if (this.shouldLoadMore()) {
        this.fetchMoreDiaryTrigger$.next();
      }
    });

    this.loadDiaryFromLocalStorage();
    this.loadCatalogueFromLocalStorage();
    this.loadCatalogueIdsSelectedFromLocalStorage();
    this.loadCoefficientsFromLocalStorage();

    this.subscribe();
  }

  private subscribe(): void {
    this.fetchMoreDiaryTrigger$.subscribe(() => {
      this.loadMoreData();
    });
  }

  //                                                                                                               DIARY

  private prepUnifiedDiary(): UnifiedDiary {
    const rawDiary = this.diaryRaw$$();
    const catalogue = this.catalogue$$();
    const coefficients = this.coefficients$$();
    const result: UnifiedDiary = {};

    for (const [dateISO, day] of Object.entries(rawDiary)) {
      const foodEntries: DiaryEntryWithFullData[] = [];
      let kcalsEaten = 0;
      let kcalsPercent = 0;

      for (const [id, entry] of Object.entries(day.food)) {
        const kcals = this.calculateEntryKcals(entry, catalogue, coefficients);
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

  @exhaustRequest()
  public getFoodDiaryFullUpdateRange(dateIso?: string, offset?: number): Observable<Diary> {
    const date = dateIso ?? calculateTodayIsoWithUserTimeShift();
    const paramsStr = `date=${date}&offset=${offset ?? this.FETCH_OFFSET}`;
    return this.http.get<Diary>(`/api/food/diary-full-update?${paramsStr}`).pipe(
      map((response) => {
        this.diaryRaw$$.update((diary) => ({ ...diary, ...response }));
        this.saveDiaryToLocalStorage();
        this.updateLoadedRange(date);
        return response;
      }),
    );
  }

  public createDiaryEntry(diaryEntry: DiaryEntry): Observable<ServerResponseWithDiaryId> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for creating diary entry');
      return of({ result: false, diaryId: 0 });
    }

    const tempId = Date.now();
    const originalDiary = { ...this.diaryRaw$$() };

    const entryWithTempId = { ...diaryEntry, id: tempId };
    this.updateDiaryEntryWithNewValues(entryWithTempId);
    this.saveDiaryToLocalStorage();

    const successCallback = (response: ServerResponseWithDiaryId) => {
      if (response.result && response.diaryId) {
        this.updateDiaryEntryId(tempId, response.diaryId);
      }
    };

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveDiaryToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/food/diary/',
      data: diaryEntry,
      successCallback: successCallback,
      rollbackCallback: rollbackFunction,
    });

    return of({ result: true, diaryId: tempId });
  }

  public editDiaryEntry(diaryEntry: DiaryEntry): Observable<ServerResponseBasic> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for editing diary entry');
      return of({ result: false });
    }

    const originalDiary = { ...this.diaryRaw$$() };
    const selectedDay = this.selectedDayIso$$();
    const originalEntry = originalDiary[selectedDay]?.food[diaryEntry.id];

    if (!originalEntry) {
      console.error('Cannot edit diary entry: entry not found');
      return of({ result: false });
    }

    this.updateDiaryEntryWithNewValues(diaryEntry);
    this.saveDiaryToLocalStorage();

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveDiaryToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/diary',
      data: diaryEntry,
      rollbackCallback: rollbackFunction,
    });

    return of({ result: true });
  }

  public deleteDiaryEntry(diaryEntryId: number): Observable<ServerResponseBasic> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for deleting diary entry');
      return of({ result: false });
    }

    const selectedDay = this.selectedDayIso$$();
    const originalDiary = { ...this.diaryRaw$$() };
    const deletedEntry = originalDiary[selectedDay]?.food[diaryEntryId];

    if (!deletedEntry) {
      console.error('Cannot delete diary entry: entry not found');
      return of({ result: false });
    }

    this.removeDiaryEntry(diaryEntryId);
    this.saveDiaryToLocalStorage();

    const rollbackFunction = () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveDiaryToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/food/diary/${diaryEntryId}`,
      data: {},
      rollbackCallback: rollbackFunction,
    });

    return of({ result: true });
  }

  private updateDiaryEntryWithNewValues(updatedDiaryEntry: DiaryEntry): void {
    this.diaryRaw$$.update((oldDiary) => {
      const selectedDay = this.selectedDayIso$$();
      const updatedDiary = { ...oldDiary };
      const updatedDay = { ...updatedDiary[selectedDay] };
      const updatedFood = { ...updatedDay.food };

      // Creating new food entry if there is none with this id (in case of new food)
      if (!updatedFood[updatedDiaryEntry.id]) {
        updatedFood[updatedDiaryEntry.id] = {
          id: updatedDiaryEntry.id,
          dateISO: selectedDay,
          foodCatalogueId: updatedDiaryEntry.foodCatalogueId,
          foodWeight: updatedDiaryEntry.foodWeight,
          history: [],
        };
      }

      // Updating existing or newly created entry
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
    this.saveDiaryToLocalStorage();
  }

  public calculateEntryKcals(entry: DiaryEntry, catalogue: Catalogue, coefficients: Coefficients): number {
    const entryWeight = entry.foodWeight / 100;
    const catalogueKcals = catalogue[entry.foodCatalogueId]?.kcals ?? 0;
    const coefficient = coefficients[entry.foodCatalogueId] || 1;
    return Math.round(entryWeight * catalogueKcals * coefficient);
  }

  private calculatePercentage(kcals: number, targetKcals: number): number {
    if (targetKcals === 0) return 0;
    return (kcals / targetKcals) * 100;
  }

  private formatPercentage(percent: number): string {
    return Math.floor(percent) < 100 ? percent.toFixed(1) : Math.round(percent).toString();
  }

  private extractSelectedDayTotals(): DayTotals {
    const selectedDay = this.selectedDayIso$$();
    return this.diary$$()[selectedDay]?.totals || { kcalsEaten: 0, kcalsPercent: 0, bodyWeight: null, targetKcals: 0 };
  }

  //                                                                                                              WEIGHT

  public setUserBodyWeight(bodyWeight: BodyWeight): Observable<boolean> {
    return this.http.post<ServerResponseBasic>('/api/food/body-weight', bodyWeight).pipe(
      map((response) => {
        if (response.result) {
          this.diaryRaw$$.update((diary) => {
            return {
              ...diary,
              [bodyWeight.dateISO]: {
                ...diary[bodyWeight.dateISO],
                bodyWeight: Number(bodyWeight.bodyWeight),
              },
            };
          });
        }
        return response.result;
      }),
      catchError((error) => {
        console.error('Failed setting user body weight:', error);
        return of(false);
      }),
    );
  }

  //                                                                                                           CATALOGUE

  private prepCatalogueSortedListSeparate(isSelectedEntries: boolean): CatalogueEntry[] {
    return Object.values(this.catalogue$$())
      .filter((item) =>
        isSelectedEntries
          ? this.catalogueIdsSelected$$().includes(item.id)
          : !this.catalogueIdsSelected$$().includes(item.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public getCatalogueEntries(): Observable<Catalogue> {
    return this.http.get<Catalogue>('/api/food/catalogue').pipe(
      map((response: Catalogue) => {
        this.catalogue$$.set(response);
        this.saveCatalogueToLocalStorage();
        return response;
      }),
      catchError((error) => {
        console.error('Failed getting catalogue entries:', error);
        return of({});
      }),
    );
  }

  public createNewCatalogueEntry(foodName: string, foodKcals: number): Observable<number | null> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for creating catalogue entry');
      return of(null);
    }

    const tempId = Date.now();

    const originalCatalogue = { ...this.catalogue$$() };
    const originalIdsSelected = [...this.catalogueIdsSelected$$()];

    this.addFoodEntryToCatalogue(foodName, foodKcals, tempId);
    this.addFoodIdToCatalogueIdsSelected(tempId);
    this.saveCatalogueToLocalStorage();
    this.saveCatalogueIdsSelectedToLocalStorage();

    const successCallback = (response: any) => {
      if (response.result && response.id) {
        this.updateCatalogueEntryId(tempId, response.id);
      }
    };

    const rollbackFunction = () => {
      this.catalogue$$.set(originalCatalogue);
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueToLocalStorage();
      this.saveCatalogueIdsSelectedToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/food/catalogue/',
      data: { foodName, foodKcals },
      successCallback: successCallback,
      rollbackCallback: rollbackFunction,
    });

    return of(tempId);
  }

  private addFoodEntryToCatalogue(foodName: string, foodKcals: number, newId: number): void {
    this.catalogue$$.update((catalogue) => {
      const newCatalogueEntry: CatalogueEntry = {
        id: newId,
        name: foodName,
        kcals: foodKcals,
      };
      return { ...catalogue, [newId]: newCatalogueEntry };
    });
  }

  private updateCatalogueEntryId(tempId: number, realId: number): void {
    this.catalogue$$.update((catalogue) => {
      if (catalogue[tempId]) {
        const entry = { ...catalogue[tempId], id: realId };
        const updated = { ...catalogue };
        updated[realId] = entry;
        delete updated[tempId];
        return updated;
      }
      return catalogue;
    });

    this.catalogueIdsSelected$$.update((myIds) => {
      const index = myIds.indexOf(tempId);
      if (index !== -1) {
        const updated = [...myIds];
        updated[index] = realId;
        return updated;
      }
      return myIds;
    });

    this.coefficients$$.update((coefficients) => {
      if (coefficients[tempId]) {
        const updated = { ...coefficients };
        updated[realId] = coefficients[tempId];
        delete updated[tempId];
        return updated;
      }
      return coefficients;
    });

    this.saveCatalogueToLocalStorage();
    this.saveCatalogueIdsSelectedToLocalStorage();
    this.saveCoefficientsToLocalStorage();
  }

  public editCatalogueEntry(foodId: number, foodName: string, foodKcals: number): Observable<boolean> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for editing catalogue entry');
      return of(false);
    }

    const originalCatalogue = { ...this.catalogue$$() };
    const originalEntry = originalCatalogue[foodId];

    if (!originalEntry) {
      console.error('Cannot edit catalogue entry: entry not found');
      return of(false);
    }

    this.catalogue$$.update((catalogue) => {
      return {
        ...catalogue,
        [foodId]: {
          id: foodId,
          name: foodName,
          kcals: foodKcals,
        },
      };
    });
    this.saveCatalogueToLocalStorage();

    const rollbackFunction = () => {
      this.catalogue$$.set(originalCatalogue);
      this.saveCatalogueToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/catalogue/',
      data: { foodId, foodName, foodKcals },
      rollbackCallback: rollbackFunction,
    });

    return of(true);
  }

  public getCatalogueEntriesSelected(): Observable<CatalogueIds> {
    return this.http.get<CatalogueIds>('/api/food/user-catalogue').pipe(
      map((response: CatalogueIds) => {
        this.catalogueIdsSelected$$.set(response);
        this.saveCatalogueIdsSelectedToLocalStorage();
        return response;
      }),
      catchError((error) => {
        console.error('Failed getting user catalogue entries:', error);
        return of([]);
      }),
    );
  }

  public pickUserFoodId(foodId: number): Observable<boolean> {
    if (!this.checkNetworkAvailability()) {
      return of(false);
    }

    const originalIdsSelected = [...this.catalogueIdsSelected$$()];
    const originalCoefficients = { ...this.coefficients$$() };

    this.addFoodIdToCatalogueIdsSelected(foodId);
    this.saveCatalogueIdsSelectedToLocalStorage();

    this.coefficients$$.update((coefficients) => ({ ...coefficients, [foodId]: 1 }));
    this.saveCoefficientsToLocalStorage();

    const rollbackFunction = () => {
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueIdsSelectedToLocalStorage();
      this.coefficients$$.set(originalCoefficients);
      this.saveCoefficientsToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/user-catalogue/pick/',
      data: { foodId },
      rollbackCallback: rollbackFunction,
    });

    return of(true);
  }

  public dismissUserFoodId(foodId: number): Observable<boolean> {
    if (!this.checkNetworkAvailability()) {
      return of(false);
    }

    const originalIdsSelected = [...this.catalogueIdsSelected$$()];
    const originalCoefficients = { ...this.coefficients$$() };

    this.removeFoodIdFromCatalogueIdsSelected(foodId);
    this.saveCatalogueIdsSelectedToLocalStorage();

    this.coefficients$$.update((coefficients) => {
      const updated = { ...coefficients };
      delete updated[foodId];
      return updated;
    });
    this.saveCoefficientsToLocalStorage();

    const rollbackFunction = () => {
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueIdsSelectedToLocalStorage();
      this.coefficients$$.set(originalCoefficients);
      this.saveCoefficientsToLocalStorage();
    };

    this.syncQueueService.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/user-catalogue/dismiss/',
      data: { foodId },
      rollbackCallback: rollbackFunction,
    });

    return of(true);
  }

  private addFoodIdToCatalogueIdsSelected(foodId: number): void {
    this.catalogueIdsSelected$$.update((foodIds) => {
      return [...foodIds, foodId];
    });
  }

  private removeFoodIdFromCatalogueIdsSelected(foodId: number): void {
    this.catalogueIdsSelected$$.update((foodIds) => foodIds.filter((id) => id !== foodId));
  }

  //                                                                                                        COEFFICIENTS

  public getCoefficients(): Observable<ServerResponseWithData<Coefficients>> {
    const localCoefficients = this.coefficients$$();

    if (Object.keys(localCoefficients).length > 0) {
      this.fetchCoefficientsInBackground();
      return of({ result: true, data: localCoefficients });
    }

    return this.http.get<ServerResponseWithData<Coefficients>>('/api/food/coefficients').pipe(
      map((response) => {
        this.coefficients$$.set(response.data);
        this.saveCoefficientsToLocalStorage();
        return response;
      }),
      catchError((error) => {
        console.error('Failed fetching coefficients:', error);
        return of({ result: false, data: {} as Coefficients });
      }),
    );
  }

  private async fetchCoefficientsInBackground(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ServerResponseWithData<Coefficients>>('/api/food/coefficients').pipe(
          catchError((error) => {
            console.error('Failed fetching coefficients in background:', error);
            return of({ result: false, data: {} as Coefficients });
          }),
        ),
      );

      if (response.result) {
        this.coefficients$$.set(response.data);
        this.saveCoefficientsToLocalStorage();
      }
    } catch (error) {
      console.error('Failed fetching coefficients in background:', error);
    }
  }

  //                                                                                                     AUTO DIARY LOAD

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

    await firstValueFrom(this.getFoodDiaryFullUpdateRange(dateToLoad));
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

  //                                                                                                       LOCAL STORAGE

  public saveDiaryToLocalStorage(): void {
    this.localStorageService.set(DIARY_STORAGE_KEY, this.diaryRaw$$());
  }

  public loadDiaryFromLocalStorage(): void {
    const savedDiary = this.localStorageService.get<Diary>(DIARY_STORAGE_KEY);
    if (savedDiary) {
      this.diaryRaw$$.set(savedDiary);
    }
  }

  public saveCatalogueToLocalStorage(): void {
    this.localStorageService.set(CATALOGUE_STORAGE_KEY, this.catalogue$$());
  }

  public loadCatalogueFromLocalStorage(): void {
    const savedCatalogue = this.localStorageService.get<Catalogue>(CATALOGUE_STORAGE_KEY);
    if (savedCatalogue) {
      this.catalogue$$.set(savedCatalogue);
    }
  }

  public saveCatalogueIdsSelectedToLocalStorage(): void {
    this.localStorageService.set(CATALOGUE_IDS_SELECTED_STORAGE_KEY, this.catalogueIdsSelected$$());
  }

  public loadCatalogueIdsSelectedFromLocalStorage(): void {
    const savedIdsSelected = this.localStorageService.get<CatalogueIds>(CATALOGUE_IDS_SELECTED_STORAGE_KEY);
    if (savedIdsSelected) {
      this.catalogueIdsSelected$$.set(savedIdsSelected);
    }
  }

  public saveCoefficientsToLocalStorage(): void {
    this.localStorageService.set(COEFFICIENTS_STORAGE_KEY, this.coefficients$$());
  }

  public loadCoefficientsFromLocalStorage(): void {
    const savedCoefficients = this.localStorageService.get<Coefficients>(COEFFICIENTS_STORAGE_KEY);
    if (savedCoefficients) {
      this.coefficients$$.set(savedCoefficients);
    }
  }

  //                                                                                                     NETWORK HELPERS

  private checkNetworkAvailability(): boolean {
    return this.networkService.isNetworkAvailable$$();
  }

  //                                                                                                    ROLLBACK HELPERS

  private createRollbackForDiaryEntry(originalDiary: Diary): () => void {
    return () => {
      this.diaryRaw$$.set(originalDiary);
      this.saveDiaryToLocalStorage();
    };
  }

  private createRollbackForDeletedEntry(deletedEntry: DiaryEntry): () => void {
    return () => {
      this.updateDiaryEntryWithNewValues(deletedEntry);
      this.saveDiaryToLocalStorage();
    };
  }

  private createRollbackForCatalogueEntry(originalCatalogue: Catalogue): () => void {
    return () => {
      this.catalogue$$.set(originalCatalogue);
      this.saveCatalogueToLocalStorage();
    };
  }

  private createRollbackForCatalogueIdsSelected(originalIdsSelected: CatalogueIds): () => void {
    return () => {
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueIdsSelectedToLocalStorage();
    };
  }

  private createRollbackForCoefficients(originalCoefficients: Coefficients): () => void {
    return () => {
      this.coefficients$$.set(originalCoefficients);
      this.saveCoefficientsToLocalStorage();
    };
  }
}
