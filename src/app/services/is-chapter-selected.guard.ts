import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SettingsService } from '@app/services/settings.service';

export const isChapterSelected: CanActivateFn = (route, state) => {
  const settingsService = inject(SettingsService);
  const router = inject(Router);
  const url = state.url;

  const settings = settingsService.settings$$();

  if (url.startsWith('/food') && !settings.selectedChapterFood) {
    router.navigate(['/settings']);
    return false;
  }

  if (url.startsWith('/money') && !settings.selectedChapterMoney) {
    router.navigate(['/settings']);
    return false;
  }

  return true;
};
