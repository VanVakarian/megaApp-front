import { animate, state, style, transition, trigger } from '@angular/animations';
import { NgClass } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '@app/services/auth.service';
import { MainMenuService } from '@app/services/main-menu.service';

@Component({
  selector: 'app-navbar-mobile',
  standalone: true,
  imports: [RouterLink, NgClass, MatIconModule, MatButtonModule],
  templateUrl: './navbar-mobile.component.html',
  styleUrl: './navbar-mobile.component.scss',
  animations: [
    trigger('menuSlide', [
      state('closed', style({ transform: 'translateX(100%)' })),
      state('open', style({ transform: 'translateX(0)' })),
      transition('closed <=> open', [animate('250ms cubic-bezier(0.68, -0.6, 0.32, 1.6)')]),
    ]),
    trigger('fadeInOut', [
      state('fadeOut', style({ opacity: 0 })),
      state('fadeIn', style({ opacity: 0.75 })),
      transition('fadeOut <=> fadeIn', [animate('250ms ease-in-out')]),
    ]),
  ],
})
export class NavbarMobileComponent {
  @ViewChild('fader') fader!: ElementRef;
  public menuOpened: boolean = false;

  constructor(
    public authService: AuthService,
    private mainMenuService: MainMenuService,
  ) {}

  public closeMenu(): void {
    this.menuOpened = false;
    this.fader.nativeElement.classList.add('hidden');
  }

  public toggleMenu(): void {
    this.menuOpened = !this.menuOpened;
    if (this.menuOpened) {
      this.fader.nativeElement.classList.remove('hidden');
    } else {
      setTimeout(() => {
        this.fader.nativeElement.classList.add('hidden');
      }, 250); // Waiting for the fadeOut animation to complete before hiding fader background
    }
  }

  get mobileButtons() {
    return this.mainMenuService.prepButtons('mobile');
  }
}
