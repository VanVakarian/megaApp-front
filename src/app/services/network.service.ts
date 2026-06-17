import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { tokenGetter } from '@app/services/auth.service';
import { IncomingWsMessage, OutgoingWsMessage, WebSocketMessageType } from '@app/shared/types';
import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  public readonly isOnline$$: WritableSignal<boolean> = signal(navigator.onLine);
  public readonly isConnected$$: WritableSignal<boolean> = signal(false);
  public readonly isNetworkAvailable$$ = computed(() => this.isOnline$$());

  public readonly wsMessages$ = new Subject<IncomingWsMessage>();

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelayMs = 5000;
  private readonly clientId: string;
  private shouldReconnect = true;
  private isConnecting = false;

  private readonly notifications = inject(NotificationService);

  constructor() {
    this.clientId = Math.random().toString(36).substring(2, 10);
    this.initNetworkEvents();
  }

  public getClientId(): string {
    return this.clientId;
  }

  public connect(): void {
    this.shouldReconnect = true;

    if (this.isConnecting || this.isSocketActive()) {
      return;
    }

    const token = tokenGetter();
    if (!token) {
      console.warn('Cannot connect WebSocket: no auth token');
      return;
    }

    this.clearReconnectTimer();
    this.isConnecting = true;

    const socket = new WebSocket(this.buildWebSocketURL(token));
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        socket.close();
        return;
      }

      this.isConnecting = false;
      this.isConnected$$.set(true);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      if (this.socket !== socket) {
        return;
      }

      try {
        const message = JSON.parse(event.data) as IncomingWsMessage;
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error('WebSocket message parse failed:', error);
      }
    };

    socket.onerror = () => {
      this.isConnected$$.set(false);
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.isConnecting = false;
      this.isConnected$$.set(false);

      if (this.shouldReconnect && this.isOnline$$() && tokenGetter()) {
        this.scheduleReconnect();
      }
    };
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.isConnecting = false;

    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'Client disconnect');
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }

    this.isConnected$$.set(false);
  }

  public sendMessage(message: OutgoingWsMessage | { type: 'PONG' }): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected$$()) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    console.warn('WebSocket not connected, cannot send message:', message);
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
      return;
    }

    if (this.shouldReconnect && !this.isSocketActive()) {
      this.connect();
    }
  }

  private buildWebSocketURL(token: string): string {
    const encodedToken = encodeURIComponent(token);
    const encodedClientId = encodeURIComponent(this.clientId);
    const baseURL = this.getBaseWebSocketURL();

    return `${baseURL}?token=${encodedToken}&clientId=${encodedClientId}`;
  }

  private getBaseWebSocketURL(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const port = this.resolveWebSocketPort(window.location.port);

    return `${protocol}//${hostname}${port ? `:${port}` : ''}/api/ws`;
  }

  private resolveWebSocketPort(currentPort: string): string {
    if (currentPort === '4200' || currentPort === '4201') {
      return '3000';
    }

    return currentPort;
  }

  private isSocketActive(): boolean {
    if (!this.socket) {
      return false;
    }

    return this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private handleIncomingMessage(data: IncomingWsMessage): void {
    if (data.type === WebSocketMessageType.PING) {
      this.sendMessage({ type: 'PONG' });
      return;
    }

    this.wsMessages$.next(data);
  }
}
