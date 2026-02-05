import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { tokenGetter } from '@app/services/auth.service';
import { IncomingWsMessage, OutgoingWsMessage, WebSocketMessageType } from '@app/shared/types';
import { EMPTY, Subject, timer } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  public readonly isOnline$$: WritableSignal<boolean> = signal(navigator.onLine);
  public readonly isConnected$$: WritableSignal<boolean> = signal(false);
  public readonly isNetworkAvailable$$ = computed(() => this.isOnline$$());

  private socket$: WebSocketSubject<any> | undefined;
  private reconnectDelaySec = 5;
  public readonly wsMessages$ = new Subject<IncomingWsMessage>();
  private readonly clientId: string;

  private readonly notifications = inject(NotificationService);

  constructor() {
    this.clientId = Math.random().toString(36).substring(2, 10);
    this.initNetworkEvents();
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

  public sendMessage(message: OutgoingWsMessage): void {
    if (this.socket$ && !this.socket$.closed && this.isConnected$$()) {
      this.socket$.next(message);
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const encodedToken = encodeURIComponent(token);
    const encodedClientId = encodeURIComponent(this.clientId);

    const wsUrl = `${protocol}//${host}/api/ws?token=${encodedToken}&clientId=${encodedClientId}`;

    return webSocket(wsUrl);
  }

  private handleIncomingMessage(data: IncomingWsMessage): void {
    if (data.type === WebSocketMessageType.PING) {
      if (this.socket$ && !this.socket$.closed) {
        this.socket$.next({ type: 'PONG' });
      }
      return;
    }

    this.wsMessages$.next(data);
  }
}
