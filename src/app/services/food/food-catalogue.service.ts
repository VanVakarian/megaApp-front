import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
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
  ServerResponseBasic,
  ServerResponseProductPreview,
  ServerResponseProductSave,
  ServerResponseWithData,
  WebSocketMessageType,
} from '@app/shared/types';
import { transliterateEnToRu } from '@app/shared/utils';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { PerformanceMetricsService } from '../performance-metrics.service';
import { SyncEngineService, SyncOperationError, SyncOperationMode, SyncOperationType } from '../sync-engine.service';
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
  private searchSequenceNumber: number = 0;
  private lastDisplayedSequenceNumber: number = 0;
  private searchStartedAt: number | null = null;

  protected getStorageKey(): string {
    return this.CATALOGUE_STORAGE_KEY;
  }

  private readonly authService = inject(AuthService);
  private readonly performanceMetrics = inject(PerformanceMetricsService);

  private readonly resetOnAuthLossEffect$$ = effect(() => {
    if (this.authService.sessionState$$() === AuthSessionState.Guest) {
      this.reset();
    }
  });

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncEngine: SyncEngineService,
  ) {
    super(http, localStorageService, networkService, syncEngine);
    this.loadCatalogueFromLocalStorage();
    this.loadSearchCacheFromLocalStorage();
    this.setupSearchWebSocketListener();
    this.networkService.connected$.subscribe(() => this.replaySearchQuery());
  }

  public reset(): void {
    this.catalogue$$.set({});
    this.searchQuery$$.set('');
    this.searchResults$$.set([]);
    this.isLegacySearch$$.set(false);
    this.legacySearchResults$$.set([]);
    this.searchCache = {};
    this.searchSequenceNumber = 0;
    this.lastDisplayedSequenceNumber = 0;
    this.searchStartedAt = null;
  }

  @exhaustRequest()
  public async getCatalogueEntries(): Promise<Catalogue> {
    const startedAt = performance.now();
    try {
      const response = await firstValueFrom(this.http.get<Catalogue>('/api/food/catalogue'));

      this.catalogue$$.set(response);
      this.saveToLocalStorage(response);
      this.performanceMetrics.record('food.catalogue_load', performance.now() - startedAt, {
        source: 'server',
        entries: Object.keys(response).length,
      });
      return response;
    } catch (error) {
      console.error('Failed getting catalogue entries:', error);
      this.performanceMetrics.record(
        'food.catalogue_load',
        performance.now() - startedAt,
        { source: 'server' },
        'error',
      );
      return {};
    }
  }

  private loadCatalogueFromLocalStorage(): void {
    const startedAt = performance.now();
    const savedCatalogue = this.loadFromLocalStorage<Catalogue>();
    if (savedCatalogue) {
      this.catalogue$$.set(savedCatalogue);
    }
    this.performanceMetrics.record('food.catalogue_load', performance.now() - startedAt, {
      source: 'cache',
      entries: savedCatalogue ? Object.keys(savedCatalogue).length : 0,
      hit: Boolean(savedCatalogue),
    });
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
    this.searchStartedAt = performance.now();

    const cachedIds = this.getSearchCachedResults(query);
    if (cachedIds) {
      this.displaySearchResults(cachedIds);
      this.lastDisplayedSequenceNumber = this.searchSequenceNumber;
      this.performanceMetrics.record('food.catalogue_search', performance.now() - this.searchStartedAt, {
        source: 'cache',
        queryLength: query.length,
        results: cachedIds.length,
      });
    }

    this.sendSearchQuery(query, this.searchSequenceNumber);
  }

  public legacySearchProducts(query: string): void {
    const startedAt = performance.now();
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
    this.performanceMetrics.record('food.catalogue_search', performance.now() - startedAt, {
      source: 'legacy',
      queryLength: query.length,
      results: results.length,
    });
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

  private replaySearchQuery(): void {
    const query = this.searchQuery$$().trim();
    if (!query || this.searchSequenceNumber === 0) return;
    this.sendSearchQuery(query, this.searchSequenceNumber);
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

    if (!cachedIds || !this.arraysEqual(cachedIds, results)) {
      this.setSearchCachedResults(cacheKey, results);

      if (sequenceFromMessage > this.lastDisplayedSequenceNumber) {
        this.displaySearchResults(results);
        this.lastDisplayedSequenceNumber = sequenceFromMessage;
      }
    }

    if (this.searchStartedAt !== null && queryFromMessage === this.searchQuery$$()) {
      this.performanceMetrics.record('food.catalogue_search', performance.now() - this.searchStartedAt, {
        source: 'remote',
        queryLength: queryFromMessage.length,
        results: results.length,
        displayed: sequenceFromMessage === this.lastDisplayedSequenceNumber,
      });
      this.searchStartedAt = null;
    }
  }

  private handleCatalogueEntrySaved(msg: CatalogueEntrySavedWsMessage): void {
    this.upsertCatalogueEntry(msg.payload);
  }

  private handleCatalogueImageGenerated(msg: CatalogueImageGeneratedWsMessage): void {
    const catalogueId = msg.payload.catalogueId;
    const imageVersion = msg.payload.imageVersion;
    const catalogue = this.catalogue$$();
    const existingEntry = catalogue[catalogueId];

    if (existingEntry) {
      const updatedEntry = {
        ...existingEntry,
        imageVersion,
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
      const savedCache = this.localStorageService.getUserScoped<Record<string, number[]>>(this.SEARCH_CACHE_KEY);
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
      this.localStorageService.setUserScoped(this.SEARCH_CACHE_KEY, this.searchCache);
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

  public saveProduct(productData: ProductSaveRequest): Promise<CatalogueEntry> {
    return new Promise<CatalogueEntry>((resolve, reject) => {
      this.addSyncOperation({
        mode: SyncOperationMode.NonOptimistic,
        type: SyncOperationType.CREATE, // always POST — save-product handles both create and update by body.id
        endpoint: '/api/food/save-product',
        data: productData,
        applyCallback: (response: ServerResponseProductSave) => {
          if (!response.result || !response.data?.catalogueEntry) {
            reject(new Error(response.error || 'Failed to save product'));
            return;
          }

          const catalogueEntry = response.data.catalogueEntry;
          this.upsertCatalogueEntry(catalogueEntry);
          resolve(catalogueEntry);
        },
        errorCallback: (error: SyncOperationError) => reject(error),
      });
    });
  }

  public async getProductById(catalogueId: number): Promise<CatalogueEntry> {
    try {
      const response = await firstValueFrom(
        this.http.get<ServerResponseWithData<CatalogueEntry>>(`/api/food/catalogue/${catalogueId}`),
      );

      if (!response.result || !response.data) {
        throw new Error('Failed to load product');
      }

      this.upsertCatalogueEntry(response.data);

      return response.data;
    } catch (error) {
      console.error('Failed to load product:', error);
      throw error;
    }
  }

  public deleteProduct(catalogueId: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.addSyncOperation({
        mode: SyncOperationMode.NonOptimistic,
        type: SyncOperationType.DELETE,
        endpoint: `/api/food/catalogue/${catalogueId}`,
        data: {},
        applyCallback: (response: ServerResponseBasic) => {
          if (!response.result) {
            reject(new Error('Failed to delete product'));
            return;
          }

          this.removeCatalogueEntry(catalogueId);
          resolve();
        },
        errorCallback: (error: SyncOperationError) => reject(error),
      });
    });
  }

  private upsertCatalogueEntry(entry: CatalogueEntry): void {
    const updatedCatalogue = {
      ...this.catalogue$$(),
      [entry.id]: entry,
    };

    this.catalogue$$.set(updatedCatalogue);
    this.saveToLocalStorage(updatedCatalogue);

    this.searchResults$$.update((results) => results.map((item) => (item.id === entry.id ? entry : item)));
    this.legacySearchResults$$.update((results) => results.map((item) => (item.id === entry.id ? entry : item)));
  }

  private removeCatalogueEntry(catalogueId: number): void {
    const updatedCatalogue = { ...this.catalogue$$() };
    delete updatedCatalogue[catalogueId];

    this.catalogue$$.set(updatedCatalogue);
    this.saveToLocalStorage(updatedCatalogue);

    this.searchResults$$.update((results) => results.filter((item) => item.id !== catalogueId));
    this.legacySearchResults$$.update((results) => results.filter((item) => item.id !== catalogueId));
  }

  public getSquircleImageUrl(catalogueId: number): string | undefined {
    const catalogueEntry = this.catalogue$$()[catalogueId];
    if (!catalogueEntry?.imageVersion) {
      return undefined;
    }
    return `/api/images/food/${catalogueId}-squircle-v${catalogueEntry.imageVersion}.png`;
  }

  public getCornerImageUrl(catalogueId: number): string | undefined {
    const catalogueEntry = this.catalogue$$()[catalogueId];
    if (!catalogueEntry?.imageVersion) {
      return undefined;
    }
    return `/api/images/food/${catalogueId}-corner-v${catalogueEntry.imageVersion}.png`;
  }
}
