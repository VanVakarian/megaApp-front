import { HttpClient } from '@angular/common/http';
import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  BodyWeight,
  Catalogue,
  CatalogueEntry,
  CatalogueIds,
  Coefficients,
  Diary,
  DiaryEntry,
  FormattedDiary,
  FormattedDiaryEntry,
  ServerResponseBasic,
  ServerResponseWithData,
  ServerResponseWithDiaryId,
} from '@app/shared/interfaces';
import { calculateTodayIsoWithUserTimeShift } from '@app/shared/utils';
import { catchError, firstValueFrom, map, Observable, of, Subject } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { SyncOperationType, SyncQueueService } from './sync-queue.service';

const DIARY_STORAGE_KEY = 'food_diary';
const CATALOGUE_STORAGE_KEY = 'food_catalogue';
const CATALOGUE_MY_IDS_STORAGE_KEY = 'food_catalogue_my_ids';
const COEFFICIENTS_STORAGE_KEY = 'food_coefficients';

@Injectable({
  providedIn: 'root',
})
export class FoodService {
  public diary$$: WritableSignal<Diary> = signal({});
  public diaryFormatted$$: Signal<FormattedDiary> = computed(() => this.prepDiary());

  public selectedDayIso$$: WritableSignal<string> = signal(calculateTodayIsoWithUserTimeShift());
  public days$$: Signal<string[]> = computed(() => Object.keys(this.diary$$()));

