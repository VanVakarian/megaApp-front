import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { DEFAULT_SETTINGS } from '@app/shared/const';
import { Settings } from '@app/shared/interfaces';
import { catchError, firstValueFrom, of } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { NotificationService } from './notification.service';
import { SyncOperationType, SyncQueueService } from './sync-queue.service';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly SETTINGS_STORAGE_KEY = 'settings';

  public readonly settings$$: WritableSignal<Settings> = signal(DEFAULT_SETTINGS);

  private readonly http = inject(HttpClient);
  private readonly localStorage = inject(LocalStorageService);
  private readonly notificationsService = inject(NotificationService);
  private readonly networkService = inject(NetworkService);
  private readonly syncQueue = inject(SyncQueueService);

  constructor() {
    this.initializeFromLocalStorage();
    this.performBackgroundSync();
  }

  private initializeFromLocalStorage(): void {
    const localSettings = this.localStorage.get<Settings>(this.SETTINGS_STORAGE_KEY);
    if (localSettings) {
      this.settings$$.set(localSettings);
      this.applyTheme(localSettings.darkTheme);
    }
  }

  private async performBackgroundSync(): Promise<void> {
    if (!this.networkService.isNetworkAvailable$$()) {
      return;
    }

    try {
      const serverSettings = await firstValueFrom(
        this.http.get<Settings>('/api/settings/').pipe(
          catchError((error) => {
            console.error('Failed to fetch settings from server:', error);
            return of(null);
          }),
        ),
      );

      if (serverSettings) {
        const currentSettings = this.settings$$();

        const hasChanges = JSON.stringify(currentSettings) !== JSON.stringify(serverSettings);
        if (hasChanges) {
          this.settings$$.set(serverSettings);
          this.localStorage.set(this.SETTINGS_STORAGE_KEY, serverSettings);
          this.applyTheme(serverSettings.darkTheme);
          this.notificationsService.showSyncSuccess('Settings updated from server');
        }
      }
    } catch (error) {
      console.error('Background sync initialization failed:', error);
    }
  }

  async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<boolean> {
    if (!this.networkService.isNetworkAvailable$$()) {
      return false;
    }

    const currentSettings = this.settings$$();
    const newSettings = { ...currentSettings, [key]: value };

    this.settings$$.set(newSettings);
    this.localStorage.set(this.SETTINGS_STORAGE_KEY, newSettings);

    if (key === 'darkTheme') {
      this.applyTheme(value as boolean);
    }

    this.syncQueue.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: '/api/settings/',
      data: { [key]: value },
      rollbackCallback: () => {
        this.rollbackSetting(key, currentSettings[key]);
        this.notificationsService.showSyncError('Failed to save settings');
      },
    });

    return true;
  }

  private rollbackSetting<K extends keyof Settings>(key: K, previousValue: Settings[K]): void {
    const currentSettings = this.settings$$();
    const rolledBackSettings = { ...currentSettings, [key]: previousValue };

    this.settings$$.set(rolledBackSettings);
    this.localStorage.set(this.SETTINGS_STORAGE_KEY, rolledBackSettings);

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

  async saveSetting(setting: Partial<Settings>): Promise<boolean> {
    const key = Object.keys(setting)[0] as keyof Settings;
    const value = setting[key];

    if (value !== undefined) {
      return await this.updateSetting(key, value);
    }

    return false;
  }
}
