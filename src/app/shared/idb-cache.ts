const DB_NAME = 'megaapp-idb-cache';
const DB_VERSION = 2;
const STORE_NAME = 'kv';
const DIARY_DAYS_STORE_NAME = 'foodDiaryDays';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(DIARY_DAYS_STORE_NAME)) {
        db.createObjectStore(DIARY_DAYS_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error reading from IndexedDB for key "${key}":`, error);
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error(`Error writing to IndexedDB for key "${key}":`, error);
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error(`Error removing from IndexedDB for key "${key}":`, error);
  }
}

// Separate store, keyed directly by dateISO (lexicographically sortable) — unlike the single
// blob per key in `kv`, one row per day, so a single day's write never touches any other day,
// and a date range can be read with a native IDBKeyRange.bound cursor scan.

export async function idbPutDiaryDay<T>(dateISO: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DIARY_DAYS_STORE_NAME, 'readwrite');
      tx.objectStore(DIARY_DAYS_STORE_NAME).put(value, dateISO);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error(`Error writing diary day "${dateISO}" to IndexedDB:`, error);
  }
}

export async function idbGetDiaryDay<T>(dateISO: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(DIARY_DAYS_STORE_NAME, 'readonly');
      const request = tx.objectStore(DIARY_DAYS_STORE_NAME).get(dateISO);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error reading diary day "${dateISO}" from IndexedDB:`, error);
    return null;
  }
}

export async function idbClearDiaryDays(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DIARY_DAYS_STORE_NAME, 'readwrite');
      tx.objectStore(DIARY_DAYS_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error clearing diary days from IndexedDB:', error);
  }
}
