import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { catchError, firstValueFrom, timeout } from 'rxjs';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface QueueStatus {
  pending: number;
  processing: boolean;
  lastError: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SyncQueueService {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private readonly maxRetries = 3;
  private readonly timeoutMs = 5000;

  public queueStatus$$: WritableSignal<QueueStatus> = signal({
    pending: 0,
    processing: false,
    lastError: null,
  });

  constructor(private http: HttpClient) {}

  addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = this.generateId();
    const fullOperation: SyncOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(fullOperation);
    this.updateStatus();
    this.processQueue();

    return id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.updateStatus();

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        await this.executeOperation(operation);
        this.queue.shift();
        this.updateStatus({ lastError: null });
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= this.maxRetries) {
          console.error(`Operation ${operation.id} failed after ${this.maxRetries} retries:`, error);
          this.queue.shift();
          this.updateStatus({ lastError: `Failed to sync: ${error}` });

          break;
        } else {
          console.warn(`Operation ${operation.id} failed, retry ${operation.retryCount}/${this.maxRetries}`);
          await this.delay(1000 * operation.retryCount);
        }
      }
    }

    this.isProcessing = false;
    this.updateStatus();
  }

  private async executeOperation(operation: SyncOperation): Promise<any> {
    const request$ = this.createRequest(operation);

    return firstValueFrom(
      request$.pipe(
        timeout(this.timeoutMs),
        catchError((error) => {
          throw new Error(`Network error: ${error.message}`);
        }),
      ),
    );
  }

  private createRequest(operation: SyncOperation) {
    switch (operation.type) {
      case 'create':
        return this.http.post(operation.endpoint, operation.data);
      case 'update':
        return this.http.put(operation.endpoint, operation.data);
      case 'delete':
        return this.http.delete(operation.endpoint);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  rollbackOperation(operationId: string): SyncOperation | null {
    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index !== -1) {
      const operation = this.queue[index];
      this.queue.splice(index, 1);
      this.updateStatus();
      return operation;
    }
    return null;
  }

  clearQueue(): void {
    this.queue = [];
    this.updateStatus();
  }

  private updateStatus(partial?: Partial<QueueStatus>): void {
    this.queueStatus$$.set({
      pending: this.queue.length,
      processing: this.isProcessing,
      lastError: this.queueStatus$$().lastError,
      ...partial,
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
