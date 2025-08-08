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

  showSyncError(message: string): void {
    this.addNotification('error', `Sync error: ${message}`);
  }

  showSyncSuccess(message: string = 'Data synchronized successfully'): void {
    this.addNotification('success', message);
  }

  showOfflineMode(): void {
    this.addNotification('warning', 'You are offline. Changes will be synchronized when connection is restored.');
  }

  showSyncInProgress(): void {
    this.addNotification('info', 'Synchronizing data...');
  }

  showNetworkError(): void {
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

  removeNotification(id: string): void {
    const current = this.notifications$$();
    this.notifications$$.set(current.filter((n) => n.id !== id));
  }

  clearAll(): void {
    this.notifications$$.set([]);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
