import { computed, inject, Injectable, OnDestroy, signal, WritableSignal } from '@angular/core';
import { FoodProductHistoryService } from '@app/services/food/food-product-history.service';
import { CatalogueEntry, ProductHistoryCursor, ProductHistoryEntry } from '@app/shared/types';
import { Subscription } from 'rxjs';

const PAGE_SIZE = 30;

// Scoped to FoodScreen (provided there, not root), same pattern as FoodScreenModeService — food-stats-columns
// remounts food-stats-product-history as a fresh instance whenever the layout crosses a column-count
// boundary (2↔3 stats columns) or the mobile view toggles diary↔stats accordion (see plan 31). A
// component-local signal would be wiped on every such remount; living here, on the FoodScreen-scoped
// injector, it survives both — only a full page reload (or leaving the food screen route) resets it.
@Injectable()
export class FoodProductHistoryStateService implements OnDestroy {
  private readonly foodProductHistoryService = inject(FoodProductHistoryService);

  public readonly trackedProducts$$: WritableSignal<CatalogueEntry[]> = signal([]);
  public readonly entries$$: WritableSignal<ProductHistoryEntry[]> = signal([]);
  public readonly isLoading$$ = signal(false);
  public readonly isLoadingMore$$ = signal(false);
  public readonly error$$: WritableSignal<string | null> = signal(null);

  public readonly productNameById$$ = computed(() => {
    const map = new Map<number, string>();
    for (const product of this.trackedProducts$$()) {
      map.set(product.id, product.name);
    }
    return map;
  });

  private nextCursor: ProductHistoryCursor | null = null;
  private activeRequestSub: Subscription | null = null;

  public ngOnDestroy(): void {
    this.activeRequestSub?.unsubscribe();
  }

  public addProduct(product: CatalogueEntry): void {
    const alreadyTracked = this.trackedProducts$$().some((tracked) => tracked.id === product.id);
    if (alreadyTracked) return;

    this.trackedProducts$$.update((products) => [...products, product]);
    this.reload();
  }

  public removeProduct(catalogueId: number): void {
    this.trackedProducts$$.update((products) => products.filter((product) => product.id !== catalogueId));
    this.reload();
  }

  public loadMore(): void {
    if (this.isLoading$$() || this.isLoadingMore$$() || !this.nextCursor) return;

    const catalogueIds = this.trackedProducts$$().map((product) => product.id);
    if (catalogueIds.length === 0) return;

    this.isLoadingMore$$.set(true);
    this.activeRequestSub = this.foodProductHistoryService
      .getProductHistory(catalogueIds, this.nextCursor, PAGE_SIZE)
      .subscribe({
        next: (page) => {
          this.entries$$.update((entries) => [...entries, ...page.entries]);
          this.nextCursor = page.nextCursor ?? null;
          this.isLoadingMore$$.set(false);
        },
        error: () => {
          this.error$$.set('Не удалось загрузить следующую страницу');
          this.isLoadingMore$$.set(false);
        },
      });
  }

  private reload(): void {
    this.activeRequestSub?.unsubscribe();
    this.nextCursor = null;
    this.error$$.set(null);

    const catalogueIds = this.trackedProducts$$().map((product) => product.id);
    if (catalogueIds.length === 0) {
      this.entries$$.set([]);
      this.isLoading$$.set(false);
      return;
    }

    this.isLoading$$.set(true);
    this.activeRequestSub = this.foodProductHistoryService.getProductHistory(catalogueIds, null, PAGE_SIZE).subscribe({
      next: (page) => {
        this.entries$$.set(page.entries);
        this.nextCursor = page.nextCursor ?? null;
        this.isLoading$$.set(false);
      },
      error: () => {
        this.error$$.set('Не удалось загрузить историю продукта');
        this.isLoading$$.set(false);
      },
    });
  }
}
