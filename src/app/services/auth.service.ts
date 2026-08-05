import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IndexedDbCacheService } from '@app/services/indexed-db-cache.service';
import { NetworkService } from '@app/services/network.service';
import { NotificationService } from '@app/services/notification.service';
import { SettingsService } from '@app/services/settings.service';
import { SyncEngineService } from '@app/services/sync-engine.service';
import { clearAllUserScopedCaches } from '@app/shared/cache';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, SESSION_BOOTSTRAP_TIMEOUT_MS } from '@app/shared/const';
import { AuthResponse, UserCreds, VerifyResponse } from '@app/shared/types';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';

export const AuthSessionState = {
  Unknown: 'unknown',
  Guest: 'guest',
  Authenticated: 'authenticated',
} as const;

export type AuthSessionState = (typeof AuthSessionState)[keyof typeof AuthSessionState];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public readonly sessionState$$ = signal<AuthSessionState>(AuthSessionState.Unknown);
  public readonly isAuthenticated$$ = computed(() => this.sessionState$$() === AuthSessionState.Authenticated);
  public readonly bootstrapError$$ = signal(false);
  public readonly isAdmin$$ = signal(false);

  private bootstrapPromise: Promise<void> | null = null;

  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly syncEngine = inject(SyncEngineService);
  private readonly settingsService = inject(SettingsService);
  private readonly notificationService = inject(NotificationService);
  private readonly indexedDbCache = inject(IndexedDbCacheService);

  public ensureBootstrapped(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrap();
    }
    return this.bootstrapPromise;
  }

  public retryBootstrap(): Promise<void> {
    this.bootstrapError$$.set(false);
    this.bootstrapPromise = null;
    return this.ensureBootstrapped();
  }

  public login(user: UserCreds): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', user, { observe: 'response' }).pipe(
      map((response: HttpResponse<AuthResponse>) => {
        if (!response.body?.accessToken || !response.body?.refreshToken) {
          throw new Error('Auth failed');
        }

        this.setTokens(response.body);
        this.sessionState$$.set(AuthSessionState.Authenticated);
        this.isAdmin$$.set(response.body.isAdmin);
        this.networkService.connect();
        this.syncEngine.restorePendingOperation();
        return response.body;
      }),
    );
  }

  public register(user: UserCreds): Observable<any> {
    return this.http.post('/api/auth/register', user, { observe: 'response' }).pipe(
      tap((response: HttpResponse<any>) => {
        if (response.status !== 201) {
          throw new Error('Registration failed');
        }
      }),
    );
  }

  public logout(): void {
    this.terminateSession();
  }

  public refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!refreshToken) {
      this.terminateSession();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken }).pipe(
      tap((response: AuthResponse) => {
        this.setTokens(response);
        this.isAdmin$$.set(response.isAdmin);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.terminateSession();
        }
        return throwError(() => error);
      }),
    );
  }

  private async bootstrap(): Promise<void> {
    const hasSession =
      !!localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || !!localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!hasSession) {
      this.sessionState$$.set(AuthSessionState.Guest);
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<VerifyResponse>('/api/auth/verify').pipe(timeout(SESSION_BOOTSTRAP_TIMEOUT_MS)),
      );
      this.sessionState$$.set(AuthSessionState.Authenticated);
      this.isAdmin$$.set(response.isAdmin);
      this.networkService.connect();
      this.syncEngine.restorePendingOperation();
    } catch {
      if (this.sessionState$$() !== AuthSessionState.Guest) {
        this.bootstrapError$$.set(true);
      }
      this.sessionState$$.set(AuthSessionState.Guest);
    }
  }

  private terminateSession(): void {
    if (this.sessionState$$() === AuthSessionState.Guest) {
      return;
    }

    this.removeTokens();
    this.networkService.disconnect();
    this.syncEngine.reset();
    this.settingsService.reset();
    this.notificationService.clearAll();
    clearAllUserScopedCaches();
    void this.indexedDbCache.clearAllUserScoped();
    this.sessionState$$.set(AuthSessionState.Guest);
    this.isAdmin$$.set(false);
    void this.router.navigateByUrl('/auth');
  }

  private setTokens(response: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refreshToken);
  }

  private removeTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

export const tokenGetter = () => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
