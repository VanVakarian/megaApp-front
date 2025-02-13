import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';

import { BehaviorSubject, EMPTY, Subscription, of, timer } from 'rxjs';
import { catchError, retry, switchMap } from 'rxjs/operators';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';

import { tokenGetter } from '@app/services/auth.service';
import { IncomingMessage } from '@app/shared/interfaces';

@Injectable({
  providedIn: 'root',
})
export class NetworkService implements OnDestroy {
  private socket$: WebSocketSubject<any> | undefined;
  private reconnectDelaySec = 1; // время задержки между попытками переподключения в случае потери соединения с сервером
  private connectionStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private connectionStatusSubscription: Subscription;
  // private pingInterval: any;
  // private pingIntervalSec: number = 50;
  private isConnected: boolean = false;

  constructor(private http: HttpClient) {
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
      console.log('Connecting...');
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
            return EMPTY;
          }),
        )
        .subscribe({
          next: (payload) => this.handleMessage(payload),
          error: (err) => {
            console.error('WebSocket connection error:', err);
            this.connectionStatus.next(false);
            this.isConnected = false;
          },
          complete: () => {
            console.warn('WebSocket connection closed');
            this.connectionStatus.next(false);
            this.isConnected = false;
          },
        });

      this.connectionStatus.next(true);
      this.isConnected = true;
      // this.initWsPingPong(); // TODO: See if I need this to keep ws connection live
      this.sendTokenOnWebSocket();
    }
  }

  // public initWsPingPong() {
  //   if (this.pingInterval) {
  //     clearInterval(this.pingInterval);
  //   }
  //   this.pingInterval = setInterval(() => {
  //     if (this.socket$ && !this.socket$.closed) {
  //       this.socket$.next({ message: 'ping' });
  //     }
  //   }, this.pingIntervalSec * 1000);
  // }

  private sendTokenOnWebSocket() {
    const token = tokenGetter();
    // console.log('Sending token:', token);
    if (token && this.socket$ && !this.socket$.closed) {
      this.socket$.next({ auth: token });
    }
  }

  private getNewWebSocket() {
    return webSocket('ws://127.0.0.1:3000/api/ws');
  }

  private handleMessage(data: IncomingMessage) {
    // console.log('Received message:', data);
    const key = Object.keys(data).length === 1 ? Object.keys(data)[0] : null;
    if (key) {
      if (data[key] === 'pong') {
        console.log('Received pong');
      } else if (data[key] === 'token-needed') {
        console.log('Received auth demand');
        this.sendTokenOnWebSocket();
      }
    }
  }

  ngOnDestroy() {
    this.connectionStatusSubscription.unsubscribe();

    // if (this.pingInterval) {
    //   clearInterval(this.pingInterval);
    // }

    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
