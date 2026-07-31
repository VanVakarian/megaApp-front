import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { DEFAULT_SETTINGS } from '@app/shared/const';
import { UserSettings } from '@app/shared/types';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { NotificationService } from './notification.service';
import { SyncEngineService, SyncOperationMode, SyncOperationType } from './sync-engine.service';

export type SettingsStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly SETTINGS_STORAGE_KEY = 'settings';

  public readonly settings$$: WritableSignal<UserSettings> = signal(DEFAULT_SETTINGS);
  public readonly status$$: WritableSignal<SettingsStatus> = signal('idle');

  private readyPromise: Promise<void> | null = null;

  private readonly http = inject(HttpClient);
  private readonly localStorage = inject(LocalStorageService);
  private readonly notificationsService = inject(NotificationService);
  private readonly networkService = inject(NetworkService);
  private readonly syncEngine = inject(SyncEngineService);

  public ensureReady(): Promise<void> {
    if (this.status$$() === 'ready') {
      return Promise.resolve();
    }

    if (!this.readyPromise) {
      this.readyPromise = this.loadSettings();
    }

    return this.readyPromise;
  }

  public reset(): void {
    this.settings$$.set(DEFAULT_SETTINGS);
    this.status$$.set('idle');
    this.readyPromise = null;
    this.applyTheme(DEFAULT_SETTINGS.darkTheme);
  }

  async updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<boolean> {
    if (!this.networkService.isNetworkAvailable$$()) {
      return false;
    }

    const currentSettings = this.settings$$();
    const newSettings = { ...currentSettings, [key]: value };

    this.settings$$.set(newSettings);
    this.localStorage.setUserScoped(this.SETTINGS_STORAGE_KEY, newSettings);

    if (key === 'darkTheme') {
      this.applyTheme(value as boolean);
    }

    this.syncEngine.addOperation({
      mode: SyncOperationMode.Optimistic,
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

  private rollbackSetting<K extends keyof UserSettings>(key: K, previousValue: UserSettings[K]): void {
    const currentSettings = this.settings$$();
    const rolledBackSettings = { ...currentSettings, [key]: previousValue };

    this.settings$$.set(rolledBackSettings);
    this.localStorage.setUserScoped(this.SETTINGS_STORAGE_KEY, rolledBackSettings);

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

  async saveSetting(setting: Partial<UserSettings>): Promise<boolean> {
    const key = Object.keys(setting)[0] as keyof UserSettings;
    const value = setting[key];

    if (value !== undefined) {
      return await this.updateSetting(key, value);
    }

    return false;
  }

  private async loadSettings(): Promise<void> {
    this.status$$.set('loading');

    const cachedSettings = this.localStorage.getUserScoped<UserSettings>(this.SETTINGS_STORAGE_KEY);
    if (cachedSettings) {
      this.settings$$.set(cachedSettings);
      this.applyTheme(cachedSettings.darkTheme);
    }

    try {
      const serverSettings = await firstValueFrom(this.http.get<UserSettings>('/api/settings/'));

      this.settings$$.set(serverSettings);
      this.localStorage.setUserScoped(this.SETTINGS_STORAGE_KEY, serverSettings);
      this.applyTheme(serverSettings.darkTheme);
      this.status$$.set('ready');
    } catch (error) {
      console.error('Failed to fetch settings from server:', error);
      this.status$$.set(cachedSettings ? 'ready' : 'error');

      if (this.status$$() === 'error') {
        this.readyPromise = null;
      }
    }
  }
}
