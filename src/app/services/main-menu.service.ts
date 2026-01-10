import { computed, inject, Injectable, signal } from '@angular/core';

import { DeviceInfoService } from '@app/services/device-info.service';
import { RouterService } from '@app/services/router.service';
import { SettingsService } from '@app/services/settings.service';
import { SettingsChapterNames } from '@app/shared/interfaces';

enum MenuPlace {
  Mobile = 'mobile',
  Desktop = 'desktop',
  Both = 'both',
}

enum MenuWidthPx {
  Collapsed = 60,
  Expanded = 242,
}

interface MenuButton {
  label: string;
  place: MenuPlace;
  link: string | string[];
  selected?: boolean;
  chapterSettingName?: SettingsChapterNames;
  iconName?: string;
  bgClass?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MainMenuService {
  private readonly COLLAPSE_STORAGE_KEY = 'navbar-collapsed';

  private readonly isNavbarCollapsed$$ = signal(true);
  private readonly deviceInfoService = inject(DeviceInfoService);

  public readonly isCollapsed$$ = computed(() => this.isNavbarCollapsed$$());

  public readonly navbarWidth$$ = computed(() => {
    if (!this.deviceInfoService.isDesktopScreen$$()) return 0;
    return this.isNavbarCollapsed$$() ? MenuWidthPx.Collapsed : MenuWidthPx.Expanded;
  });

  private readonly buttons: MenuButton[] = [
    {
      label: 'Дневник питания',
      place: MenuPlace.Both,
      link: ['/food', 'diary'],
      selected: false,
      chapterSettingName: 'selectedChapterFood',
      iconName: 'restaurant',
      bgClass: 'food-bg',
    },
    {
      label: 'Статистика',
      place: MenuPlace.Mobile,
      link: ['/food', 'stats'],
      chapterSettingName: 'selectedChapterFood',
      iconName: 'analytics',
      bgClass: 'food-bg',
    },
    // {
    //   label: 'Каталог еды',
    //   place: MenuPlace.Mobile,
    //   link: ['/food', 'catalogue'],
    //   chapterSettingName: 'selectedChapterFood',
    //   iconName: 'menu_book',
    //   bgClass: 'food-bg',
    // },
    {
      label: 'Дневник финансов',
      place: MenuPlace.Both,
      link: '/money',
      selected: false,
      chapterSettingName: 'selectedChapterMoney',
      iconName: 'remove_red_eye',
      bgClass: 'money-bg',
    },
    {
      label: 'DarkThemeSwitch',
      place: MenuPlace.Desktop,
      link: '',
    },
    {
      label: 'Настройки',
      place: MenuPlace.Both,
      link: '/settings',
      selected: false,
      iconName: 'settings',
      bgClass: 'settings-bg',
    },
  ];

  private readonly routerService = inject(RouterService);
  private readonly settingsService = inject(SettingsService);

  constructor() {
    this.subscribeToRouteChanges();
    this.initCollapseState();
  }

  public toggleCollapse(): void {
    this.isNavbarCollapsed$$.set(!this.isNavbarCollapsed$$());
    localStorage.setItem(this.COLLAPSE_STORAGE_KEY, String(this.isNavbarCollapsed$$()));
  }

  private initCollapseState(): void {
    const saved = localStorage.getItem(this.COLLAPSE_STORAGE_KEY);
    this.isNavbarCollapsed$$.set(saved === null ? true : saved === 'true');
  }

  public prepButtons(place: 'mobile' | 'desktop'): MenuButton[] {
    return this.buttons.filter((button) => {
      const chapterName: SettingsChapterNames = button.chapterSettingName as SettingsChapterNames;
      const chapterSelected = chapterName ? this.settingsService.settings$$()[chapterName] : true; // showing button if there's no chapterSettingName setting in buttons
      return (button.place === place || button.place === 'both') && chapterSelected;
    });
  }

  private subscribeToRouteChanges() {
    this.routerService.currentRoute$.subscribe((route) => {
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
