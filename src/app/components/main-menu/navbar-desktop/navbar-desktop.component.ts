import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';

import { debounceTime, fromEvent, merge, Subscription, throttleTime } from 'rxjs';

import { DarkSwitchComponent } from '@app/components/settings/dark-switch/dark-switch.component';
import { AuthService } from '@app/services/auth.service';
import { MainMenuService } from '@app/services/main-menu.service';

@Component({
  selector: 'app-navbar-desktop',
  standalone: true,
  imports: [RouterLink, MatButtonModule, DarkSwitchComponent],
  templateUrl: './navbar-desktop.component.html',
})
export class NavbarDesktopComponent implements OnInit, OnDestroy {
  private scrollSubscription: Subscription | undefined;
  @ViewChild('header') header!: ElementRef;

  constructor(
    private mainMenuService: MainMenuService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.initScrollListener();
  }

  private initScrollListener(): void {
    // Totally overkill method to detect when to put shadow on fixed navbar, but that shadow looks sooo nice...
    const scroll$ = fromEvent(window, 'scroll');
    const throttledScroll$ = scroll$.pipe(throttleTime(200));
    const debouncedScroll$ = scroll$.pipe(debounceTime(10));
    this.scrollSubscription = merge(throttledScroll$, debouncedScroll$).subscribe(() => this.onScroll());
  }

  ngOnDestroy(): void {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }

  get desktopButtons() {
    return this.mainMenuService.prepButtons('desktop');
  }

  onScroll(): void {
    if (!this.header) {
      return;
    }
    const headerEl = this.header.nativeElement;
    if (window.scrollY > 0) {
      headerEl.classList.add('shadow-md');
    } else {
      headerEl.classList.remove('shadow-md');
    }
  }
}
