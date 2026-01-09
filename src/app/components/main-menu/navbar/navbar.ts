import { animate, state, style, transition, trigger } from '@angular/animations';
import { NgClass } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { MainMenuService } from '@app/services/main-menu.service';
import { ANIMATION_DURATION_MS, ANIMATION_DURATION_MS_STRING } from '@app/shared/animations';
import { VButton } from '@app/shared/ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/components/v-icon/v-icon';
import { ButtonStyle } from '@app/shared/ui-kit/types';
import { filter } from 'rxjs';

interface MenuButton {
  label: string;
  place: string;
  link: string | string[];
  selected?: boolean;
  chapterSettingName?: string;
  iconName?: string;
  bgClass?: string;
}

function mapMaterialIconToVIcon(materialIcon: string): IconName {
  const mapping: Record<string, IconName> = {
    restaurant: IconName.Restaurant,
    analytics: IconName.Analytics,
    menu_book: IconName.Article,
    remove_red_eye: IconName.Paid,
    settings: IconName.Settings,
    login: IconName.Login,
    person_add: IconName.PersonAdd,
    menu: IconName.Article,
  };
  return mapping[materialIcon] || IconName.Article;
}

@Component({
  selector: 'main-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
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
export class MainNavbar implements OnInit {
  protected readonly fader = viewChild.required<ElementRef>('fader');

  protected readonly Icon = IconName;
  protected readonly ButtonStyle = ButtonStyle;

  protected readonly isMobileMenuOpen$$ = signal(false);
  protected readonly currentUrl$$ = signal('');

  protected readonly isDesktop$$ = computed(() => this.deviceInfoService.isDesktopScreen$$());
  protected readonly forceShowOnUiShowcasePage$$ = computed(() => this.currentUrl$$().startsWith('/ui-showcase'));

  protected readonly visibleButtons$$ = computed(() => {
    const place = this.isDesktop$$() ? 'desktop' : 'mobile';
    return this.mainMenuService.prepButtons(place);
  });

  protected readonly uiShowcaseButtons$$ = computed(() => {
    if (!this.forceShowOnUiShowcasePage$$()) return [];

    const currentUrl = this.currentUrl$$();
    return [
      {
        label: 'Dishes',
        link: '/ui-showcase/dishes',
        iconName: IconName.Restaurant,
        selected: currentUrl.includes('/ui-showcase/dishes'),
      },
      {
        label: 'Finance',
        link: '/ui-showcase/finance',
        iconName: IconName.Paid,
        selected: currentUrl.includes('/ui-showcase/finance'),
      },
      {
        label: 'Icons',
        link: '/ui-showcase/icons',
        iconName: IconName.ViewCozy,
        selected: currentUrl.includes('/ui-showcase/icons'),
      },
      {
        label: 'Other',
        link: '/ui-showcase/other',
        iconName: IconName.Article,
        selected: currentUrl.includes('/ui-showcase/other'),
      },
    ];
  });

  protected readonly mainMenuService = inject(MainMenuService);
  protected readonly authService = inject(AuthService);
  private readonly deviceInfoService = inject(DeviceInfoService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  public ngOnInit(): void {
    this.currentUrl$$.set(this.router.url);
    this.subscribeToRouteChanges();
  }

  protected getButtonStyle(button: MenuButton): ButtonStyle {
    return button.selected ? ButtonStyle.Primary : ButtonStyle.Flat;
  }

  protected getButtonIcon(button: MenuButton): IconName {
    if (!button.iconName) return IconName.Article;
    return mapMaterialIconToVIcon(button.iconName);
  }

  protected toggleMenuCollapse(): void {
    this.mainMenuService.toggleCollapse();
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
    return this.mainMenuService.isCollapsed$$() ? IconName.LeftPanelOpen : IconName.LeftPanelClose;
  }

  private subscribeToRouteChanges(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl$$.set((event as NavigationEnd).urlAfterRedirects);
      });
  }
}
