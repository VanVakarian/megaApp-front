import { Injectable } from '@angular/core';

import { RouterService } from '@app/services/router.service';
import { SettingsService } from '@app/services/settings.service';
import { SettingsChapterNames } from '@app/shared/interfaces';

interface MenuButton {
  label: string;
  place: 'mobile' | 'desktop' | 'both';
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
  private buttons: MenuButton[] = [
    {
      label: 'Дневник питания',
      place: 'both',
      link: ['/food', 'diary'],
      selected: false,
      chapterSettingName: 'selectedChapterFood',
      iconName: 'restaurant',
      bgClass: 'food-bg',
    },
    {
      label: 'Статистика',
      place: 'mobile',
      link: ['/food', 'stats'],
      chapterSettingName: 'selectedChapterFood',
      iconName: 'insights',
      bgClass: 'food-bg',
    },
    {
      label: 'Каталог еды',
      place: 'mobile',
      link: ['/food', 'catalogue'],
      chapterSettingName: 'selectedChapterFood',
      iconName: 'menu_book',
      bgClass: 'food-bg',
    },
    {
      label: 'Дневник финансов',
      place: 'both',
      link: '/money',
      selected: false,
      chapterSettingName: 'selectedChapterMoney',
      iconName: 'remove_red_eye',
      bgClass: 'money-bg',
    },
    {
      label: 'DarkThemeSwitch',
      place: 'desktop',
      link: '',
    },
    {
      label: 'Настройки',
      place: 'both',
      link: '/settings',
      selected: false,
      iconName: 'settings',
      bgClass: 'settings-bg',
    },
  ];

  // public buttonsOld: MobileMenuButton[] = [
  //   // { label: 'Дневник операций', link: '/money-transactions', requiresAuth: true, iconName: 'receipt_long', bgClass: 'money-bg' }, // prettier-ignore
  //   // { label: 'Управление', link: '/money-manage', requiresAuth: true, iconName: 'account_balance', bgClass: 'money-bg' }, // prettier-ignore
  //   // { label: 'Войти', link: '/login', requiresAuth: false, iconName: 'login', bgClass: 'login-bg' }, // prettier-ignore
  //   // { label: 'Зарегистрироваться', link: '/register', requiresAuth: false, iconName: 'person_add', bgClass: 'register-bg' }, // prettier-ignore
  // ];

  constructor(
    private routerService: RouterService,
    private settingsService: SettingsService,
  ) {
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

  public prepButtons(place: 'mobile' | 'desktop'): MenuButton[] {
    return this.buttons.filter((button) => {
      const chapterName: SettingsChapterNames = button.chapterSettingName as SettingsChapterNames;
      const chapterSelected = chapterName ? this.settingsService.settings$$()[chapterName] : true; // showing button if there's no chapterSettingName setting in buttons
      return (button.place === place || button.place === 'both') && chapterSelected;
    });
  }
}
