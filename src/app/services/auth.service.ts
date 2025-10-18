import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { AuthResponse, UserCreds } from '@app/shared/interfaces';
import jwt_decode from 'jwt-decode';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public readonly isAuthenticated$$ = signal<boolean>(false);

  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';

  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);

  public login(user: UserCreds): Observable<any> {
    return this.http.post<AuthResponse>('/api/auth/login', user, { observe: 'response' }).pipe(
      tap((response: HttpResponse<AuthResponse>) => {
        if (response.body?.accessToken && response.body?.refreshToken) {
          this.setTokens(response.body);
          this.isAuthenticated$$.set(true);
          this.networkService.connect();
        } else {
          throw new Error('Auth failed');
        }
      }),
    );
  }

  public register(user: UserCreds): Observable<any> {
    return this.http.post('/api/auth/register', user, { observe: 'response' }).pipe(
      tap((response: HttpResponse<any>) => {
        if (response.status === 201) {
          console.log('Registration completed successfully');
        } else {
          throw new Error('Registration failed');
        }
      }),
    );
  }

  public logout(): void {
    this.removeTokens();
    this.isAuthenticated$$.set(false);
    this.networkService.disconnect();
  }

  public refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    return this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken }).pipe(
      tap((response: AuthResponse) => {
        if (response.accessToken && response.refreshToken) {
          this.setTokens(response);
        }
      }),
      catchError(() => {
        this.logout();
        throw new Error('Refresh token expired or invalid');
      }),
    );
  }

  public checkAuth(): Observable<boolean> {
    const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    if (token) {
      const decodedToken = jwt_decode(token) as { exp: number };
      const currentTime = Math.round(new Date().getTime() / 1000);

      if (decodedToken.exp > currentTime) {
        this.isAuthenticated$$.set(true);
        this.networkService.connect();
        return of(true);
      } else {
        return this.refreshToken().pipe(
          map((response: AuthResponse) => {
            if (response.accessToken) {
              this.setTokens(response);
              this.isAuthenticated$$.set(true);
              this.networkService.connect();
              return true;
            }
            return false;
          }),
          catchError(() => {
            this.isAuthenticated$$.set(false);
            return of(false);
          }),
        );
      }
    }
    this.isAuthenticated$$.set(false);
    return of(false);
  }

  private setTokens(response: AuthResponse): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
  }

  private removeTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }
}

export const tokenGetter = () => localStorage.getItem('access_token');
