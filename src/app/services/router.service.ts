import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RouterService {
  private currentRouteSubject: BehaviorSubject<string> = new BehaviorSubject<string>('');
  public currentRoute$ = this.currentRouteSubject.asObservable();

  constructor(private router: Router) {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const navEndEvent = event as NavigationEnd;
      this.currentRouteSubject.next(navEndEvent.urlAfterRedirects);
    });
  }
}
