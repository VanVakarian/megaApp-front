import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { DEFAULT_SETTINGS } from '@app/shared/const';
import { Settings } from '@app/shared/interfaces';
import { catchError, firstValueFrom, of } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { NetworkService } from './network.service';
import { NotificationService } from './notification.service';

const SETTINGS_STORAGE_KEY = 'settings';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settings$$: WritableSignal<Settings> = signal(DEFAULT_SETTINGS);

  public USE_COEFFICIENTS_TEMP = true; // TODO[067] implement sometime

  constructor(
    private http: HttpClient,
    private localStorage: LocalStorageService,
    private notificationsService: NotificationService,
    private networkService: NetworkService,
  ) {
    this.initializeFromLocalStorage();
    this.performBackgroundSync();
    // effect(() => { console.log('settings', this.settings$$()) }); // prettier-ignore
  }

  private initializeFromLocalStorage(): void {
    const localSettings = this.localStorage.get<Settings>(SETTINGS_STORAGE_KEY);
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
          this.localStorage.set(SETTINGS_STORAGE_KEY, serverSettings);
          this.applyTheme(serverSettings.darkTheme);
          this.notificationsService.showSyncSuccess('Settings updated from server');
        }
      }
    } catch (error) {
      console.error('Background sync initialization failed:', error);
    }
  }

  async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<boolean> {
    const currentSettings = this.settings$$();
    const newSettings = { ...currentSettings, [key]: value };

    this.settings$$.set(newSettings);
    this.localStorage.set(SETTINGS_STORAGE_KEY, newSettings);

    if (key === 'darkTheme') {
      this.applyTheme(value as boolean);
    }

    if (this.networkService.isNetworkAvailable$$()) {
      try {
        await firstValueFrom(this.http.put<void>('/api/settings/', { [key]: value }));
        return true;
      } catch (error) {
        console.error('Failed to update setting on server:', error);
        this.rollbackSetting(key, currentSettings[key]);
        this.notificationsService.showSyncError('Failed to save settings');
        return false;
      }
    } else {
      this.notificationsService.showOfflineMode();
      return true;
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

  async saveSetting(setting: Partial<Settings>): Promise<boolean> {
    const key = Object.keys(setting)[0] as keyof Settings;
    const value = setting[key];

    if (value !== undefined) {
      return await this.updateSetting(key, value);
    }

    return false;
  }
}
