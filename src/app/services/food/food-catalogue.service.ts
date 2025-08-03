import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { Catalogue, CatalogueEntry, CatalogueIds } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncOperationType, SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';
import { FoodCoefficientsService } from './food-coefficients.service';

@Injectable({
  providedIn: 'root',
})
export class FoodCatalogueService extends BaseFoodService {
  private readonly CATALOGUE_STORAGE_KEY = 'food_catalogue';
  private readonly CATALOGUE_IDS_SELECTED_STORAGE_KEY = 'food_catalogue_ids_selected';

  public catalogue$$: WritableSignal<Catalogue> = signal({});
  public catalogueIdsSelected$$: WritableSignal<CatalogueIds> = signal([]);
  public catalogueIdsSelectedSorted$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(true)); // prettier-ignore
  public catalogueIdsLeftOutSorted$$: Signal<CatalogueEntry[]> = computed(() => this.prepCatalogueSortedListSeparate(false)); // prettier-ignore

  protected getStorageKey(): string {
    return this.CATALOGUE_STORAGE_KEY;
  }

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
    private coefficientsService: FoodCoefficientsService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadCatalogueFromLocalStorage();
    this.loadCatalogueIdsSelectedFromLocalStorage();

    // effect(() => { console.log('CATALOGUE have been updated:', this.catalogue$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE IDS SELECTED have been updated:', this.catalogueIdsSelected$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST SELECTED have been updated:', this.catalogueIdsSelectedSorted$$()) }); // prettier-ignore
    // effect(() => { console.log('CATALOGUE SORTED LIST LEFT OUT have been updated:', this.catalogueIdsLeftOutSorted$$()) }); // prettier-ignore
  }

  @exhaustRequest()
  public async getCatalogueEntries(): Promise<Catalogue> {
    try {
      const response = await firstValueFrom(this.http.get<Catalogue>('/api/food/catalogue'));

      this.catalogue$$.set(response);
      this.saveToLocalStorage(response);
      return response;
    } catch (error) {
      console.error('Failed getting catalogue entries:', error);
      return {};
    }
  }

  public async createNewCatalogueEntry(foodName: string, foodKcals: number): Promise<number | null> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for creating catalogue entry');
      return null;
    }

    const tempId = Date.now();
    const originalCatalogue = { ...this.catalogue$$() };
    const originalIdsSelected = [...this.catalogueIdsSelected$$()];

    this.addFoodEntryToCatalogue(foodName, foodKcals, tempId);
    this.addFoodIdToCatalogueIdsSelected(tempId);
    this.saveToLocalStorage(this.catalogue$$());
    this.saveCatalogueIdsSelectedToLocalStorage();

    const successCallback = (response: any) => {
      if (response.result && response.id) {
        this.updateCatalogueEntryId(tempId, response.id);
      }
    };

    const rollbackFunction = () => {
      this.catalogue$$.set(originalCatalogue);
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveToLocalStorage(originalCatalogue);
      this.saveCatalogueIdsSelectedToLocalStorage();
    };

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/food/catalogue/',
      data: { foodName, foodKcals },
      successCallback: successCallback,
      rollbackCallback: rollbackFunction,
    });

    return tempId;
  }

  public async editCatalogueEntry(foodId: number, foodName: string, foodKcals: number): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      console.error('Network not available for editing catalogue entry');
      return false;
    }

    const originalCatalogue = { ...this.catalogue$$() };
    const originalEntry = originalCatalogue[foodId];

    if (!originalEntry) {
      console.error('Cannot edit catalogue entry: entry not found');
      return false;
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
    this.saveToLocalStorage(this.catalogue$$());

    const rollbackFunction = () => {
      this.catalogue$$.set(originalCatalogue);
      this.saveToLocalStorage(originalCatalogue);
    };

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/catalogue/',
      data: { foodId, foodName, foodKcals },
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  @exhaustRequest()
  public async getCatalogueEntriesSelected(): Promise<CatalogueIds> {
    try {
      const response = await firstValueFrom(this.http.get<CatalogueIds>('/api/food/user-catalogue'));

      this.catalogueIdsSelected$$.set(response);
      this.saveCatalogueIdsSelectedToLocalStorage();
      return response;
    } catch (error) {
      console.error('Failed getting user catalogue entries:', error);
      return [];
    }
  }

  public async pickUserFoodId(foodId: number): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      return false;
    }

    const originalIdsSelected = [...this.catalogueIdsSelected$$()];
    const originalCoefficients = { ...this.coefficientsService.coefficients$$() };

    this.addFoodIdToCatalogueIdsSelected(foodId);
    this.saveCatalogueIdsSelectedToLocalStorage();

    this.coefficientsService.coefficients$$.update((coefficients) => ({ ...coefficients, [foodId]: 1 }));

    const rollbackFunction = () => {
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueIdsSelectedToLocalStorage();
      this.coefficientsService.coefficients$$.set(originalCoefficients);
    };

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/user-catalogue/pick/',
      data: { foodId },
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  public async dismissUserFoodId(foodId: number): Promise<boolean> {
    if (!this.checkNetworkAvailability()) {
      return false;
    }

    const originalIdsSelected = [...this.catalogueIdsSelected$$()];
    const originalCoefficients = { ...this.coefficientsService.coefficients$$() };

    this.removeFoodIdFromCatalogueIdsSelected(foodId);
    this.saveCatalogueIdsSelectedToLocalStorage();

    this.coefficientsService.coefficients$$.update((coefficients) => {
      const updated = { ...coefficients };
      delete updated[foodId];
      return updated;
    });

    const rollbackFunction = () => {
      this.catalogueIdsSelected$$.set(originalIdsSelected);
      this.saveCatalogueIdsSelectedToLocalStorage();
      this.coefficientsService.coefficients$$.set(originalCoefficients);
    };

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/food/user-catalogue/dismiss/',
      data: { foodId },
      rollbackCallback: rollbackFunction,
    });

    return true;
  }

  private prepCatalogueSortedListSeparate(isSelectedEntries: boolean): CatalogueEntry[] {
    return Object.values(this.catalogue$$())
      .filter((item) =>
        isSelectedEntries
          ? this.catalogueIdsSelected$$().includes(item.id)
          : !this.catalogueIdsSelected$$().includes(item.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
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

    this.coefficientsService.coefficients$$.update((coefficients) => {
      if (coefficients[tempId]) {
        const updated = { ...coefficients };
        updated[realId] = coefficients[tempId];
        delete updated[tempId];
        return updated;
      }
      return coefficients;
    });

    this.saveToLocalStorage(this.catalogue$$());
    this.saveCatalogueIdsSelectedToLocalStorage();
  }

  private addFoodIdToCatalogueIdsSelected(foodId: number): void {
    this.catalogueIdsSelected$$.update((foodIds) => {
      return [...foodIds, foodId];
    });
  }

  private removeFoodIdFromCatalogueIdsSelected(foodId: number): void {
    this.catalogueIdsSelected$$.update((foodIds) => foodIds.filter((id) => id !== foodId));
  }

  private loadCatalogueFromLocalStorage(): void {
    const savedCatalogue = this.loadFromLocalStorage<Catalogue>();
    if (savedCatalogue) {
      this.catalogue$$.set(savedCatalogue);
    }
  }

  private saveCatalogueIdsSelectedToLocalStorage(): void {
    this.localStorageService.set(this.CATALOGUE_IDS_SELECTED_STORAGE_KEY, this.catalogueIdsSelected$$());
  }

  private loadCatalogueIdsSelectedFromLocalStorage(): void {
    const savedIdsSelected = this.localStorageService.get<CatalogueIds>(this.CATALOGUE_IDS_SELECTED_STORAGE_KEY);
    if (savedIdsSelected) {
      this.catalogueIdsSelected$$.set(savedIdsSelected);
    }
  }
}
