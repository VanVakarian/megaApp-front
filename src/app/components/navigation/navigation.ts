import { animate, state, style, transition, trigger } from '@angular/animations';
import { NgClass } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { MenuButton, NavigationService, UiShowcaseButton } from '@app/services/navigation.service';
import { ANIMATION_DURATION_MS, ANIMATION_DURATION_MS_STRING } from '@app/shared/animations';
import { VButton } from '@app/shared/ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/components/v-icon/v-icon';
import { ButtonStyle } from '@app/shared/ui-kit/types';

@Component({
  selector: 'navigation',
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
  imports: [VButton, VIcon, NgClass],
  animations: [
    trigger('menuSlide', [
      state('closed', style({ transform: 'translateX(100%)' })),
      state('open', style({ transform: 'translateX(0)' })),
      transition('closed <=> open', [
        animate(`${ANIMATION_DURATION_MS_STRING.MEDIUM} cubic-bezier(0.68, -0.6, 0.32, 1.6)`),
      ]),
    ]),
    trigger('fadeInOut', [
      state('fadeOut', style({ opacity: 0 })),
      state('fadeIn', style({ opacity: 0.75 })),
      transition('fadeOut <=> fadeIn', [animate(`${ANIMATION_DURATION_MS_STRING.MEDIUM} ease-in-out`)]),
    ]),
  ],
})
export class Navigation implements OnInit {
  protected readonly fader = viewChild.required<ElementRef>('fader');

  protected readonly Icon = IconName;
  protected readonly ButtonStyle = ButtonStyle;

  protected readonly isMobileMenuOpen$$ = signal(false);

  protected readonly navigationService = inject(NavigationService);
  protected readonly authService = inject(AuthService);
  private readonly deviceInfoService = inject(DeviceInfoService);
  private readonly router = inject(Router);

  protected readonly isDesktop$$ = computed(() => this.deviceInfoService.isDesktopScreen$$());

  protected readonly visibleButtons$$ = computed(() => {
    const place = this.isDesktop$$() ? 'desktop' : 'mobile';
    return this.navigationService.prepButtons(place);
  });

  protected readonly uiShowcaseButtons$$ = this.navigationService.visibleUiShowcaseButtons$$;
  protected readonly forceShowOnUiShowcasePage$$ = this.navigationService.shouldShowUiShowcaseButtons$$;

  public ngOnInit(): void {}

  protected getButtonStyle(button: MenuButton | UiShowcaseButton): ButtonStyle {
    return button.selected ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected toggleMenuCollapse(): void {
    this.navigationService.toggleCollapse();
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen$$.update((value) => !value);
    if (this.isMobileMenuOpen$$()) {
      this.fader().nativeElement.classList.remove('hidden');
    } else {
      setTimeout(() => {
        this.fader().nativeElement.classList.add('hidden');
      }, ANIMATION_DURATION_MS.MEDIUM);
    }
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen$$.set(false);
    setTimeout(() => {
      this.fader().nativeElement.classList.add('hidden');
    }, ANIMATION_DURATION_MS.MEDIUM);
  }

  protected navigateToLink(link: string | string[]): void {
    if (Array.isArray(link)) {
      this.router.navigate(link);
    } else if (link) {
      this.router.navigate([link]);
    }
  }

  protected getCollapseIconName(): IconName {
    return this.navigationService.isCollapsed$$() ? IconName.LeftPanelOpen : IconName.LeftPanelClose;
  }
}
