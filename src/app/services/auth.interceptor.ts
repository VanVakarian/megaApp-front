import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from '@app/services/auth.service';
import { NetworkService } from '@app/services/network.service';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@app/shared/const';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshInFlight$: Observable<string> | null = null;

  private readonly networkService = inject(NetworkService);
  private readonly authService = inject(AuthService);

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => request.url.includes(path));

    let preparedRequest = this.addClientId(request);

    const accessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (accessToken && !isAuthEndpoint) {
      preparedRequest = this.addToken(preparedRequest, accessToken);
    }

    return next.handle(preparedRequest).pipe(
      catchError((error) => {
        const canAttemptRefresh = !isAuthEndpoint && !!localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

        if (error instanceof HttpErrorResponse && error.status === 401 && canAttemptRefresh) {
          return this.handle401Error(preparedRequest, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private addClientId(request: HttpRequest<any>): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        'X-Client-ID': this.networkService.getClientId(),
      },
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.authService.refreshToken().pipe(
        map((response) => response.accessToken),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );
    }

    return this.refreshInFlight$.pipe(switchMap((token) => next.handle(this.addToken(request, token))));
  }
}
