import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { TimeEntry, TimeEntryCreateInput, TimeEntrySelectionInput, TimeEntryTimeInput } from '@app/shared/time-types';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { NotificationService } from '../notification.service';
import { SyncOperationType, SyncQueueService } from '../sync-queue.service';
import { BaseTimeService } from './time-base.service';

interface DataResponse<T> {
  success: boolean;
  data: T;
}

const TAIL_REFRESH_DAYS = 14;

export interface TimeDayLanes {
  primary: TimeEntry[];
  secondary: TimeEntry[];
}

@Injectable({
  providedIn: 'root',
})
export class TimeEntriesService extends BaseTimeService {
  private readonly ENTRIES_STORAGE_KEY = 'time_entries';

  public readonly entries$$: WritableSignal<TimeEntry[]> = signal([]);
  public readonly isLoaded$$: WritableSignal<boolean> = signal(false);

  // One computed index, recomputed only when entries$$ changes — rendering a
  // day-row looks this up in O(1) instead of filtering the whole array.
  public readonly entriesByDay$$: Signal<Map<string, TimeDayLanes>> = computed(() => this.buildDayIndex());

  protected getStorageKey(): string {
    return this.ENTRIES_STORAGE_KEY;
  }

  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  private readonly resetOnAuthLossEffect$$ = effect(() => {
    if (this.authService.sessionState$$() === AuthSessionState.Guest) {
      this.reset();
    }
  });

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.init();
  }

  public reset(): void {
    this.entries$$.set([]);
    this.isLoaded$$.set(false);
  }

  private init(): void {
    const cached = this.loadFromLocalStorage<TimeEntry[]>();
    if (cached) {
      this.entries$$.set(cached);
      this.isLoaded$$.set(true);
      void this.refreshTail();
      return;
    }
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<DataResponse<TimeEntry[]>>('/api/time/entries'));
      this.entries$$.set(response.data);
      this.saveToLocalStorage(response.data);
    } catch (error) {
      console.error('Failed loading time entries:', error);
    } finally {
      this.isLoaded$$.set(true);
    }
  }

  private async refreshTail(): Promise<void> {
    const cutoff = this.buildTailCutoff();
    try {
      const response = await firstValueFrom(
        this.http.get<DataResponse<TimeEntry[]>>(`/api/time/entries?start=${encodeURIComponent(cutoff)}`),
      );
      const merged = [...this.entries$$().filter((entry) => entry.startAt < cutoff), ...response.data];
      this.entries$$.set(merged);
      this.saveToLocalStorage(merged);
    } catch (error) {
      console.error('Failed refreshing time entries tail:', error);
    }
  }

  private buildTailCutoff(): string {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TAIL_REFRESH_DAYS);
    const isoDate = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;
    return `${isoDate}T00:00:00`;
  }

  private buildDayIndex(): Map<string, TimeDayLanes> {
    const index = new Map<string, TimeDayLanes>();
    for (const entry of this.entries$$()) {
      const dayIso = entry.startAt.slice(0, 10);
      let lanes = index.get(dayIso);
      if (!lanes) {
        lanes = { primary: [], secondary: [] };
        index.set(dayIso, lanes);
      }
      lanes[entry.track].push(entry);
    }
    return index;
  }

  public createEntry(input: TimeEntryCreateInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — entry not saved');
      return;
    }

    const tempId = -Date.now();
    const optimisticEntry: TimeEntry = {
      ...input,
      id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.entries$$.update((entries) => [...entries, optimisticEntry]);
    this.saveToLocalStorage(this.entries$$());

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/entries',
      data: input,
      concurrent: true,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.entries$$.update((entries) =>
          entries.map((entry) => (entry.id === tempId ? { ...entry, id: response.data.id } : entry)),
        );
        this.saveToLocalStorage(this.entries$$());
      },
      rollbackCallback: () => {
        this.entries$$.update((entries) => entries.filter((entry) => entry.id !== tempId));
        this.saveToLocalStorage(this.entries$$());
      },
      feedback: {
        successMessage: 'Entry saved',
        errorMessage: 'Failed to save entry',
        pendingMessage: 'Saving entry...',
      },
    });
  }

  // Drag/resize/move — touches only track/startAt/endAt. Rollback restores
  // just those fields on this one entry by id, so a concurrent selection
  // update on the same entry (see updateEntrySelection) is never clobbered.
  public updateEntryTime(entryId: number, input: TimeEntryTimeInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.entries$$().find((entry) => entry.id === entryId);
    if (!previous) return;
    const previousTime: TimeEntryTimeInput = {
      track: previous.track,
      startAt: previous.startAt,
      endAt: previous.endAt,
    };

    this.entries$$.update((entries) =>
      entries.map((entry) => (entry.id === entryId ? { ...entry, ...input, updatedAt: new Date().toISOString() } : entry)),
    );
    this.saveToLocalStorage(this.entries$$());

    this.addSyncOperation({
      type: SyncOperationType.PATCH,
      endpoint: `/api/time/entries/${entryId}/time`,
      data: input,
      concurrent: true,
      rollbackCallback: () => {
        this.entries$$.update((entries) =>
          entries.map((entry) => (entry.id === entryId ? { ...entry, ...previousTime } : entry)),
        );
        this.saveToLocalStorage(this.entries$$());
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  // Picker create/edit — touches only activityKindId/options. Rollback
  // restores just those fields, leaving track/startAt/endAt (possibly since
  // moved by a concurrent drag) untouched.
  public updateEntrySelection(entryId: number, input: TimeEntrySelectionInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.entries$$().find((entry) => entry.id === entryId);
    if (!previous) return;
    const previousSelection: TimeEntrySelectionInput = {
      activityKindId: previous.activityKindId,
      options: previous.options,
    };

    this.entries$$.update((entries) =>
      entries.map((entry) => (entry.id === entryId ? { ...entry, ...input, updatedAt: new Date().toISOString() } : entry)),
    );
    this.saveToLocalStorage(this.entries$$());

    this.addSyncOperation({
      type: SyncOperationType.PATCH,
      endpoint: `/api/time/entries/${entryId}/selection`,
      data: input,
      concurrent: true,
      rollbackCallback: () => {
        this.entries$$.update((entries) =>
          entries.map((entry) => (entry.id === entryId ? { ...entry, ...previousSelection } : entry)),
        );
        this.saveToLocalStorage(this.entries$$());
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public deleteEntry(entryId: number): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — entry not deleted');
      return;
    }

    const previous = this.entries$$().find((entry) => entry.id === entryId);
    if (!previous) return;

    this.entries$$.update((entries) => entries.filter((entry) => entry.id !== entryId));
    this.saveToLocalStorage(this.entries$$());

    this.addSyncOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/time/entries/${entryId}`,
      data: null,
      concurrent: true,
      rollbackCallback: () => {
        this.entries$$.update((entries) =>
          entries.some((entry) => entry.id === entryId) ? entries : [...entries, previous],
        );
        this.saveToLocalStorage(this.entries$$());
      },
      feedback: {
        successMessage: 'Entry deleted',
        errorMessage: 'Failed to delete entry',
        pendingMessage: 'Deleting entry...',
      },
    });
  }
}
