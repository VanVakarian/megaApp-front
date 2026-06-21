import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { SettingsService } from '@app/services/settings.service';

export const settingsReadyGuard: CanActivateFn = async () => {
  await inject(SettingsService).ensureReady();
  return true;
};