  public catalogue$$: WritableSignal<Catalogue> = signal({});
  public catalogueMyIds$$: WritableSignal<CatalogueIds> = signal([]);
  public catalogueSortedListSelected$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(true)); // prettier-ignore
  public catalogueSortedListLeftOut$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(false)); // prettier-ignore

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
    // effect(() => { console.log('DIARY has been updated:', this.diary$$()) }); // prettier-ignore
    // effect(() => { console.log('DIARY FORMATTED has been updated:', this.diaryFormatted$$()) }); // prettier-ignore
    // effect(() => { console.log('SELECTED DAY has been updated:', this.selectedDayIso$$()) }); // prettier-ignore
    // effect(() => { console.log('DAYS have been updated:', this.days$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE have been updated:', this.catalogue$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE MY IDS have been updated:', this.catalogueMyIds$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST SELECTED have been updated:', this.catalogueSortedListSelected$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST LEFT OUT have been updated:', this.catalogueSortedListLeftOut$$()) }); // prettier-ignore
    // effect(() => { console.log('COEFFICIENTS have been updated:', this.coefficients$$()) }); // prettier-ignore

    effect(() => {
      if (this.shouldLoadMore()) {
        this.fetchMoreDiaryTrigger$.next();
      }
    });

    this.loadDiaryFromLocalStorage();
    this.loadCatalogueFromLocalStorage();
    this.loadCatalogueMyIdsFromLocalStorage();
    this.loadCoefficientsFromLocalStorage();

    this.subscribe();
  }

  private subscribe(): void {
    this.fetchMoreDiaryTrigger$.subscribe(() => {
      this.loadMoreData();
    });
  }

  //                                                                                                                INIT

  private prepDiary(): FormattedDiary {
    const formattedDiary: FormattedDiary = {};
    if (Object.keys(this.catalogue$$()).length === 0) return {}; // postpone formatting Diary if there is no catalogue yet

    for (const dateISO in this.diary$$()) {
      formattedDiary[dateISO] = {
        food: {},
        bodyWeight: this.diary$$()[dateISO].bodyWeight,
        targetKcals: this.diary$$()[dateISO].targetKcals,
        kcalsEaten: 0,
        kcalsPercent: 0,
      };

      for (const id in this.diary$$()[dateISO].food) {
        const entry = this.diary$$()[dateISO].food[id];
        const entryWeight = entry.foodWeight / 100;
        const catalogueKcals = this.catalogue$$()[entry.foodCatalogueId]?.kcals ?? 0;
        const entryCoefficient = this.coefficients$$()[entry.foodCatalogueId] || 1;
        const entryFinalKcals = Math.round(entryWeight * catalogueKcals * entryCoefficient);
        const entryPercent = (entryFinalKcals / this.diary$$()[dateISO].targetKcals) * 100;

        const formattedEntry: FormattedDiaryEntry = {
          id: Number(id),
          dateISO: entry.dateISO,
          foodCatalogueId: entry.foodCatalogueId,
          foodWeight: entry.foodWeight,
          history: entry.history || [],
          foodName: this.catalogue$$()[entry.foodCatalogueId]?.name || '',
          foodKcals: entryFinalKcals,
          foodPercent: `${Math.floor(entryPercent) < 100 ? entryPercent.toFixed(1) : Math.round(entryPercent).toString()}`,
          foodKcalPercentageOfDaysNorm: entryPercent,
        };

        formattedDiary[dateISO].food[id] = formattedEntry;
        formattedDiary[dateISO].kcalsEaten += entryFinalKcals;
        formattedDiary[dateISO].kcalsPercent += entryPercent;
      }
    }
    return formattedDiary;
  }

  private prepCatalogueSortedListSeparate(selected: boolean): CatalogueEntry[] {
    return Object.values(this.catalogue$$())
      .filter((item) =>
        selected ? this.catalogueMyIds$$().includes(item.id) : !this.catalogueMyIds$$().includes(item.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  @exhaustRequest()
  public getFoodDiaryFullUpdateRange(dateIso?: string, offset?: number): Observable<Diary> {
    const date = dateIso ?? calculateTodayIsoWithUserTimeShift();
    const paramsStr = `date=${date}&offset=${offset ?? this.FETCH_OFFSET}`;
    return this.http.get<Diary>(`/api/food/diary-full-update?${paramsStr}`).pipe(
      map((response) => {
        this.diary$$.update((diary) => ({ ...diary, ...response }));
        this.saveDiaryToLocalStorage();
        this.updateLoadedRange(date);
        return response;
      }),
    );
  }

  //                                                                                                               DIARY

  public createDiaryEntry(diaryEntry: DiaryEntry): Observable<ServerResponseWithDiaryId> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for creating diary entry');
      return of({ result: false, diaryId: 0 });
    }

    const tempId = Date.now();
    const originalDiary = { ...this.diary$$() };

    const entryWithTempId = { ...diaryEntry, id: tempId };
    this.updateDiaryEntryWithNewValues(entryWithTempId);
    this.saveDiaryToLocalStorage();

    const successCallback = (response: ServerResponseWithDiaryId) => {
      if (response.result && response.diaryId) {
        this.updateDiaryEntryId(tempId, response.diaryId);
      }
    };

    const rollbackFunction = () => {
      this.diary$$.set(originalDiary);
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

    const originalDiary = { ...this.diary$$() };
    const selectedDay = this.selectedDayIso$$();
    const originalEntry = originalDiary[selectedDay]?.food[diaryEntry.id];

    if (!originalEntry) {
      console.error('Cannot edit diary entry: entry not found');
      return of({ result: false });
    }

    this.updateDiaryEntryWithNewValues(diaryEntry);
    this.saveDiaryToLocalStorage();

    const rollbackFunction = () => {
      this.diary$$.set(originalDiary);
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
    const originalDiary = { ...this.diary$$() };
    const deletedEntry = originalDiary[selectedDay]?.food[diaryEntryId];

    if (!deletedEntry) {
      console.error('Cannot delete diary entry: entry not found');
      return of({ result: false });
    }

    this.removeDiaryEntry(diaryEntryId);
    this.saveDiaryToLocalStorage();

    const rollbackFunction = () => {
      this.diary$$.set(originalDiary);
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
    this.diary$$.update((oldDiary) => {
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
    this.diary$$.update((oldDiary) => {
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
    this.diary$$.update((oldDiary) => {
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

  //                                                                                                              WEIGHT

  public setUserBodyWeight(bodyWeight: BodyWeight): Observable<boolean> {
    return this.http.post<ServerResponseBasic>('/api/food/body-weight', bodyWeight).pipe(
      map((response) => {
        if (response.result) {
          this.diary$$.update((diary) => {
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
    const originalMyIds = [...this.catalogueMyIds$$()];

    this.addFoodEntryToCatalogue(foodName, foodKcals, tempId);
    this.addFoodIdToUserCatalogue(tempId);
    this.saveCatalogueToLocalStorage();
    this.saveCatalogueMyIdsToLocalStorage();

    const successCallback = (response: any) => {
      if (response.result && response.id) {
        this.updateCatalogueEntryId(tempId, response.id);
      }
    };

    const rollbackFunction = () => {
      this.catalogue$$.set(originalCatalogue);
      this.catalogueMyIds$$.set(originalMyIds);
      this.saveCatalogueToLocalStorage();
      this.saveCatalogueMyIdsToLocalStorage();
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

    this.catalogueMyIds$$.update((myIds) => {
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
    this.saveCatalogueMyIdsToLocalStorage();
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

  public getMyCatalogueEntries(): Observable<CatalogueIds> {
    return this.http.get<CatalogueIds>('/api/food/user-catalogue').pipe(
      map((response: CatalogueIds) => {
        this.catalogueMyIds$$.set(response);
        this.saveCatalogueMyIdsToLocalStorage();
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

    const originalMyIds = [...this.catalogueMyIds$$()];
    const originalCoefficients = { ...this.coefficients$$() };

    this.addFoodIdToUserCatalogue(foodId);
    this.saveCatalogueMyIdsToLocalStorage();

    this.coefficients$$.update((coefficients) => ({ ...coefficients, [foodId]: 1 }));
    this.saveCoefficientsToLocalStorage();

    const rollbackFunction = () => {
      this.catalogueMyIds$$.set(originalMyIds);
      this.saveCatalogueMyIdsToLocalStorage();
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

  private addFoodIdToUserCatalogue(foodId: number): void {
    this.catalogueMyIds$$.update((foodIds) => {
      return [...foodIds, foodId];
    });
  }

  public dismissUserFoodId(foodId: number): Observable<boolean> {
    if (!this.checkNetworkAvailability()) {
      return of(false);
    }

    const originalMyIds = [...this.catalogueMyIds$$()];
    const originalCoefficients = { ...this.coefficients$$() };

    this.removeFoodIdFromCatalogue(foodId);
    this.saveCatalogueMyIdsToLocalStorage();

    this.coefficients$$.update((coefficients) => {
      const updated = { ...coefficients };
      delete updated[foodId];
      return updated;
    });
    this.saveCoefficientsToLocalStorage();

    const rollbackFunction = () => {
      this.catalogueMyIds$$.set(originalMyIds);
      this.saveCatalogueMyIdsToLocalStorage();
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

  private removeFoodIdFromCatalogue(foodId: number): void {
    this.catalogueMyIds$$.update((foodIds) => foodIds.filter((id) => id !== foodId));
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
    this.localStorageService.set(DIARY_STORAGE_KEY, this.diary$$());
  }

  public loadDiaryFromLocalStorage(): void {
    const savedDiary = this.localStorageService.get<Diary>(DIARY_STORAGE_KEY);
    if (savedDiary) {
      this.diary$$.set(savedDiary);
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

  public saveCatalogueMyIdsToLocalStorage(): void {
    this.localStorageService.set(CATALOGUE_MY_IDS_STORAGE_KEY, this.catalogueMyIds$$());
  }

  public loadCatalogueMyIdsFromLocalStorage(): void {
    const savedMyIds = this.localStorageService.get<CatalogueIds>(CATALOGUE_MY_IDS_STORAGE_KEY);
    if (savedMyIds) {
      this.catalogueMyIds$$.set(savedMyIds);
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
      this.diary$$.set(originalDiary);
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

  private createRollbackForCatalogueMyIds(originalMyIds: CatalogueIds): () => void {
    return () => {
      this.catalogueMyIds$$.set(originalMyIds);
      this.saveCatalogueMyIdsToLocalStorage();
    };
  }

  private createRollbackForCoefficients(originalCoefficients: Coefficients): () => void {
    return () => {
      this.coefficients$$.set(originalCoefficients);
      this.saveCoefficientsToLocalStorage();
    };
  }
}
