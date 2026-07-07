import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import {
  ActivityKind,
  ActivityKindInput,
  Catalog,
  CategoryGroup,
  CategoryGroupInput,
  CategoryGroupKind,
  CategoryOption,
  CategoryOptionInput,
} from '@app/shared/time-types';
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

@Injectable({
  providedIn: 'root',
})
export class TimeCatalogueService extends BaseTimeService {
  private readonly CATALOGUE_STORAGE_KEY = 'time_catalogue';

  public readonly activityKinds$$: WritableSignal<ActivityKind[]> = signal([]);
  public readonly categoryGroups$$: WritableSignal<CategoryGroup[]> = signal([]);
  public readonly categoryOptions$$: WritableSignal<CategoryOption[]> = signal([]);

  public readonly activityKindById$$: Signal<Map<number, ActivityKind>> = computed(
    () => new Map(this.activityKinds$$().map((kind) => [kind.id, kind])),
  );
  public readonly groupById$$: Signal<Map<number, CategoryGroup>> = computed(
    () => new Map(this.categoryGroups$$().map((group) => [group.id, group])),
  );
  public readonly areaGroupId$$: Signal<number | null> = computed(
    () => this.categoryGroups$$().find((group) => group.kind === CategoryGroupKind.Area && !group.isArchived)?.id ?? null,
  );
  public readonly optionById$$: Signal<Map<number, CategoryOption>> = computed(
    () => new Map(this.categoryOptions$$().map((option) => [option.id, option])),
  );
  public readonly optionsByGroupId$$: Signal<Map<number, CategoryOption[]>> = computed(() => {
    const index = new Map<number, CategoryOption[]>();
    for (const option of this.categoryOptions$$()) {
      const list = index.get(option.groupId);
      if (list) {
        list.push(option);
      } else {
        index.set(option.groupId, [option]);
      }
    }
    return index;
  });
  public readonly applicableGroupsByKindId$$: Signal<Map<number, number[]>> = computed(() => {
    const index = new Map<number, number[]>();
    for (const kind of this.activityKinds$$()) {
      index.set(kind.id, kind.groupBindings.map((binding) => binding.groupId));
    }
    return index;
  });
  public readonly requiredGroupIdsByKindId$$: Signal<Map<number, Set<number>>> = computed(() => {
    const index = new Map<number, Set<number>>();
    for (const kind of this.activityKinds$$()) {
      index.set(kind.id, new Set(kind.groupBindings.filter((binding) => binding.required).map((binding) => binding.groupId)));
    }
    return index;
  });

  protected getStorageKey(): string {
    return this.CATALOGUE_STORAGE_KEY;
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
    this.loadFromCache();
    void this.refreshFromServer();
  }

  public reset(): void {
    this.activityKinds$$.set([]);
    this.categoryGroups$$.set([]);
    this.categoryOptions$$.set([]);
  }

  private loadFromCache(): void {
    const cached = this.loadFromLocalStorage<Catalog>();
    if (cached) {
      this.activityKinds$$.set(cached.activityKinds);
      this.categoryGroups$$.set(cached.categoryGroups);
      this.categoryOptions$$.set(cached.categoryOptions);
    }
  }

  private persistToCache(): void {
    this.saveToLocalStorage<Catalog>({
      activityKinds: this.activityKinds$$(),
      categoryGroups: this.categoryGroups$$(),
      categoryOptions: this.categoryOptions$$(),
    });
  }

