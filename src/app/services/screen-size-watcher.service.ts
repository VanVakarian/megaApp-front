import { Injectable, signal } from '@angular/core';
import { fromEvent } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

export enum ScreenType {
  MOBILE = 'MOBILE',
  DESKTOP = 'DESKTOP',
}

@Injectable({
  providedIn: 'root',
})
export class ScreenSizeWatcherService {
  public isMobile$$ = signal(window.innerWidth < 1024);

  private readonly MOBILE_BREAKPOINT = 1024;

  constructor() {
    this.setupResizeListener();
  }

  public screenType$ = fromEvent(window, 'resize').pipe(
    startWith(null),
    map(() => (window.innerWidth < this.MOBILE_BREAKPOINT ? ScreenType.MOBILE : ScreenType.DESKTOP)),
    distinctUntilChanged(),
    shareReplay(1),
  );

  public get currentScreenType(): ScreenType {
    return window.innerWidth < this.MOBILE_BREAKPOINT ? ScreenType.MOBILE : ScreenType.DESKTOP;
  }

  private setupResizeListener(): void {
    fromEvent(window, 'resize')
      .pipe(
        startWith(null),
        map(() => window.innerWidth < this.MOBILE_BREAKPOINT),
        distinctUntilChanged(),
      )
      .subscribe((isMobile) => {
        console.log('isMobile:', isMobile);
        this.isMobile$$.set(isMobile);
      });
  }
}
