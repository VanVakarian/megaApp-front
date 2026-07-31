import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BACKGROUND_SYNC_RETRIES_MAX,
  BACKGROUND_SYNC_TIMEOUT_MS,
  NOTIFICATION_PENDING_DELAY_MS,
} from '@app/shared/const';
import { sleep } from '@app/shared/utils';
import { firstValueFrom, timeout } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';

export const SyncOperationType = {
  CREATE: 'create', // POST
  UPDATE: 'update', // PUT
  DELETE: 'delete', // DELETE
} as const;

export type SyncOperationType = (typeof SyncOperationType)[keyof typeof SyncOperationType];

export const SyncOperationMode = {
  // Caller already changed local state before enqueueing. On final failure the engine calls
  // rollbackCallback to undo it; on success it calls successCallback with the server response
  // to reconcile (e.g. swap a temp id for the real one).
  Optimistic: 'optimistic',
  // Caller hasn't changed anything yet. The engine calls applyCallback with the server response
  // only once the request actually succeeds; on final failure it calls errorCallback — there is
  // nothing to roll back because nothing was applied.
  NonOptimistic: 'non-optimistic',
} as const;

export type SyncOperationMode = (typeof SyncOperationMode)[keyof typeof SyncOperationMode];

export interface SyncOperationFeedback {
  successMessage: string;
  errorMessage: string;
  pendingMessage?: string;
}

interface SyncOperationRequest {
  type: SyncOperationType;
  endpoint: string;
  data: any;
  feedback?: SyncOperationFeedback;
}

export interface OptimisticSyncOperation extends SyncOperationRequest {
  mode: typeof SyncOperationMode.Optimistic;
  successCallback?: (response: any) => void;
  rollbackCallback?: () => void;
}

export interface NonOptimisticSyncOperation extends SyncOperationRequest {
  mode: typeof SyncOperationMode.NonOptimistic;
  applyCallback?: (response: any) => void;
  errorCallback?: () => void;
}

export type SyncOperationInput = OptimisticSyncOperation | NonOptimisticSyncOperation;

interface QueuedOperation extends SyncOperationRequest {
  operationId: string;
  retryCount: number;
  onSuccess?: (response: any) => void;
  onFailure?: () => void;
  pendingTimeoutId?: ReturnType<typeof setTimeout> | null;
  pendingNotificationId?: string | null;
}

// The minimum needed to resend a request after a page reload: no callbacks (unserializable, and
// pointless anyway — a reload always re-fetches a fresh snapshot before this matters, see
// restorePendingOperation) and no feedback (a restored resend is silent, not a fresh user action).
interface PersistedOperation {
  type: SyncOperationType;
  endpoint: string;
  data: any;
  operationId: string;
}

const DEFAULT_PENDING_MESSAGE = 'Сохраняю...';
const PENDING_OPERATION_STORAGE_KEY = 'sync_pending_operation';

@Injectable({
  providedIn: 'root',
})
export class SyncEngineService {
  private readonly queue: QueuedOperation[] = [];
  private isProcessing = false;

  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly localStorageService = inject(LocalStorageService);

  public reset(): void {
    for (const operation of this.queue) {
      this.resolvePendingFeedback(operation);
    }

    this.queue.length = 0;
    this.isProcessing = false;
    this.clearPersistedOperation();
  }

  public addOperation(operation: SyncOperationInput): void {
    const { onSuccess, onFailure } =
      operation.mode === SyncOperationMode.Optimistic
        ? { onSuccess: operation.successCallback, onFailure: operation.rollbackCallback }
        : { onSuccess: operation.applyCallback, onFailure: operation.errorCallback };

    const queuedOperation: QueuedOperation = {
      type: operation.type,
      endpoint: operation.endpoint,
      data: operation.data,
      feedback: operation.feedback,
      operationId: crypto.randomUUID(),
      retryCount: 0,
      onSuccess,
      onFailure,
    };

    // Scheduled at enqueue time, not at actual dispatch time — the queue is single-flight,
    // so an operation can sit queued behind another one for a while before it's even sent.
    if (queuedOperation.feedback) {
      queuedOperation.pendingTimeoutId = setTimeout(() => {
        queuedOperation.pendingNotificationId = this.notificationService.addNotification(
          'warning',
          queuedOperation.feedback!.pendingMessage ?? DEFAULT_PENDING_MESSAGE,
          { persistent: true },
        );
      }, NOTIFICATION_PENDING_DELAY_MS);
    }

    this.enqueue(queuedOperation);
  }

  // Resends an operation that was already sent to the server before the last reload but never
  // confirmed, reusing the same operationId. The backend's idempotency check then either replays
  // the cached result (server had already applied it) or applies it for the first time (it
  // hadn't) — either way this converges to the right state without duplicating anything.
  // No callbacks are restored: whichever domain service owns this operation re-fetches a fresh
  // snapshot from the server on startup regardless, so by the time this resend resolves there is
  // no local optimistic state left to reconcile or roll back — the fresh snapshot already covers it.
  public restorePendingOperation(): void {
    const persisted = this.localStorageService.getUserScoped<PersistedOperation>(PENDING_OPERATION_STORAGE_KEY);
    if (!persisted) return;

    this.enqueue({
      type: persisted.type,
      endpoint: persisted.endpoint,
      data: persisted.data,
      operationId: persisted.operationId,
      retryCount: 0,
    });
  }

  private enqueue(operation: QueuedOperation): void {
    this.queue.push(operation);
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

  private async runOperation(operation: QueuedOperation): Promise<void> {
    // Persisted once, before the first attempt — not re-persisted on each retry, since retries of
    // the same operation share the same type/endpoint/data/operationId anyway.
    this.persistInFlight(operation);

    while (true) {
      try {
        const response = await firstValueFrom(this.createRequest(operation).pipe(timeout(BACKGROUND_SYNC_TIMEOUT_MS)));

        this.clearPersistedOperation();
        this.resolvePendingFeedback(operation);
        operation.onSuccess?.(response);

        if (operation.feedback) {
          this.notificationService.addNotification('success', operation.feedback.successMessage);
        }

        return;
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= BACKGROUND_SYNC_RETRIES_MAX) {
          console.error(`Operation failed after ${BACKGROUND_SYNC_RETRIES_MAX} retries:`, error);

          this.clearPersistedOperation();
          this.resolvePendingFeedback(operation);
          operation.onFailure?.();

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

  private persistInFlight(operation: QueuedOperation): void {
    const persisted: PersistedOperation = {
      type: operation.type,
      endpoint: operation.endpoint,
      data: operation.data,
      operationId: operation.operationId,
    };
    this.localStorageService.setUserScoped(PENDING_OPERATION_STORAGE_KEY, persisted);
  }

  private clearPersistedOperation(): void {
    this.localStorageService.removeUserScoped(PENDING_OPERATION_STORAGE_KEY);
  }

  private resolvePendingFeedback(operation: QueuedOperation): void {
    if (operation.pendingTimeoutId) clearTimeout(operation.pendingTimeoutId);
    if (operation.pendingNotificationId) this.notificationService.removeNotification(operation.pendingNotificationId);
  }

  private createRequest(operation: QueuedOperation) {
    const body = { ...operation.data, operationId: operation.operationId };

    switch (operation.type) {
      case SyncOperationType.CREATE:
        return this.http.post(operation.endpoint, body);
      case SyncOperationType.UPDATE:
        return this.http.put(operation.endpoint, body);
      case SyncOperationType.DELETE:
        return this.http.delete(operation.endpoint, { body });
    }
  }
}
