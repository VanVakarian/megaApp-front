import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { LocalStorageService } from '@app/services/local-storage.service';
import { NetworkService } from '@app/services/network.service';
import { SyncEngineService } from '@app/services/sync-engine.service';
import { TelemetryService } from '@app/services/telemetry.service';
import { CatalogueEntry, WebSocketMessageType } from '@app/shared/types';
import { Subject } from 'rxjs';
import { FoodCatalogueService } from './food-catalogue.service';

const SEARCH_CACHE_KEY = 'food_search_cache';

function entry(id: number, name: string, archived?: boolean): CatalogueEntry {
  return {
    id,
    name,
    legacyName: name,
    kcals: 100,
    protein: 1,
    fat: 1,
    carbs: 1,
    fiber: 1,
    description: name,
    archived,
  };
}

function setup() {
  const wsMessages$ = new Subject<any>();
  const sendMessage = vi.fn();
  const setUserScoped = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: NetworkService, useValue: { wsMessages$, connected$: new Subject<void>(), sendMessage } },
      { provide: SyncEngineService, useValue: { addOperation: vi.fn() } },
      { provide: LocalStorageService, useValue: { getUserScoped: vi.fn(() => null), setUserScoped } },
      { provide: AuthService, useValue: { sessionState$$: signal(AuthSessionState.Authenticated) } },
      { provide: TelemetryService, useValue: { record: vi.fn(), recordAfterPaint: vi.fn(() => Promise.resolve()) } },
    ],
  });

  const service = TestBed.inject(FoodCatalogueService);
  service.catalogue$$.set({
    1: entry(1, 'Apple'),
    2: entry(2, 'Apple pie'),
    3: entry(3, 'Old apple', true),
  });

  const reply = (payload: { archived?: boolean; catalogueIds: number[]; sequenceNumber: number }) =>
    wsMessages$.next({
      type: WebSocketMessageType.SEARCH_RESULTS,
      payload: { query: 'apple', timestamp: 0, ...payload },
    });
  const searchCacheWrites = () => setUserScoped.mock.calls.filter(([key]) => key === SEARCH_CACHE_KEY);
  const ids = () => service.searchResults$$().map((item) => item.id);

  return { service, wsMessages$, sendMessage, reply, searchCacheWrites, ids };
}

describe('FoodCatalogueService archive search', () => {
  it('shows only regular products in the normal mode, dropping archived ids from a reply', () => {
    const { service, sendMessage, reply, ids } = setup();

    service.searchProducts('apple');
    reply({ catalogueIds: [1, 3, 2], sequenceNumber: 1 });

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ query: 'apple', archived: false }));
    expect(ids()).toEqual([1, 2]);
  });

  it('asks the server for the archive mode and shows only archived products', () => {
    const { service, sendMessage, reply, ids } = setup();

    service.toggleArchiveSearch();
    service.searchProducts('apple');
    reply({ archived: true, catalogueIds: [3, 1], sequenceNumber: 1 });

    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'apple', archived: true }));
    expect(ids()).toEqual([3]);
  });

  it('neither reads nor writes the results cache in the archive mode', () => {
    const { service, reply, searchCacheWrites, ids } = setup();

    service.searchProducts('apple');
    reply({ catalogueIds: [1, 2], sequenceNumber: 1 });
    expect(searchCacheWrites()).toHaveLength(1);

    service.toggleArchiveSearch();
    service.searchProducts('apple');
    expect(ids()).toEqual([]); // the cached normal ids are not shown under the archive mode

    reply({ archived: true, catalogueIds: [3], sequenceNumber: 2 });
    expect(ids()).toEqual([3]);
    expect(searchCacheWrites()).toHaveLength(1);
  });

  it('ignores a reply that was applied in a mode other than the one on screen', () => {
    const { service, reply, ids } = setup();

    service.toggleArchiveSearch();
    service.searchProducts('apple');
    reply({ archived: false, catalogueIds: [1, 2], sequenceNumber: 1 }); // the server fell back to normal

    expect(ids()).toEqual([]);
  });

  it('keeps caching the normal reply that arrives after the user switched to the archive mode', () => {
    const { service, reply, searchCacheWrites, ids } = setup();

    service.searchProducts('apple');
    service.toggleArchiveSearch();
    service.searchProducts('apple');
    reply({ archived: false, catalogueIds: [1, 2], sequenceNumber: 1 });

    expect(searchCacheWrites()).toHaveLength(1);
    expect(ids()).toEqual([]);
  });

  it('excludes archived products from the legacy search', () => {
    const { service } = setup();

    service.legacySearchProducts('apple');

    expect(service.legacySearchResults$$().map((item) => item.id)).toEqual([1, 2]);
  });

  it('keeps the legacy and archive modes mutually exclusive', () => {
    const { service } = setup();

    service.toggleLegacySearch();
    service.toggleArchiveSearch();
    expect(service.isLegacySearch$$()).toBe(false);
    expect(service.isArchiveSearch$$()).toBe(true);

    service.toggleLegacySearch();
    expect(service.isLegacySearch$$()).toBe(true);
    expect(service.isArchiveSearch$$()).toBe(false);
  });

  it('drops a product from the archive results when another client restores it', () => {
    const { service, wsMessages$, reply, ids } = setup();

    service.toggleArchiveSearch();
    service.searchProducts('apple');
    reply({ archived: true, catalogueIds: [3], sequenceNumber: 1 });
    expect(ids()).toEqual([3]);

    wsMessages$.next({ type: WebSocketMessageType.CATALOGUE_ENTRY_SAVED, payload: entry(3, 'Old apple', false) });

    expect(ids()).toEqual([]);
  });

  it('drops a product from the normal results when another client archives it', () => {
    const { service, wsMessages$, reply, ids } = setup();

    service.searchProducts('apple');
    reply({ catalogueIds: [1, 2], sequenceNumber: 1 });

    wsMessages$.next({ type: WebSocketMessageType.CATALOGUE_ENTRY_SAVED, payload: entry(2, 'Apple pie', true) });

    expect(ids()).toEqual([1]);
  });

  it('starts every modal session outside the archive mode', () => {
    const { service } = setup();

    service.toggleArchiveSearch();
    service.setArchiveSearch(false);

    expect(service.isArchiveSearch$$()).toBe(false);
  });
});
