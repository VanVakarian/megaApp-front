import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@app/services/auth.service';

export const isAuthed: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isAuthenticated) {
    const router = inject(Router);
    router.navigate(['/settings']);
    return false;
  }
  return true;
};
