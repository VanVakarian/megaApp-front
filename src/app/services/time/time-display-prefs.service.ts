import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '../local-storage.service';

const COMPACT_MODE_STORAGE_KEY = 'time_compact_mode';
const PRIMARY_HEIGHT_STORAGE_KEY = 'time_primary_height_px';
const SECONDARY_HEIGHT_STORAGE_KEY = 'time_secondary_height_px';
const SETTINGS_COLLAPSED_STORAGE_KEY = 'time_settings_collapsed';
const SNAP_MINUTES_STORAGE_KEY = 'time_snap_minutes';
const PICKER_HEIGHT_STORAGE_KEY = 'time_picker_height_px';

const DEFAULT_PRIMARY_HEIGHT_PX = 36;
const DEFAULT_SECONDARY_HEIGHT_PX = 22;
const DEFAULT_SNAP_MINUTES = 15;
const DEFAULT_PICKER_HEIGHT_PX = 480;

export const MIN_LANE_HEIGHT_PX = 16;
export const MAX_LANE_HEIGHT_PX = 36;

export const MIN_PICKER_HEIGHT_PX = 320;
export const MAX_PICKER_HEIGHT_PX = 700;

@Injectable({
  providedIn: 'root',
})
export class TimeDisplayPrefsService {
  private readonly localStorageService = inject(LocalStorageService);

  public readonly compactMode$$: WritableSignal<boolean> = signal(
    this.localStorageService.getUserScoped<boolean>(COMPACT_MODE_STORAGE_KEY) ?? false,
  );

  public readonly primaryHeightPx$$: WritableSignal<number> = signal(
    this.clampHeight(this.localStorageService.getUserScoped<number>(PRIMARY_HEIGHT_STORAGE_KEY) ?? DEFAULT_PRIMARY_HEIGHT_PX),
  );

  public readonly secondaryHeightPx$$: WritableSignal<number> = signal(
    this.clampHeight(
      this.localStorageService.getUserScoped<number>(SECONDARY_HEIGHT_STORAGE_KEY) ?? DEFAULT_SECONDARY_HEIGHT_PX,
    ),
  );

  public readonly settingsCollapsed$$: WritableSignal<boolean> = signal(
    this.localStorageService.getUserScoped<boolean>(SETTINGS_COLLAPSED_STORAGE_KEY) ?? false,
  );

  public readonly snapMinutes$$: WritableSignal<number> = signal(
    this.localStorageService.getUserScoped<number>(SNAP_MINUTES_STORAGE_KEY) ?? DEFAULT_SNAP_MINUTES,
  );

  public readonly pickerHeightPx$$: WritableSignal<number> = signal(
    this.clampPickerHeight(this.localStorageService.getUserScoped<number>(PICKER_HEIGHT_STORAGE_KEY) ?? DEFAULT_PICKER_HEIGHT_PX),
  );

  public setPickerHeightPx(value: number): void {
    const clamped = this.clampPickerHeight(value);
    this.pickerHeightPx$$.set(clamped);
    this.localStorageService.setUserScoped(PICKER_HEIGHT_STORAGE_KEY, clamped);
  }

  public setSettingsCollapsed(value: boolean): void {
    this.settingsCollapsed$$.set(value);
    this.localStorageService.setUserScoped(SETTINGS_COLLAPSED_STORAGE_KEY, value);
  }

  public setSnapMinutes(value: number): void {
    this.snapMinutes$$.set(value);
    this.localStorageService.setUserScoped(SNAP_MINUTES_STORAGE_KEY, value);
  }

  public setCompactMode(value: boolean): void {
    this.compactMode$$.set(value);
    this.localStorageService.setUserScoped(COMPACT_MODE_STORAGE_KEY, value);
  }

  public setPrimaryHeightPx(value: number): void {
    const clamped = this.clampHeight(value);
    this.primaryHeightPx$$.set(clamped);
    this.localStorageService.setUserScoped(PRIMARY_HEIGHT_STORAGE_KEY, clamped);
  }

  public setSecondaryHeightPx(value: number): void {
    const clamped = this.clampHeight(value);
    this.secondaryHeightPx$$.set(clamped);
    this.localStorageService.setUserScoped(SECONDARY_HEIGHT_STORAGE_KEY, clamped);
  }

  private clampHeight(value: number): number {
    return Math.min(MAX_LANE_HEIGHT_PX, Math.max(MIN_LANE_HEIGHT_PX, Math.round(value)));
  }

  private clampPickerHeight(value: number): number {
    return Math.min(MAX_PICKER_HEIGHT_PX, Math.max(MIN_PICKER_HEIGHT_PX, Math.round(value)));
  }
}
