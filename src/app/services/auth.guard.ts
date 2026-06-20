import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureBootstrapped();

  if (authService.isAuthenticated$$()) {
    return true;
  }

  return router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } });
};
