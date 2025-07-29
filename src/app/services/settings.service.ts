import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';

import { DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER, DEFAULT_SETTINGS } from '@app/shared/const';
import { Settings } from '@app/shared/interfaces';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { NotificationService } from './notification.service';
import { SyncQueueService } from './sync-queue.service';

const SETTINGS_STORAGE_KEY = 'localfirst-settings';

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export enum RequestStatus {
  IDLE = 'Idle',
  IN_PROGRESS = 'InProgress',
  SUCCESS = 'Success',
  ERROR = 'Error',
}

type SettingsKeysForRequestTracking =
  | 'selectedChapterFood'
  | 'selectedChapterMoney'
  | 'darkTheme'
  | 'liteVersion'
  | 'height';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settings$$: WritableSignal<Settings> = signal(DEFAULT_SETTINGS);
  public syncStatus$$: WritableSignal<SyncStatus> = signal(SyncStatus.IDLE);

  public requestStatus: Record<SettingsKeysForRequestTracking, WritableSignal<RequestStatus>> = {
    selectedChapterFood: signal(RequestStatus.IDLE),
    selectedChapterMoney: signal(RequestStatus.IDLE),
    darkTheme: signal(RequestStatus.IDLE),
    liteVersion: signal(RequestStatus.IDLE),
    height: signal(RequestStatus.IDLE),
  };

  private requestStatusTimeouts: Record<SettingsKeysForRequestTracking, ReturnType<typeof setTimeout> | null> = {
    selectedChapterFood: null,
    selectedChapterMoney: null,
    darkTheme: null,
    liteVersion: null,
    height: null,
  };

  public USE_COEFFICIENTS_TEMP = true;

  constructor(
    private http: HttpClient,
    private localStorage: LocalStorageService,
    private syncQueue: SyncQueueService,
    private notifications: NotificationService,
    private network: NetworkService,
  ) {
    this.initializeFromLocal();
  }

  async initializeApp(): Promise<void> {
    this.initializeFromLocal();
    await this.syncWithServer();
  }

  async initLoadSettings(): Promise<Settings> {
    await this.initializeApp();
    return this.settings$$();
  }

  private initializeFromLocal(): void {
    const localSettings = this.localStorage.get<Settings>(SETTINGS_STORAGE_KEY);
    if (localSettings) {
      this.settings$$.set(localSettings);
      this.applyTheme(localSettings.darkTheme);
    }
  }

  private async syncWithServer(): Promise<void> {
    try {
      this.syncStatus$$.set(SyncStatus.SYNCING);

      const serverSettings = await firstValueFrom(
        this.http.get<Settings>('/api/settings/').pipe(
          catchError((error) => {
            console.error('Failed to fetch settings from server:', error);
            return of(null);
          }),
        ),
      );

      if (serverSettings) {
        this.settings$$.set(serverSettings);
        this.localStorage.set(SETTINGS_STORAGE_KEY, serverSettings);
        this.applyTheme(serverSettings.darkTheme);
        this.syncStatus$$.set(SyncStatus.SUCCESS);
      } else {
        this.syncStatus$$.set(SyncStatus.ERROR);
      }
    } catch (error) {
      console.error('Settings sync error:', error);
      this.syncStatus$$.set(SyncStatus.ERROR);
    }
  }

  async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<boolean> {
    if (!this.network.isNetworkAvailable()) {
      this.notifications.showOfflineMode();
      return false;
    }

    const timeoutKey = key as SettingsKeysForRequestTracking;
    if (timeoutKey in this.requestStatus) {
      this.setRequestStatus(timeoutKey, RequestStatus.IN_PROGRESS);
    }

    const currentSettings = this.settings$$();
    const newSettings = { ...currentSettings, [key]: value };

    this.settings$$.set(newSettings);
    this.localStorage.set(SETTINGS_STORAGE_KEY, newSettings);

    if (key === 'darkTheme') {
      this.applyTheme(value as boolean);
    }

    try {
      const operationId = this.syncQueue.addOperation({
        type: 'update',
        endpoint: '/api/settings/',
        data: { [key]: value },
      });

      const queueStatus = this.syncQueue.queueStatus$$();
      if (queueStatus.lastError) {
        this.rollbackSetting(key, currentSettings[key]);
        this.notifications.showSyncError('Failed to save settings');
        if (timeoutKey in this.requestStatus) {
          this.setRequestStatus(timeoutKey, RequestStatus.ERROR);
        }
        return false;
      }

      if (timeoutKey in this.requestStatus) {
        this.setRequestStatus(timeoutKey, RequestStatus.SUCCESS);
      }
      return true;
    } catch (error) {
      this.rollbackSetting(key, currentSettings[key]);
      this.notifications.showSyncError('Failed to save settings');
      if (timeoutKey in this.requestStatus) {
        this.setRequestStatus(timeoutKey, RequestStatus.ERROR);
      }
      return false;
    }
  }

  private rollbackSetting<K extends keyof Settings>(key: K, previousValue: Settings[K]): void {
    const currentSettings = this.settings$$();
    const rolledBackSettings = { ...currentSettings, [key]: previousValue };

    this.settings$$.set(rolledBackSettings);
    this.localStorage.set(SETTINGS_STORAGE_KEY, rolledBackSettings);

    if (key === 'darkTheme') {
      this.applyTheme(previousValue as boolean);
    }
  }

  public applyTheme(isDarkTheme: boolean): void {
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  private setRequestStatus(settingKey: SettingsKeysForRequestTracking, status: RequestStatus): void {
    this.requestStatus[settingKey].set(status);

    const currentTimeout = this.requestStatusTimeouts[settingKey];
    if (currentTimeout) clearTimeout(currentTimeout);

    if (status !== RequestStatus.IN_PROGRESS) {
      this.requestStatusTimeouts[settingKey] = setTimeout(() => {
        this.requestStatus[settingKey].set(RequestStatus.IDLE);
      }, DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER);
    }
  }

  async saveSelectedChapter(setting: Partial<Settings>): Promise<boolean> {
    const key = Object.keys(setting)[0] as keyof Settings;
    const value = setting[key];

    if (value !== undefined) {
      return await this.updateSetting(key, value);
    }

    return false;
  }
}
