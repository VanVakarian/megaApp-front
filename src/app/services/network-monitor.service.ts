import { Injectable, WritableSignal, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkMonitor {
  // public onlineSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$$: WritableSignal<boolean> = signal(true);

  constructor() {
    // effect(() => { console.log('ISONLINE$$ has been updated:', this.isOnline$$()) }); // prettier-ignore
  }

  public initNetworkEvents(): void {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private updateOnlineStatus(isOnline: boolean): void {
    console.log('Network status changed:', isOnline ? 'online' : 'offline');
    this.isOnline$$.set(isOnline);
  }
}
