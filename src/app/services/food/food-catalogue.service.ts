import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { Catalogue } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';

@Injectable({
  providedIn: 'root',
})
export class FoodCatalogueService extends BaseFoodService {
  private readonly CATALOGUE_STORAGE_KEY = 'food_catalogue';

  public catalogue$$: WritableSignal<Catalogue> = signal({});

  protected getStorageKey(): string {
    return this.CATALOGUE_STORAGE_KEY;
  }

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadCatalogueFromLocalStorage();
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

  private loadCatalogueFromLocalStorage(): void {
    const savedCatalogue = this.loadFromLocalStorage<Catalogue>();
    if (savedCatalogue) {
      this.catalogue$$.set(savedCatalogue);
    }
  }
}
