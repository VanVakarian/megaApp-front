import { Injectable, OnDestroy, WritableSignal, computed, signal } from '@angular/core';
import { tokenGetter } from '@app/services/auth.service';
import { IncomingMessage } from '@app/shared/interfaces';
import { BehaviorSubject, EMPTY, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, retry, switchMap } from 'rxjs/operators';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService implements OnDestroy {
  public isOnline$$: WritableSignal<boolean> = signal(navigator.onLine);
  public isConnected$$: WritableSignal<boolean> = signal(false);
  public isNetworkAvailable$$ = computed(() => this.isOnline$$() && this.isConnected$$());

  private socket$: WebSocketSubject<any> | undefined;
  private reconnectDelaySec = 1;
  private connectionStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private connectionStatusSubscription!: Subscription;
  private isConnected: boolean = false;

  constructor(private notifications: NotificationService) {
    this.initNetworkEvents();
    // this.initWebSocket();
  }

  public ngOnDestroy() {
    this.connectionStatusSubscription.unsubscribe();

    if (this.socket$) {
      this.socket$.complete();
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
    } else {
      // this.connect();
    }
  }

  private initWebSocket(): void {
    this.connectionStatusSubscription = this.connectionStatus
      .pipe(
        switchMap((isConnected) => {
          if (!isConnected) {
            return timer(this.reconnectDelaySec * 1000).pipe(
              switchMap(() => {
                console.log('Reconnecting...');
                this.connect();
                return of(false);
              }),
            );
          } else {
            return of(true);
          }
        }),
      )
      .subscribe();

    this.connect();
  }

  private connect() {
    if (!this.socket$ || !this.isConnected) {
      this.socket$ = this.getNewWebSocket();

      this.socket$
        .pipe(
          retry({
            delay: (error, retryCount) => {
              console.log(`Retry attempt #${retryCount}`);
              return timer(this.reconnectDelaySec * 1000);
            },
          }),
          catchError((error) => {
            console.error('WebSocket error:', error);
            this.connectionStatus.next(false);
            this.isConnected = false;
            this.isConnected$$.set(false);
            return EMPTY;
          }),
        )
        .subscribe({
          next: (payload) => this.handleMessage(payload),
          error: (err) => {
            console.error('WebSocket connection error:', err);
            this.connectionStatus.next(false);
            this.isConnected = false;
            this.isConnected$$.set(false);
          },
          complete: () => {
            console.warn('WebSocket connection closed');
            this.connectionStatus.next(false);
            this.isConnected = false;
            this.isConnected$$.set(false);
          },
        });

      this.connectionStatus.next(true);
      this.isConnected = true;
      this.isConnected$$.set(true);
      this.sendTokenOnWebSocket();
    }
  }

  private sendTokenOnWebSocket() {
    const token = tokenGetter();
    if (token && this.socket$ && !this.socket$.closed) {
      this.socket$.next({ auth: token });
    }
  }

  private getNewWebSocket() {
    return webSocket('ws://127.0.0.1:3000/api/ws');
  }

  private handleMessage(data: IncomingMessage) {
    const key = Object.keys(data).length === 1 ? Object.keys(data)[0] : null;
    if (key) {
      if (data[key] === 'pong') {
        console.log('Received pong');
      } else if (data[key] === 'token-needed') {
        console.log('Received auth demand');
        this.sendTokenOnWebSocket();
      } else {
        console.log('Received SSE update:', data);
      }
    }
  }

  private subscribeToUpdates(entityType: string): Observable<any> {
    return new Observable((observer) => {
      if (this.socket$) {
        this.socket$.subscribe({
          next: (data) => {
            if (data[entityType]) {
              observer.next(data[entityType]);
            }
          },
          error: (err) => observer.error(err),
        });
      }
    });
  }
}
