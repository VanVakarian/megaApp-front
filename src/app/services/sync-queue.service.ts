import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BACKGROUND_SYNC_RETRIES_MAX,
  BACKGROUND_SYNC_TIMEOUT_MS,
  NOTIFICATION_PENDING_DELAY_MS,
} from '@app/shared/const';
import { sleep } from '@app/shared/utils';
import { firstValueFrom, timeout } from 'rxjs';
import { NotificationService } from './notification.service';

export enum SyncOperationType {
  CREATE = 'create', // POST
  UPDATE = 'update', // PUT
  DELETE = 'delete', // DELETE
}

export interface SyncOperationFeedback {
  successMessage: string;
  errorMessage: string;
  pendingMessage?: string;
}

interface SyncOperation {
  type: SyncOperationType;
  endpoint: string;
  data: any;
  retryCount: number;
  successCallback?: (response: any) => void;
  rollbackCallback?: () => void;
  feedback?: SyncOperationFeedback;
  pendingTimeoutId?: ReturnType<typeof setTimeout> | null;
  pendingNotificationId?: string | null;
  // When true, skips the single-flight queue and runs immediately alongside
  // any other in-flight operation — for features where several edits can be
  // in the air at once (e.g. TIME drag/resize) and must not wait on each
  // other's retries. Defaults to false: unaffected callers keep the existing
  // serial behavior.
  concurrent?: boolean;
}

const DEFAULT_PENDING_MESSAGE = 'Сохраняю...';

@Injectable({
  providedIn: 'root',
})
export class SyncQueueService {
  private readonly queue: SyncOperation[] = [];
  private isProcessing = false;

  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  public reset(): void {
    for (const operation of this.queue) {
      this.resolvePendingFeedback(operation);
    }

    this.queue.length = 0;
    this.isProcessing = false;
  }

  public addOperation(operation: Omit<SyncOperation, 'retryCount'>): void {
    const fullOperation: SyncOperation = {
      ...operation,
      retryCount: 0,
    };

    // Scheduled at enqueue time, not at actual dispatch time — the queue is single-flight,
    // so an operation can sit queued behind another one for a while before it's even sent.
    if (fullOperation.feedback) {
      fullOperation.pendingTimeoutId = setTimeout(() => {
        fullOperation.pendingNotificationId = this.notificationService.addNotification(
          'warning',
          fullOperation.feedback!.pendingMessage ?? DEFAULT_PENDING_MESSAGE,
          { persistent: true },
        );
      }, NOTIFICATION_PENDING_DELAY_MS);
    }

    if (fullOperation.concurrent) {
      void this.runOperation(fullOperation);
      return;
    }

    this.queue.push(fullOperation);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      await this.runOperation(operation);
    }

    this.isProcessing = false;
  }

  private async runOperation(operation: SyncOperation): Promise<void> {
    while (true) {
      try {
        const response = await firstValueFrom(this.createRequest(operation).pipe(timeout(BACKGROUND_SYNC_TIMEOUT_MS)));

        this.resolvePendingFeedback(operation);
        operation.successCallback?.(response);

        if (operation.feedback) {
          this.notificationService.addNotification('success', operation.feedback.successMessage);
        }

        return;
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= BACKGROUND_SYNC_RETRIES_MAX) {
          console.error(`Operation failed after ${BACKGROUND_SYNC_RETRIES_MAX} retries:`, error);

          this.resolvePendingFeedback(operation);
          operation.rollbackCallback?.();

          if (operation.feedback) {
            this.notificationService.addNotification('error', operation.feedback.errorMessage);
          }

          return;
        }

        console.warn(`Operation failed, retry ${operation.retryCount}/${BACKGROUND_SYNC_RETRIES_MAX}`);
        await sleep(1000 * operation.retryCount);
      }
    }
  }

  private resolvePendingFeedback(operation: SyncOperation): void {
    if (operation.pendingTimeoutId) clearTimeout(operation.pendingTimeoutId);
    if (operation.pendingNotificationId) this.notificationService.removeNotification(operation.pendingNotificationId);
  }

  private createRequest(operation: SyncOperation) {
    const request$ = (() => {
      switch (operation.type) {
        case SyncOperationType.CREATE:
          return this.http.post(operation.endpoint, operation.data);
        case SyncOperationType.UPDATE:
          return this.http.put(operation.endpoint, operation.data);
        case SyncOperationType.DELETE:
          return this.http.delete(operation.endpoint);
      }
    })();

    return request$;
  }
}
