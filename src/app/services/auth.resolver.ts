import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import {
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  map,
  take,
} from 'rxjs/operators';

export const authResolver: ResolveFn<boolean> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowUnauthenticated = route.data['allowUnauthenticated'] === true;

  return authService.checkAuth().pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) {
        return true;
      }

      if (allowUnauthenticated) {
        return false;
      }

      router.navigate(['/settings']);
      return false;
    }),
    catchError(() => {
      if (!allowUnauthenticated) {
        router.navigate(['/settings']);
      }
      return of(false);
    }),
  );
};
