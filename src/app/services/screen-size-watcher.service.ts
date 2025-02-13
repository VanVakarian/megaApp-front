import { Injectable } from '@angular/core';
import { fromEvent } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';
import { ScreenType } from '../shared/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ScreenSizeWatcherService {
  private readonly MOBILE_BREAKPOINT = 1024;

  public screenType$ = fromEvent(window, 'resize').pipe(
    startWith(null),
    map(() => (window.innerWidth < this.MOBILE_BREAKPOINT ? ScreenType.MOBILE : ScreenType.DESKTOP)),
    distinctUntilChanged(),
    shareReplay(1),
  );

  public get currentScreenType(): ScreenType {
    return window.innerWidth < this.MOBILE_BREAKPOINT ? ScreenType.MOBILE : ScreenType.DESKTOP;
  }
}
