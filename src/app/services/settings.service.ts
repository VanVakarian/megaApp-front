import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';

import { catchError, firstValueFrom, map, Observable, of } from 'rxjs';

import { Settings } from '@app/shared/interfaces';
import {
  DEFAULT_CACHED_REQUEST_VALIDITY_MS,
  DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER,
  DEFAULT_SETTINGS,
} from '../shared/const';
import { cached } from '../shared/decorators/cached-request.decorator';

type SettingsKeysForRequestTracking = 'selectedChapterFood' | 'selectedChapterMoney' | 'darkTheme' | 'height';

const SETTINGS_LOCALSTORAGE_KEY = 'settings';

export enum RequestStatus {
  IDLE = 'Idle',
  IN_PROGRESS = 'InProgress',
  SUCCESS = 'Success',
  ERROR = 'Error',
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settings$$: WritableSignal<Settings> = signal(this.loadSettingsFromLocalStorage());

  public requestStatus: Record<SettingsKeysForRequestTracking, WritableSignal<RequestStatus>> = {
    selectedChapterFood: signal(RequestStatus.IDLE),
    selectedChapterMoney: signal(RequestStatus.IDLE),
    darkTheme: signal(RequestStatus.IDLE),
    height: signal(RequestStatus.IDLE),
  };

  private requestStatusTimeouts: Record<SettingsKeysForRequestTracking, ReturnType<typeof setTimeout> | null> = {
    selectedChapterFood: null,
    selectedChapterMoney: null,
    darkTheme: null,
    height: null,
  };

  public USE_COEFFICIENTS_TEMP = true; // TODO[067] implement sometime

  constructor(private http: HttpClient) {
    // effect(() => { console.log('settings', this.settings$$()); }); // prettier-ignore
  }

  public async initLoadSettings(): Promise<Settings> {
    const response = await this.fetchSettings();
    this.settings$$.set(response);
    this.saveSettingsToLocalStorage(response);
    this.applyTheme(response.darkTheme);
    return response;
  }

  @cached(DEFAULT_CACHED_REQUEST_VALIDITY_MS)
  private fetchSettings(): Promise<Settings> {
    return firstValueFrom(
      this.http.get<Settings>('/api/settings/').pipe(
        catchError((error) => {
          console.error('Failed to fetch settings:', error);
          return of(this.loadSettingsFromLocalStorage());
        }),
      ),
    );
  }

  public applyTheme(isDarkTheme: boolean): void {
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  public async saveSelectedChapter(setting: Partial<Settings>): Promise<boolean> {
    return await firstValueFrom(this.putRequest(setting));
  }

  private putRequest(newSetting: Partial<Settings>): Observable<boolean> {
    const settingKey = Object.keys(newSetting)[0] as keyof Settings;
    if (!(settingKey in this.requestStatus)) return of(false);

    const currentTimeout = this.requestStatusTimeouts[settingKey as SettingsKeysForRequestTracking];
    if (currentTimeout) clearTimeout(currentTimeout);

    const timeoutKey = settingKey as SettingsKeysForRequestTracking;
    this.requestStatus[timeoutKey].set(RequestStatus.IN_PROGRESS);

    return this.http.put<HttpResponse<any>>('/api/settings/', newSetting, { observe: 'response' }).pipe(
      map((response: HttpResponse<any>) => {
        if (response.status === 200) {
          const updatedSettings = { ...this.settings$$(), ...newSetting };
          this.settings$$.set(updatedSettings);
          this.saveSettingsToLocalStorage(updatedSettings);
          this.updateRequestStatus(timeoutKey, RequestStatus.SUCCESS);
          return true;
        } else {
          this.updateRequestStatus(timeoutKey, RequestStatus.ERROR);
          return false;
        }
      }),
      catchError(() => {
        this.updateRequestStatus(timeoutKey, RequestStatus.ERROR);
        return of(false);
      }),
    );
  }

  private updateRequestStatus(settingKey: SettingsKeysForRequestTracking, status: RequestStatus): void {
    this.requestStatus[settingKey].set(status);
    this.requestStatusTimeouts[settingKey] = setTimeout(() => {
      this.requestStatus[settingKey].set(RequestStatus.IDLE);
    }, DEFAULT_REQUEST_STATUS_FADE_OUT_TIMER);
  }

  private loadSettingsFromLocalStorage(): Settings {
    const settings = localStorage.getItem(SETTINGS_LOCALSTORAGE_KEY);
    return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
  }

  private saveSettingsToLocalStorage(settings: Settings): void {
    localStorage.setItem(SETTINGS_LOCALSTORAGE_KEY, JSON.stringify(settings));
  }
}
