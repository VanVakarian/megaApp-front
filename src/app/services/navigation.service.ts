import { computed, inject, Injectable, signal } from '@angular/core';

import { AuthService } from '@app/services/auth.service';
import { RouterService } from '@app/services/router.service';
import { SettingsService } from '@app/services/settings.service';
import { SettingsChapterNames } from '@app/shared/types';
import { IconName } from '@ui-kit/components/v-icon/v-icon';

enum MenuPlace {
  Mobile = 'mobile',
  Desktop = 'desktop',
  Both = 'both',
}

export interface MenuButton {
  label: string;
  place: MenuPlace;
  link: string | string[];
  selected?: boolean;
  chapterSettingName?: SettingsChapterNames;
  adminOnly?: boolean;
  iconName: IconName;
  bgClass?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private readonly COLLAPSE_STORAGE_KEY = 'navbar-collapsed';

  private readonly isNavbarCollapsed$$ = signal(true);
  private readonly currentRoute$signal = signal('');
  private readonly navbarWidthPx$$ = signal(0);

  public readonly isCollapsed$$ = computed(() => this.isNavbarCollapsed$$());

  public readonly navbarWidth$$ = computed(() => {
    return `${this.navbarWidthPx$$()}px`;
  });

  public readonly currentRoute$$ = computed(() => this.currentRoute$signal());

  private readonly buttons: MenuButton[] = [
    {
      label: 'Дневник питания',
      place: MenuPlace.Both,
      link: ['/food', 'diary'],
      selected: false,
      chapterSettingName: 'selectedChapterFood',
      iconName: IconName.Restaurant,
      bgClass: 'food-bg',
    },
    {
      label: 'Статистика',
      place: MenuPlace.Mobile,
      link: ['/food', 'stats'],
      chapterSettingName: 'selectedChapterFood',
      iconName: IconName.Analytics,
      bgClass: 'food-bg',
    },
    // {
    //   label: 'Каталог еды',
    //   place: MenuPlace.Mobile,
    //   link: ['/food', 'catalogue'],
    //   chapterSettingName: 'selectedChapterFood',
    //   iconName: IconName.Article,
    //   bgClass: 'food-bg',
    // },
    {
      label: 'Дневник финансов',
      place: MenuPlace.Both,
      link: '/money',
      selected: false,
      chapterSettingName: 'selectedChapterMoney',
      iconName: IconName.MoneyBag,
      bgClass: 'money-bg',
    },
    {
      label: 'Time Log',
      place: MenuPlace.Both,
      link: '/time',
      selected: false,
      chapterSettingName: 'selectedChapterTime',
      iconName: IconName.WatchScreentime,
      bgClass: 'time-bg',
    },
    {
      label: 'Метрики',
      place: MenuPlace.Both,
      link: '/metrics',
      selected: false,
      adminOnly: true,
      iconName: IconName.Monitoring,
      bgClass: 'settings-bg',
    },
    {
      label: 'DarkThemeSwitch',
      place: MenuPlace.Desktop,
      link: '',
      iconName: IconName.QuestionMark, // TODO [136]: implement dark mode
    },
    {
      label: 'Настройки',
      place: MenuPlace.Both,
      link: '/settings',
      selected: false,
      iconName: IconName.Settings,
      bgClass: 'settings-bg',
    },
  ];

  private readonly routerService = inject(RouterService);
  private readonly settingsService = inject(SettingsService);
  private readonly authService = inject(AuthService);

  constructor() {
    this.subscribeToRouteChanges();
    this.initCollapseState();
  }

  public toggleCollapse(): void {
    this.isNavbarCollapsed$$.set(!this.isNavbarCollapsed$$());
    localStorage.setItem(this.COLLAPSE_STORAGE_KEY, String(this.isNavbarCollapsed$$()));
  }

  public setNavbarWidthPx(width: number): void {
    this.navbarWidthPx$$.set(Math.max(0, Math.ceil(width)));
  }

  private initCollapseState(): void {
    const saved = localStorage.getItem(this.COLLAPSE_STORAGE_KEY);
    this.isNavbarCollapsed$$.set(saved === null ? true : saved === 'true');
  }

  public prepButtons(place: 'mobile' | 'desktop'): MenuButton[] {
    return this.buttons.filter((button) => {
      const chapterName: SettingsChapterNames = button.chapterSettingName as SettingsChapterNames;
      const chapterSelected = chapterName ? this.settingsService.settings$$()[chapterName] : true;
      const adminAllowed = !button.adminOnly || this.authService.isAdmin$$();
      return (button.place === place || button.place === 'both') && chapterSelected && adminAllowed;
    });
  }

  private subscribeToRouteChanges() {
    this.routerService.currentRoute$.subscribe((route) => {
      this.currentRoute$signal.set(route);

      this.buttons.forEach((btn) => {
        if (btn.hasOwnProperty('selected')) {
          if (Array.isArray(btn.link)) {
            btn.selected = btn.link.some((link) => route.includes(link));
          } else {
            btn.selected = route.includes(btn.link);
          }
        }
      });
    });
  }
}
