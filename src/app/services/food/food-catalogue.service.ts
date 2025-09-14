import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  Catalogue,
  CatalogueEntry,
  SearchQueryWsMessage,
  SearchResultsWsMessage,
  WebSocketMessageType,
} from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';

@Injectable({
  providedIn: 'root',
})
export class FoodCatalogueService extends BaseFoodService {
  private readonly CATALOGUE_STORAGE_KEY = 'food_catalogue';
  private readonly SEARCH_CACHE_KEY = 'food_search_cache';

  public catalogue$$: WritableSignal<Catalogue> = signal({});

  public searchResults$$: WritableSignal<CatalogueEntry[]> = signal([]);
  public isSearching$$: WritableSignal<boolean> = signal(false);

  private searchCache: Record<string, number[]> = {};

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
    this.loadSearchCacheFromLocalStorage();
    this.setupSearchWebSocketListener();
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

  public searchProducts(query: string): void {
    if (!query.trim()) {
      this.searchResults$$.set([]);
      return;
    }

    const cachedIds = this.getSearchCachedResults(query);
    if (cachedIds) {
      this.displaySearchResults(cachedIds);
    }

    this.sendSearchQuery(query);
  }

  private getSearchCachedResults(query: string): number[] | null {
    return this.searchCache[query] || null;
  }

  private setSearchCachedResults(query: string, ids: number[]): void {
    this.searchCache[query] = ids;
    this.saveSearchCacheToLocalStorage();
  }

  private sendSearchQuery(query: string): void {
    this.isSearching$$.set(true);
    const message: SearchQueryWsMessage = {
      type: WebSocketMessageType.SEARCH_QUERY,
      query: query,
    };
    this.networkService.sendMessage(message);
  }

  private setupSearchWebSocketListener(): void {
    this.networkService.wsMessages$
      .pipe(filter((msg) => msg.type === WebSocketMessageType.SEARCH_RESULTS))
      .subscribe((msg) => {
        this.handleSearchResults(msg as SearchResultsWsMessage);
      });
  }

  private handleSearchResults(msg: SearchResultsWsMessage): void {
    this.isSearching$$.set(false);

    const query = msg.payload.query;
    const results = msg.payload.catalogueIds;

    const cachedIds = this.getSearchCachedResults(query);

    if (!cachedIds || !this.arraysEqual(cachedIds, results)) {
      this.setSearchCachedResults(query, results);
      this.displaySearchResults(results);
    }
  }

  private displaySearchResults(ids: number[]): void {
    const catalogue = this.catalogue$$();

    if (!ids || !Array.isArray(ids) || !catalogue) {
      this.searchResults$$.set([]);
      return;
    }

    const results = ids.map((id) => catalogue[id]).filter(Boolean);
    this.searchResults$$.set(results);
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  private loadSearchCacheFromLocalStorage(): void {
    try {
      const savedCache = this.localStorageService.get<Record<string, number[]>>(this.SEARCH_CACHE_KEY);
      if (savedCache) {
        this.searchCache = savedCache;
      }
    } catch (error) {
      console.error('Failed to load search cache from localStorage:', error);
      this.searchCache = {};
    }
  }

  private saveSearchCacheToLocalStorage(): void {
    try {
      this.localStorageService.set(this.SEARCH_CACHE_KEY, this.searchCache);
    } catch (error) {
      console.error('Failed to save search cache to localStorage:', error);
    }
  }
}
