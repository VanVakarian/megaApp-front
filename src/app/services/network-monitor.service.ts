import { Injectable, WritableSignal, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkMonitor {
  public isOnline$$: WritableSignal<boolean> = signal(true);

  constructor() {
    // effect(() => { console.log('ISONLINE$$ has been updated:', this.isOnline$$()) }); // prettier-ignore
  }

  public initNetworkEvents(): void {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private updateOnlineStatus(isOnline: boolean): void {
    this.isOnline$$.set(isOnline);
  }
}
