import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Catalogue, CatalogueEntry } from '@app/shared/types';
import { of } from 'rxjs';
import { FoodCatalogueService } from './food-catalogue.service';
import { FoodProductHistoryService } from './food-product-history.service';
import { FoodProductHistoryStateService, MAX_TRACKED_PRODUCTS } from './food-product-history-state.service';

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
  const catalogue$$ = signal<Catalogue>({
    1: entry(1, 'Шаурма'),
    2: entry(2, 'Чипсы', true),
  });
  const getProductHistory = vi.fn(() => of([]));
  TestBed.configureTestingModule({
    providers: [
      FoodProductHistoryStateService,
      { provide: FoodCatalogueService, useValue: { catalogue$$ } },
      { provide: FoodProductHistoryService, useValue: { getProductHistory } },
    ],
  });
  return { state: TestBed.inject(FoodProductHistoryStateService), catalogue$$, getProductHistory };
}

describe('FoodProductHistoryStateService', () => {
  it('requests the history of the tracked ids, once per change', () => {
    const { state, getProductHistory } = setup();

    state.addProduct(entry(1, 'Шаурма'));
    state.addProduct(entry(2, 'Чипсы', true));
    state.removeProduct(1);

    expect(getProductHistory.mock.calls).toEqual([[[1]], [[1, 2]], [[2]]]);
  });

  it('tracks a product once', () => {
    const { state, getProductHistory } = setup();

    state.addProduct(entry(1, 'Шаурма'));
    state.addProduct(entry(1, 'Шаурма'));

    expect(state.trackedProducts$$().map((product) => product.id)).toEqual([1]);
    expect(getProductHistory).toHaveBeenCalledTimes(1);
  });

  it('stops tracking at the limit', () => {
    const { state, catalogue$$ } = setup();
    const products = Array.from({ length: MAX_TRACKED_PRODUCTS + 1 }, (_, index) =>
      entry(index + 1, `Продукт ${index}`),
    );
    catalogue$$.set(Object.fromEntries(products.map((product) => [product.id, product])));

    products.forEach((product) => state.addProduct(product));

    expect(state.trackedProducts$$()).toHaveLength(MAX_TRACKED_PRODUCTS);
    expect(state.isLimitReached$$()).toBe(true);
  });

  it('shows the current name and archive flag of a tracked product from the live catalogue', () => {
    const { state, catalogue$$ } = setup();
    state.addProduct(entry(1, 'Шаурма'));

    catalogue$$.update((catalogue) => ({ ...catalogue, 1: entry(1, 'Шаурма куриная', true) }));

    expect(state.productById$$().get(1)).toMatchObject({ name: 'Шаурма куриная', archived: true });
  });

  it('drops a product that left the catalogue from the tracked list', () => {
    const { state, catalogue$$ } = setup();
    state.addProduct(entry(1, 'Шаурма'));
    state.addProduct(entry(2, 'Чипсы', true));

    catalogue$$.update(({ 1: _removed, ...rest }) => rest);

    expect(state.trackedProducts$$().map((product) => product.id)).toEqual([2]);
  });
});
