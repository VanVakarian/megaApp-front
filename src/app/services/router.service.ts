import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RouterService {
  private readonly currentRouteSubject: BehaviorSubject<string> = new BehaviorSubject<string>('');
  public readonly currentRoute$ = this.currentRouteSubject.asObservable();

  private readonly router = inject(Router);

  constructor() {
    this.subscribeToRouteChanges();
  }

  private subscribeToRouteChanges(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const navEndEvent = event as NavigationEnd;
      this.currentRouteSubject.next(navEndEvent.urlAfterRedirects);
    });
  }
}
