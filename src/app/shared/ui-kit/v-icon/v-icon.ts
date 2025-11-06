import { Component, computed, input } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

export enum IconName {
  Add = 'add',
  Article = 'article',
  Cached = 'cached',
  CalendarMonth = 'calendar_month',
  Check = 'check',
  ChevronLeft = 'chevron_left',
  Close = 'close',
  Delete = 'delete',
  Edit = 'edit',
  KeyboardArrowDown = 'keyboard_arrow_down',
  KeyboardArrowLeft = 'keyboard_arrow_left',
  KeyboardArrowRight = 'keyboard_arrow_right',
  KeyboardArrowUp = 'keyboard_arrow_up',
  LeftPanelClose = 'left_panel_close',
  LeftPanelOpen = 'left_panel_open',
  Login = 'login',
  Logout = 'logout',
  Mic = 'mic',
  Paid = 'paid',
  PersonAdd = 'person_add',
  PhotoCamera = 'photo_camera',
  Refresh = 'refresh',
  Remove = 'remove',
  Restaurant = 'restaurant',
  Scale = 'scale',
  Settings = 'settings',
  Star = 'star',
  SwapHoriz = 'swap_horiz',
  ViewCozy = 'view_cozy',
  Warning = 'warning',
}

@Component({
  selector: 'v-icon',
  templateUrl: './v-icon.html',
  styleUrl: './v-icon.css',
  host: {
    '[style.--v-icon-size]': 'iconUnitSizeString$$()',
    '[style.--v-icon-background]': 'iconBackgroundString$$()',
    '[style.--v-icon-color]': 'color()',
  },
})
export class VIcon {
  public readonly name = input.required<IconName>();
  public readonly size = input<CssUnitValue>(6);
  public readonly color = input<string>();

  public readonly iconBackgroundString$$ = computed(() => {
    return `url(assets/icons/${this.name()}.svg)`;
  });
  public readonly iconUnitSizeString$$ = computed(() => {
    return `var(--unit-${this.size()})`;
  });
}
