import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import {
  Catalogue,
  CatalogueEntry,
  CatalogueEntrySavedWsMessage,
  CatalogueImageGeneratedWsMessage,
  ProductPreviewData,
  ProductSaveRequest,
  SearchQueryWsMessage,
  SearchResultsWsMessage,
  ServerResponseProductPreview,
  ServerResponseProductSave,
  WebSocketMessageType,
} from '@app/shared/interfaces';
import { transliterateEnToRu } from '@app/shared/utils';
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

  public readonly catalogue$$: WritableSignal<Catalogue> = signal({});

  private readonly searchQuery$$: WritableSignal<string> = signal('');
  public readonly searchResults$$: WritableSignal<CatalogueEntry[]> = signal([]);

  public readonly isLegacySearch$$: WritableSignal<boolean> = signal(false);
  public readonly legacySearchResults$$: WritableSignal<CatalogueEntry[]> = signal([]);

  private searchCache: Record<string, number[]> = {};
  private pendingSearchQuery: string = '';
  private searchSequenceNumber: number = 0;
  private lastDisplayedSequenceNumber: number = 0;

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
    this.searchQuery$$.set(query);

    if (!query.trim()) {
      this.searchResults$$.set([]);
      this.searchSequenceNumber = 0;
      this.lastDisplayedSequenceNumber = 0;
      return;
    }

    this.searchSequenceNumber++;

    const cachedIds = this.getSearchCachedResults(query);
    if (cachedIds) {
      this.displaySearchResults(cachedIds);
      this.lastDisplayedSequenceNumber = this.searchSequenceNumber;
    }

    const queryWithTransliteration = this.addTransliterationToQuery(query);
    this.pendingSearchQuery = query;
    this.sendSearchQuery(queryWithTransliteration, this.searchSequenceNumber);
  }

  private addTransliterationToQuery(query: string): string {
    const transliteratedQuery = query.split(' ').map(transliterateEnToRu).join(' ');

    if (transliteratedQuery === query) {
      return query;
    }

    return `${query} ${transliteratedQuery}`;
  }

  public legacySearchProducts(query: string): void {
    this.searchQuery$$.set(query);

    if (!query.trim()) {
      this.legacySearchResults$$.set([]);
      return;
    }

    const searchTerms = query
      .toLowerCase()
      .split(' ')
      .filter((term) => term.length > 0);

    const transliteratedTerms = query
      .split(' ')
      .filter((term) => term.length > 0)
      .map(transliterateEnToRu);

    const catalogue = this.catalogue$$();
    const allEntries = Object.values(catalogue);

    const results = allEntries.filter((food) => {
      const legacyNameLower = food.legacyName?.toLowerCase() || '';
      return (
        searchTerms.every((term) => legacyNameLower.includes(term)) ||
        transliteratedTerms.every((term) => legacyNameLower.includes(term))
      );
    });

    this.legacySearchResults$$.set(results);
  }

  private getSearchCachedResults(query: string): number[] | null {
    return this.searchCache[query] || null;
  }

  private setSearchCachedResults(query: string, ids: number[]): void {
    this.searchCache[query] = ids;
    this.saveSearchCacheToLocalStorage();
  }

  private sendSearchQuery(query: string, sequenceNumber: number): void {
    const message: SearchQueryWsMessage = {
      type: WebSocketMessageType.SEARCH_QUERY,
      query: query,
      sequenceNumber: sequenceNumber,
    };
    this.networkService.sendMessage(message);
  }

  private setupSearchWebSocketListener(): void {
    this.networkService.wsMessages$
      .pipe(filter((msg) => msg.type === WebSocketMessageType.SEARCH_RESULTS))
      .subscribe((msg) => {
        this.handleSearchResults(msg as SearchResultsWsMessage);
      });

    this.networkService.wsMessages$
      .pipe(filter((msg) => msg.type === WebSocketMessageType.CATALOGUE_ENTRY_SAVED))
      .subscribe((msg) => {
        this.handleCatalogueEntrySaved(msg as CatalogueEntrySavedWsMessage);
      });

    this.networkService.wsMessages$
      .pipe(filter((msg) => msg.type === WebSocketMessageType.CATALOGUE_IMAGE_GENERATED))
      .subscribe((msg) => {
        this.handleCatalogueImageGenerated(msg as CatalogueImageGeneratedWsMessage);
      });
  }

  private handleSearchResults(msg: SearchResultsWsMessage): void {
    const results = msg.payload.catalogueIds;
    const queryFromMessage = msg.payload.query;
    const sequenceFromMessage = msg.payload.sequenceNumber;

    if (!queryFromMessage) {
      return;
    }

    const cacheKey = queryFromMessage;
    const cachedIds = this.getSearchCachedResults(cacheKey);

    const currentQuery = this.searchQuery$$();
    const isCurrentSearch = queryFromMessage === currentQuery;

    if (!cachedIds || !this.arraysEqual(cachedIds, results)) {
      this.setSearchCachedResults(cacheKey, results);

      if (sequenceFromMessage > this.lastDisplayedSequenceNumber && isCurrentSearch) {
        this.displaySearchResults(results);
        this.lastDisplayedSequenceNumber = sequenceFromMessage;
      }
    }
  }

  private handleCatalogueEntrySaved(msg: CatalogueEntrySavedWsMessage): void {
    const entry = msg.payload;

    const updatedCatalogue = {
      ...this.catalogue$$(),
      [entry.id]: entry,
    };

    this.catalogue$$.set(updatedCatalogue);
    this.saveToLocalStorage(updatedCatalogue);
  }

  private handleCatalogueImageGenerated(msg: CatalogueImageGeneratedWsMessage): void {
    const catalogueId = msg.payload.catalogueId;
    const catalogue = this.catalogue$$();
    const existingEntry = catalogue[catalogueId];

    if (existingEntry) {
      const updatedEntry = {
        ...existingEntry,
        hasImage: true,
      };

      const updatedCatalogue = {
        ...catalogue,
        [catalogueId]: updatedEntry,
      };

      this.catalogue$$.set(updatedCatalogue);
      this.saveToLocalStorage(updatedCatalogue);

      const currentSearchResults = this.searchResults$$();
      const updatedSearchResults = currentSearchResults.map((item) => (item.id === catalogueId ? updatedEntry : item));
      this.searchResults$$.set(updatedSearchResults);

      const currentLegacyResults = this.legacySearchResults$$();
      const updatedLegacyResults = currentLegacyResults.map((item) => (item.id === catalogueId ? updatedEntry : item));
      this.legacySearchResults$$.set(updatedLegacyResults);
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

  public clearSearch(): void {
    this.searchQuery$$.set('');
    this.searchResults$$.set([]);
    this.legacySearchResults$$.set([]);
    this.searchSequenceNumber = 0;
    this.lastDisplayedSequenceNumber = 0;
  }

  public async generateProductPreview(description: string): Promise<ProductPreviewData> {
    try {
      const response = await firstValueFrom(
        this.http.post<ServerResponseProductPreview>('/api/food/generate-product-preview', { description }),
      );

      if (!response.result || !response.data) {
        throw new Error('Failed to generate product preview');
      }

      return response.data;
    } catch (error) {
      console.error('Failed to generate product preview:', error);
      throw error;
    }
  }

  public async saveProduct(productData: ProductSaveRequest): Promise<CatalogueEntry> {
    try {
      const response = await firstValueFrom(
        this.http.post<ServerResponseProductSave>('/api/food/save-product', productData),
      );

      if (!response.result || !response.data?.catalogueEntry) {
        throw new Error(response.error || 'Failed to save product');
      }

      const catalogueEntry = response.data.catalogueEntry;

      const updatedCatalogue = {
        ...this.catalogue$$(),
        [catalogueEntry.id]: catalogueEntry,
      };
      this.catalogue$$.set(updatedCatalogue);
      this.saveToLocalStorage(updatedCatalogue);

      return catalogueEntry;
    } catch (error: any) {
      console.error('Failed to save product:', error);
      throw error;
    }
  }
}
