import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BACKGROUND_SYNC_RETRIES_MAX, BACKGROUND_SYNC_TIMEOUT_MS } from '@app/shared/const';
import { firstValueFrom, timeout } from 'rxjs';

export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

interface SyncOperation {
  type: SyncOperationType;
  endpoint: string;
  data: any;
  retryCount: number;
  successCallback?: (response: any) => void;
  rollbackCallback?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class SyncQueueService {
  private queue: SyncOperation[] = [];
  private isProcessing = false;

  constructor(private http: HttpClient) {}

  public addOperation(operation: Omit<SyncOperation, 'retryCount'>): void {
    const fullOperation: SyncOperation = {
      ...operation,
      retryCount: 0,
    };

    this.queue.push(fullOperation);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        const response = await firstValueFrom(this.createRequest(operation).pipe(timeout(BACKGROUND_SYNC_TIMEOUT_MS)));

        if (operation.successCallback) {
          operation.successCallback(response);
        }

        this.queue.shift();
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= BACKGROUND_SYNC_RETRIES_MAX) {
          console.error(`Operation failed after ${BACKGROUND_SYNC_RETRIES_MAX} retries:`, error);

          if (operation.rollbackCallback) {
            operation.rollbackCallback();
          }

          this.queue.shift();

          break;
        } else {
          console.warn(`Operation failed, retry ${operation.retryCount}/${BACKGROUND_SYNC_RETRIES_MAX}`);
          await this.delay(1000 * operation.retryCount);
        }
      }
    }

    this.isProcessing = false;
  }

  private createRequest(operation: SyncOperation) {
    switch (operation.type) {
      case SyncOperationType.CREATE:
        return this.http.post(operation.endpoint, operation.data);
      case SyncOperationType.UPDATE:
        return this.http.put(operation.endpoint, operation.data);
      case SyncOperationType.DELETE:
        return this.http.delete(operation.endpoint);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
