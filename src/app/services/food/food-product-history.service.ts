import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ProductHistoryCursor, ProductHistoryPage, ServerResponseWithData } from '@app/shared/types';
import { map, Observable } from 'rxjs';

// Deliberately stateless and cache-free, unlike every other food service — the tracked-product
// set changes on every add/remove, so there is nothing worth caching between calls. Returns an
// Observable (not a Promise) specifically so callers can keep the Subscription and unsubscribe()
// to cancel an in-flight request for real when the tracked-product set changes again mid-flight.
@Injectable({ providedIn: 'root' })
export class FoodProductHistoryService {
  private readonly http = inject(HttpClient);

  public getProductHistory(
    catalogueIds: number[],
    cursor: ProductHistoryCursor | null,
    limit: number,
  ): Observable<ProductHistoryPage> {
    const params = new URLSearchParams({ catalogueIds: catalogueIds.join(','), limit: String(limit) });
    if (cursor) {
      params.set('cursorDate', cursor.dateISO);
      params.set('cursorId', String(cursor.id));
    }

    return this.http
      .get<ServerResponseWithData<ProductHistoryPage>>(`/api/food/product-history?${params.toString()}`)
      .pipe(map((response) => response.data));
  }
}
