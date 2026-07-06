import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SettingsService } from '@app/services/settings.service';

export const isChapterSelected: CanActivateFn = (route, state) => {
  const url = state.url;

  const router = inject(Router);
  const settingsService = inject(SettingsService);

  const settings = settingsService.settings$$();

  if (url.startsWith('/food') && !settings.selectedChapterFood) {
    return router.createUrlTree(['/settings']);
  }

  if (url.startsWith('/money') && !settings.selectedChapterMoney) {
    return router.createUrlTree(['/settings']);
  }

  if (url.startsWith('/time') && !settings.selectedChapterTime) {
    return router.createUrlTree(['/settings']);
  }

  return true;
};
