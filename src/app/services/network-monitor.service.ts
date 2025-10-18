import { Injectable, WritableSignal, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkMonitor {
  public readonly isOnline$$: WritableSignal<boolean> = signal(true);

  public initNetworkEvents(): void {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private updateOnlineStatus(isOnline: boolean): void {
    this.isOnline$$.set(isOnline);
  }
}
