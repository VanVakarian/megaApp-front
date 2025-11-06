import { Injectable, signal, WritableSignal } from '@angular/core';

export interface NotificationMessage {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  public notifications$$: WritableSignal<NotificationMessage[]> = signal([]);

  public showSyncError(message: string): void {
    this.addNotification('error', `Sync error: ${message}`);
  }

  public showSyncSuccess(message: string = 'Data synchronized successfully'): void {
    this.addNotification('success', message);
  }

  public showOfflineMode(): void {
    this.addNotification('warning', 'You are offline. Changes will be synchronized when connection is restored.');
  }

  public showSyncInProgress(): void {
    this.addNotification('info', 'Synchronizing data...');
  }

  public showNetworkError(): void {
    this.addNotification('error', 'Network error. Please check your connection.');
  }

  private addNotification(type: NotificationMessage['type'], message: string): void {
    const notification: NotificationMessage = {
      id: this.generateId(),
      type,
      message,
      timestamp: Date.now(),
    };

    const current = this.notifications$$();
    this.notifications$$.set([...current, notification]);

    setTimeout(() => {
      this.removeNotification(notification.id);
    }, 5000);
  }

  private removeNotification(id: string): void {
    const current = this.notifications$$();
    this.notifications$$.set(current.filter((n) => n.id !== id));
  }

  private clearAll(): void {
    this.notifications$$.set([]);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
