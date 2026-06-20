import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { computeLandingRoute } from '@app/services/landing-route';
import { SettingsService } from '@app/services/settings.service';

export const rootRedirectGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const settingsService = inject(SettingsService);
  const router = inject(Router);

  await authService.ensureBootstrapped();

  if (!authService.isAuthenticated$$()) {
    return router.createUrlTree(['/auth']);
  }

  await settingsService.ensureReady();
  return router.createUrlTree([computeLandingRoute(settingsService.settings$$())]);
};
