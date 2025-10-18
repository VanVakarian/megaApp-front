import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncOperationType, SyncQueueService } from '../sync-queue.service';

@Injectable()
export abstract class BaseFoodService {
  protected abstract getStorageKey(): string;

  constructor(
    protected readonly http: HttpClient,
    protected readonly localStorageService: LocalStorageService,
    protected readonly networkService: NetworkService,
    protected readonly syncQueueService: SyncQueueService,
  ) {}

  protected saveToLocalStorage<T>(data: T): void {
    this.localStorageService.set(this.getStorageKey(), data);
  }

  protected loadFromLocalStorage<T>(): T | null {
    return this.localStorageService.get<T>(this.getStorageKey());
  }

  protected checkNetworkAvailability(): boolean {
    return this.networkService.isNetworkAvailable$$();
  }

  protected addSyncOperation(operation: {
    type: SyncOperationType;
    endpoint: string;
    data: any;
    successCallback?: (response: any) => void;
    rollbackCallback?: () => void;
  }): void {
    this.syncQueueService.addOperation(operation);
  }
}