  private async refreshFromServer(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<DataResponse<Catalog>>('/api/time/catalog'));
      this.activityKinds$$.set(response.data.activityKinds);
      this.categoryGroups$$.set(response.data.categoryGroups);
      this.categoryOptions$$.set(response.data.categoryOptions);
      this.persistToCache();
    } catch (error) {
      console.error('Failed loading time catalog:', error);
    }
  }

  public createActivityKind(input: ActivityKindInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — activity kind not saved');
      return;
    }

    const tempId = -Date.now();
    const snapshot = this.activityKinds$$();
    this.activityKinds$$.update((kinds) => [
      ...kinds,
      { ...input, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/activity-kinds',
      data: input,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.activityKinds$$.update((kinds) =>
          kinds.map((kind) => (kind.id === tempId ? { ...kind, id: response.data.id } : kind)),
        );
        this.persistToCache();
      },
      rollbackCallback: () => {
        this.activityKinds$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Activity kind added',
        errorMessage: 'Failed to save activity kind',
        pendingMessage: 'Saving activity kind...',
      },
    });
  }

  public updateActivityKind(kindId: number, input: ActivityKindInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.activityKinds$$().find((kind) => kind.id === kindId);
    if (!previous) return;

    this.activityKinds$$.update((kinds) => kinds.map((kind) => (kind.id === kindId ? { ...kind, ...input } : kind)));
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/time/activity-kinds/${kindId}`,
      data: input,
      rollbackCallback: () => {
        this.activityKinds$$.update((kinds) => kinds.map((kind) => (kind.id === kindId ? previous : kind)));
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public createCategoryGroup(input: CategoryGroupInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — group not saved');
      return;
    }

    const tempId = -Date.now();
    const snapshot = this.categoryGroups$$();
    this.categoryGroups$$.update((groups) => [
      ...groups,
      { ...input, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/category-groups',
      data: input,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.categoryGroups$$.update((groups) =>
          groups.map((group) => (group.id === tempId ? { ...group, id: response.data.id } : group)),
        );
        this.persistToCache();
      },
      rollbackCallback: () => {
        this.categoryGroups$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Group added',
        errorMessage: 'Failed to save group',
        pendingMessage: 'Saving group...',
      },
    });
  }

  public updateCategoryGroup(groupId: number, input: CategoryGroupInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.categoryGroups$$().find((group) => group.id === groupId);
    if (!previous) return;

    // Archiving can be rejected by the backend (group still bound to an
    // active ActivityKind) — the generic rollbackCallback below restores
    // `previous` on any failure, including that 409, so the optimistic
    // isArchived flip is never left dangling locally.
    this.categoryGroups$$.update((groups) => groups.map((group) => (group.id === groupId ? { ...group, ...input } : group)));
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/time/category-groups/${groupId}`,
      data: input,
      rollbackCallback: () => {
        this.categoryGroups$$.update((groups) => groups.map((group) => (group.id === groupId ? previous : group)));
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public deleteCategoryGroup(groupId: number): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — group not deleted');
      return;
    }

    const snapshot = this.categoryGroups$$();
    this.categoryGroups$$.update((groups) => groups.filter((group) => group.id !== groupId));
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/time/category-groups/${groupId}`,
      data: null,
      rollbackCallback: () => {
        this.categoryGroups$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Group deleted',
        errorMessage: 'Failed to delete group (still has options or is bound to an activity kind)',
        pendingMessage: 'Deleting group...',
      },
    });
  }

  public createCategoryOption(input: CategoryOptionInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — option not saved');
      return;
    }

    const tempId = -Date.now();
    const snapshot = this.categoryOptions$$();
    this.categoryOptions$$.update((options) => [
      ...options,
      { ...input, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/category-options',
      data: input,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.categoryOptions$$.update((options) =>
          options.map((option) => (option.id === tempId ? { ...option, id: response.data.id } : option)),
        );
        this.persistToCache();
      },
      rollbackCallback: () => {
        this.categoryOptions$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Option added',
        errorMessage: 'Failed to save option',
        pendingMessage: 'Saving option...',
      },
    });
  }

  public updateCategoryOption(optionId: number, input: CategoryOptionInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.categoryOptions$$().find((option) => option.id === optionId);
    if (!previous) return;

    this.categoryOptions$$.update((options) =>
      options.map((option) => (option.id === optionId ? { ...option, ...input } : option)),
    );
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/time/category-options/${optionId}`,
      data: input,
      rollbackCallback: () => {
        this.categoryOptions$$.update((options) => options.map((option) => (option.id === optionId ? previous : option)));
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public deleteCategoryOption(optionId: number): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — option not deleted');
      return;
    }

    const snapshot = this.categoryOptions$$();
    this.categoryOptions$$.update((options) => options.filter((option) => option.id !== optionId));
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/time/category-options/${optionId}`,
      data: null,
      rollbackCallback: () => {
        this.categoryOptions$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Option deleted',
        errorMessage: 'Failed to delete option (used by existing entries)',
        pendingMessage: 'Deleting option...',
      },
    });
  }
}
