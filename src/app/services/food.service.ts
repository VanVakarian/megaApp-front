import { HttpClient } from '@angular/common/http';
import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';

import { catchError, firstValueFrom, map, Observable, of, Subject, tap } from 'rxjs';

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
  ServerResponseWithCatalogueEntry,
  ServerResponseWithData,
  ServerResponseWithDiaryId,
} from '@app/shared/interfaces';
import { getTodayIsoNoTimeNoTZ } from '@app/shared/utils';

@Injectable({
  providedIn: 'root',
})
export class FoodService {
  public diary$$: WritableSignal<Diary> = signal({});
  public diaryFormatted$$: Signal<FormattedDiary> = computed(() => this.prepDiary());

  public selectedDayIso$$: WritableSignal<string> = signal(getTodayIsoNoTimeNoTZ());
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

  constructor(private http: HttpClient) {
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
    if (Object.keys(this.catalogue$$()).length === 0) return formattedDiary; // postpone formatting Diary if there is no catalogue yet

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
    const date = dateIso ?? getTodayIsoNoTimeNoTZ();
    const paramsStr = `date=${date}&offset=${offset ?? this.FETCH_OFFSET}`;
    return this.http.get<Diary>(`/api/food/diary-full-update?${paramsStr}`).pipe(
      map((response) => {
        this.diary$$.update((diary) => ({ ...diary, ...response }));
        this.updateLoadedRange(date);
        return response;
      }),
    );
  }

  //                                                                                                               DIARY

  public createDiaryEntry(diaryEntry: DiaryEntry): Observable<ServerResponseWithDiaryId> {
    return this.http.post<ServerResponseWithDiaryId>('/api/food/diary/', diaryEntry).pipe(
      tap((response: ServerResponseWithDiaryId) => {
        if (response?.result) {
          diaryEntry.id = response.diaryId;
          this.updateDiaryEntryWithNewValues(diaryEntry);
        } else {
          console.error('Creation of diary entry failed');
        }
      }),
    );
  }

  public editDiaryEntry(diaryEntry: DiaryEntry): Observable<ServerResponseBasic> {
    return this.http.put<ServerResponseBasic>('/api/food/diary', diaryEntry).pipe(
      tap((response: ServerResponseBasic) => {
        if (response?.result) {
          this.updateDiaryEntryWithNewValues(diaryEntry);
        } else {
          console.error('Updating diary entry failed');
        }
      }),
    );
  }

  public deleteDiaryEntry(diaryEntryId: number): Observable<ServerResponseBasic> {
    return this.http.delete<ServerResponseBasic>(`/api/food/diary/${diaryEntryId}`).pipe(
      tap((response: ServerResponseBasic) => {
        if (response?.result) {
          this.removeDiaryEntry(diaryEntryId);
        } else {
          console.error('Error deleting diary entry');
        }
      }),
    );
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
        return response;
      }),
      catchError((error) => {
        console.error('Failed getting catalogue entries:', error);
        return of({});
      }),
    );
  }

  public createNewCatalogueEntry(foodName: string, foodKcals: number): Observable<number | null> {
    return this.http.post<ServerResponseWithCatalogueEntry>('/api/food/catalogue/', { foodName, foodKcals }).pipe(
      map((response) => {
        if (response.result && response.id) {
          this.addFoodEntryToCatalogue(foodName, foodKcals, response.id);
          this.addFoodIdToUserCatalogue(response.id);
          return response.id;
        }
        return null;
      }),
      catchError((error) => {
        console.error('Failed adding user food item:', error);
        return of(null);
      }),
    );
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

  public editCatalogueEntry(foodId: number, foodName: string, foodKcals: number): Observable<boolean> {
    return this.http
      .put<ServerResponseWithCatalogueEntry>('/api/food/catalogue/', { foodId, foodName, foodKcals })
      .pipe(
        map((response) => {
          if (response.result) {
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
          }
          return response.result;
        }),
        catchError((error) => {
          console.error('Failed updating user food item:', error);
          return of(false);
        }),
      );
  }

  public getMyCatalogueEntries(): Observable<CatalogueIds> {
    return this.http.get<CatalogueIds>('/api/food/user-catalogue').pipe(
      map((response: CatalogueIds) => {
        this.catalogueMyIds$$.set(response);
        return response;
      }),
      catchError((error) => {
        console.error('Failed getting user catalogue entries:', error);
        return of([]);
      }),
    );
  }

  public pickUserFoodId(foodId: number): Observable<boolean> {
    return this.http.put<ServerResponseBasic>('/api/food/user-catalogue/pick/', { foodId: foodId }).pipe(
      map((response) => {
        if (response.result) this.addFoodIdToUserCatalogue(foodId);
        return response.result;
      }),
      catchError((error) => {
        console.error('Failed picking user food id:', error);
        return of(false);
      }),
    );
  }

  private addFoodIdToUserCatalogue(foodId: number): void {
    this.catalogueMyIds$$.update((foodIds) => {
      return [...foodIds, foodId];
    });
  }

  public dismissUserFoodId(foodId: number): Observable<boolean> {
    return this.http.put<ServerResponseBasic>('/api/food/user-catalogue/dismiss/', { foodId: foodId }).pipe(
      map((response) => {
        if (response.result) this.removeFoodIdFromCatalogue(foodId);
        return response.result;
      }),
      catchError((error) => {
        console.error('Failed dismissing user food id:', error);
        return of(false);
      }),
    );
  }

  private removeFoodIdFromCatalogue(foodId: number): void {
    this.catalogueMyIds$$.update((foodIds) => foodIds.filter((id) => id !== foodId));
  }

  //                                                                                                        COEFFICIENTS

  public getCoefficients(): Observable<ServerResponseWithData<Coefficients>> {
    return this.http.get<ServerResponseWithData<Coefficients>>('/api/food/coefficients').pipe(
      map((response) => {
        this.coefficients$$.set(response.data);
        return response;
      }),
      catchError((error) => {
        console.error('Failed fetching coefficients:', error);
        return of({ result: false, data: {} as Coefficients });
      }),
    );
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
}
