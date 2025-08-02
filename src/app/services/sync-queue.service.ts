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
  private readonly maxRetries = BACKGROUND_SYNC_RETRIES_MAX;
  private readonly timeoutMs = BACKGROUND_SYNC_TIMEOUT_MS;

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
        const request$ = this.createRequest(operation);
        const response = await firstValueFrom(request$.pipe(timeout(this.timeoutMs)));

        if (operation.successCallback) {
          operation.successCallback(response);
        }

        this.queue.shift();
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= this.maxRetries) {
          console.error(`Operation failed after ${this.maxRetries} retries:`, error);

          if (operation.rollbackCallback) {
            operation.rollbackCallback();
          }

          this.queue.shift();

          break;
        } else {
          console.warn(`Operation failed, retry ${operation.retryCount}/${this.maxRetries}`);
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
