import { computed, inject, Injectable, OnDestroy, signal, WritableSignal } from '@angular/core';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodProductHistoryService } from '@app/services/food/food-product-history.service';
import { CatalogueEntry, ProductHistoryEntry } from '@app/shared/types';
import { Subscription } from 'rxjs';

// Mirrors the backend cap on catalogueIds per product-history request (megaapp-back, plan 31).
export const MAX_TRACKED_PRODUCTS = 20;

// Scoped to FoodScreen (provided there, not root), same pattern as FoodScreenModeService — food-stats-columns
// remounts food-stats-product-history as a fresh instance whenever the layout crosses a column-count
// boundary (2↔3 stats columns) or the mobile view toggles diary↔stats accordion (see plan 31). A
// component-local signal would be wiped on every such remount; living here, on the FoodScreen-scoped
// injector, it survives both — only a full page reload (or leaving the food screen route) resets it.
@Injectable()
export class FoodProductHistoryStateService implements OnDestroy {
  private readonly foodProductHistoryService = inject(FoodProductHistoryService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);

  // Only the ids are stored: name and archive flag are read from the live catalogue, so a product renamed,
  // archived or restored meanwhile (here or on another device) shows its current state.
  private readonly trackedIds$$: WritableSignal<number[]> = signal([]);

  public readonly trackedProducts$$ = computed(() => {
    const catalogue = this.foodCatalogueService.catalogue$$();
    return this.trackedIds$$()
      .map((id) => catalogue[id])
      .filter((product): product is CatalogueEntry => Boolean(product));
  });
  public readonly entries$$: WritableSignal<ProductHistoryEntry[]> = signal([]);
  public readonly isLoading$$ = signal(false);
  public readonly error$$: WritableSignal<string | null> = signal(null);

  public readonly isLimitReached$$ = computed(() => this.trackedProducts$$().length >= MAX_TRACKED_PRODUCTS);

  public readonly productById$$ = computed(
    () => new Map(this.trackedProducts$$().map((product) => [product.id, product] as const)),
  );

  private activeRequestSub: Subscription | null = null;

  public ngOnDestroy(): void {
    this.activeRequestSub?.unsubscribe();
  }

  public addProduct(product: CatalogueEntry): void {
    const alreadyTracked = this.trackedIds$$().includes(product.id);
    if (alreadyTracked || this.isLimitReached$$()) return;

    this.trackedIds$$.update((ids) => [...ids, product.id]);
    this.reload();
  }

  public removeProduct(catalogueId: number): void {
    this.trackedIds$$.update((ids) => ids.filter((id) => id !== catalogueId));
    this.reload();
  }

  private reload(): void {
    this.activeRequestSub?.unsubscribe();
    this.error$$.set(null);

    const catalogueIds = this.trackedProducts$$().map((product) => product.id);
    if (catalogueIds.length === 0) {
      this.entries$$.set([]);
      this.isLoading$$.set(false);
      return;
    }

    this.isLoading$$.set(true);
    this.activeRequestSub = this.foodProductHistoryService.getProductHistory(catalogueIds).subscribe({
      next: (entries) => {
        this.entries$$.set(entries);
        this.isLoading$$.set(false);
      },
      error: () => {
        this.error$$.set('Не удалось загрузить историю продукта');
        this.isLoading$$.set(false);
      },
    });
  }
}
