import { Injectable, OnDestroy, WritableSignal, computed, signal } from '@angular/core';
import { tokenGetter } from '@app/services/auth.service';
import { IncomingMessage } from '@app/shared/interfaces';
import { EMPTY, Observable, Subject, timer } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { environment } from 'src/environments/environment.dev';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService implements OnDestroy {
  public readonly isOnline$$: WritableSignal<boolean> = signal(navigator.onLine);
  public readonly isConnected$$: WritableSignal<boolean> = signal(false);
  public readonly isNetworkAvailable$$ = computed(() => this.isOnline$$());

  private socket$: WebSocketSubject<any> | undefined;
  private reconnectDelaySec = 1;
  private readonly messagesSubject = new Subject<IncomingMessage>();
  private readonly clientId: string;

  constructor(private readonly notifications: NotificationService) {
    this.clientId = Math.random().toString(36).substring(2, 10);
    this.initNetworkEvents();
  }

  public ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject.complete();
  }

  public getClientId(): string {
    return this.clientId;
  }

  public connect(): void {
    if (this.socket$ && !this.socket$.closed) {
      return;
    }

    const token = tokenGetter();
    if (!token) {
      console.warn('Cannot connect WebSocket: no auth token');
      return;
    }

    this.socket$ = this.createWebSocket(token);

    this.socket$
      .pipe(
        tap(() => {
          this.isConnected$$.set(true);
        }),
        retry({
          delay: (error, retryCount) => {
            console.log(`WebSocket reconnecting, attempt #${retryCount}`);
            this.isConnected$$.set(false);
            return timer(this.reconnectDelaySec * 1000);
          },
        }),
        catchError((error) => {
          console.error('WebSocket connection failed:', error);
          this.isConnected$$.set(false);
          return EMPTY;
        }),
      )
      .subscribe({
        next: (message) => this.handleIncomingMessage(message),
        error: (error) => {
          console.error('WebSocket error:', error);
          this.isConnected$$.set(false);
        },
        complete: () => {
          console.warn('WebSocket connection closed');
          this.isConnected$$.set(false);
        },
      });
  }

  public disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
    this.isConnected$$.set(false);
  }

  public getMessages(): Observable<IncomingMessage> {
    return this.messagesSubject.asObservable();
  }

  private initNetworkEvents(): void {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));

    this.isOnline$$.set(navigator.onLine);
  }

  private updateOnlineStatus(isOnline: boolean): void {
    this.isOnline$$.set(isOnline);

    if (!isOnline) {
      this.notifications.showOfflineMode();
    }
  }

  private createWebSocket(token: string): WebSocketSubject<any> {
    const encodedToken = encodeURIComponent(token);
    const encodedClientId = encodeURIComponent(this.clientId);

    let wsUrl: string;

    if (environment.wsUrl) {
      wsUrl = `${environment.wsUrl}?token=${encodedToken}&clientId=${encodedClientId}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/api/ws?token=${encodedToken}&clientId=${encodedClientId}`;
    }

    return webSocket(wsUrl);
  }

  private handleIncomingMessage(data: any): void {
    if (data?.type === 'ping') {
      if (this.socket$ && !this.socket$.closed) {
        this.socket$.next({ type: 'pong' });
      }
      return;
    }

    if (data?.type === 'pong') {
      console.log('Received pong');
      return;
    }

    if (data?.type) {
      console.log('Received realtime update:', data);
      this.messagesSubject.next(data);
    }
  }
}
