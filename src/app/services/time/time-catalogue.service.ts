import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { TimeActivity, TimeActivityInput, TimeCategory, TimeCategoryInput, TimeTrack } from '@app/shared/time-types';
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

interface CatalogueSnapshot {
  activities: TimeActivity[];
  categories: TimeCategory[];
}

@Injectable({
  providedIn: 'root',
})
export class TimeCatalogueService extends BaseTimeService {
  private readonly CATALOGUE_STORAGE_KEY = 'time_catalogue';

  public readonly activities$$: WritableSignal<TimeActivity[]> = signal([]);
  public readonly categories$$: WritableSignal<TimeCategory[]> = signal([]);
  public readonly recentActivityIds$$: WritableSignal<number[]> = signal([]);

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
    void this.refreshRecentActivityIds();
  }

  public reset(): void {
    this.activities$$.set([]);
    this.categories$$.set([]);
    this.recentActivityIds$$.set([]);
  }

  private loadFromCache(): void {
    const cached = this.loadFromLocalStorage<CatalogueSnapshot>();
    if (cached) {
      this.activities$$.set(cached.activities);
      this.categories$$.set(cached.categories);
    }
  }

  private persistToCache(): void {
    this.saveToLocalStorage<CatalogueSnapshot>({
      activities: this.activities$$(),
      categories: this.categories$$(),
    });
  }

  private async refreshFromServer(): Promise<void> {
    try {
      const [activitiesResponse, categoriesResponse] = await Promise.all([
        firstValueFrom(this.http.get<DataResponse<TimeActivity[]>>('/api/time/activities')),
        firstValueFrom(this.http.get<DataResponse<TimeCategory[]>>('/api/time/categories')),
      ]);
      this.activities$$.set(activitiesResponse.data);
      this.categories$$.set(categoriesResponse.data);
      this.persistToCache();
    } catch (error) {
      console.error('Failed loading time catalogue:', error);
    }
  }

  public async refreshRecentActivityIds(track?: TimeTrack, limit?: number): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (track) params.set('track', track);
      if (limit) params.set('limit', String(limit));
      const query = params.toString();
      const response = await firstValueFrom(
        this.http.get<DataResponse<number[]>>(`/api/time/activities/recent${query ? `?${query}` : ''}`),
      );
      this.recentActivityIds$$.set(response.data);
    } catch (error) {
      console.error('Failed loading recent activities:', error);
    }
  }

  public createActivity(input: TimeActivityInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — activity not saved');
      return;
    }

    const tempId = -Date.now();
    const snapshot = this.activities$$();
    this.activities$$.update((activities) => [
      ...activities,
      { ...input, id: tempId, createdAt: new Date().toISOString() },
    ]);
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/activities',
      data: input,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.activities$$.update((activities) =>
          activities.map((activity) => (activity.id === tempId ? { ...activity, id: response.data.id } : activity)),
        );
        this.persistToCache();
      },
      rollbackCallback: () => {
        this.activities$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Activity added',
        errorMessage: 'Failed to save activity',
        pendingMessage: 'Saving activity...',
      },
    });
  }

  public updateActivity(activityId: number, input: TimeActivityInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.activities$$().find((activity) => activity.id === activityId);
    if (!previous) return;

    this.activities$$.update((activities) =>
      activities.map((activity) => (activity.id === activityId ? { ...activity, ...input } : activity)),
    );
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/time/activities/${activityId}`,
      data: input,
      rollbackCallback: () => {
        this.activities$$.update((activities) =>
          activities.map((activity) => (activity.id === activityId ? previous : activity)),
        );
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public createCategory(input: TimeCategoryInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — category not saved');
      return;
    }

    const tempId = -Date.now();
    const snapshot = this.categories$$();
    this.categories$$.update((categories) => [
      ...categories,
      { ...input, id: tempId, createdAt: new Date().toISOString() },
    ]);
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/time/categories',
      data: input,
      successCallback: (response: DataResponse<{ id: number }>) => {
        this.categories$$.update((categories) =>
          categories.map((category) => (category.id === tempId ? { ...category, id: response.data.id } : category)),
        );
        this.persistToCache();
      },
      rollbackCallback: () => {
        this.categories$$.set(snapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Category added',
        errorMessage: 'Failed to save category',
        pendingMessage: 'Saving category...',
      },
    });
  }

  public updateCategory(categoryId: number, input: TimeCategoryInput): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — changes not saved');
      return;
    }

    const previous = this.categories$$().find((category) => category.id === categoryId);
    if (!previous) return;

    this.categories$$.update((categories) =>
      categories.map((category) => (category.id === categoryId ? { ...category, ...input } : category)),
    );
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/time/categories/${categoryId}`,
      data: input,
      rollbackCallback: () => {
        this.categories$$.update((categories) =>
          categories.map((category) => (category.id === categoryId ? previous : category)),
        );
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Changes saved',
        errorMessage: 'Failed to save changes',
        pendingMessage: 'Saving changes...',
      },
    });
  }

  public deleteCategory(categoryId: number): void {
    if (!this.checkNetworkAvailability()) {
      this.notificationService.addNotification('error', 'No connection — category not deleted');
      return;
    }

    const categoriesSnapshot = this.categories$$();
    const activitiesSnapshot = this.activities$$();
    this.categories$$.update((categories) => categories.filter((category) => category.id !== categoryId));
    this.activities$$.update((activities) =>
      activities.map((activity) => ({
        ...activity,
        categoryIds: activity.categoryIds.filter((id) => id !== categoryId),
      })),
    );
    this.persistToCache();

    this.addSyncOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/time/categories/${categoryId}`,
      data: null,
      rollbackCallback: () => {
        this.categories$$.set(categoriesSnapshot);
        this.activities$$.set(activitiesSnapshot);
        this.persistToCache();
      },
      feedback: {
        successMessage: 'Category deleted',
        errorMessage: 'Failed to delete category',
        pendingMessage: 'Deleting category...',
      },
    });
  }
}
