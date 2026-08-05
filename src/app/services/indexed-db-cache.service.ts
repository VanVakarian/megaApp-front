import { Injectable } from '@angular/core';
import { buildCacheKey } from '@app/shared/cache';
import {
  idbClearAllUserScopedKvEntries,
  idbClearDays,
  idbGet,
  idbGetDay,
  idbRemove,
  idbSet,
  idbSetDay,
} from '@app/shared/idb-cache';

@Injectable({
  providedIn: 'root',
})
export class IndexedDbCacheService {
  public get<T>(baseKey: string): Promise<T | null> {
    return idbGet<T>(buildCacheKey(baseKey));
  }

  public set<T>(baseKey: string, value: T): Promise<void> {
    return idbSet<T>(buildCacheKey(baseKey), value);
  }

  public remove(baseKey: string): Promise<void> {
    return idbRemove(buildCacheKey(baseKey));
  }

  public getDay<T>(dateISO: string): Promise<T | null> {
    return idbGetDay<T>(dateISO);
  }

  public setDay<T>(dateISO: string, value: T): Promise<void> {
    return idbSetDay<T>(dateISO, value);
  }

  public clearDays(): Promise<void> {
    return idbClearDays();
  }

  public clearAllUserScoped(): Promise<void> {
    return idbClearAllUserScopedKvEntries();
  }
}
