import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { ButtonStyle } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { filter } from 'rxjs';

enum SelectedPage {
  Food = 'food',
  Money = 'money',
  Other = 'other',
  Icons = 'icons',
  Settings = 'settings',
}

@Component({
  selector: 'navbar',
  templateUrl: './navbar.html',
  imports: [VButton, VIcon],
})
export class Navbar implements OnInit {
  protected selectedPage: SelectedPage = SelectedPage.Other;
  protected readonly Icon = IconName;
  protected isMenuCollapsed = true; // TODO: move to settings

  protected readonly ButtonStyle = ButtonStyle;

  constructor(
    private router: Router,
    private destroyRef: DestroyRef,
  ) {}

  public ngOnInit(): void {
    this.updateSelectedPageFromUrl(this.router.url);
    this.subscribe();
  }

  protected navigateToFood(): void {
    this.router.navigate(['/ui-showcase/food']);
  }

  protected navigateToMoney(): void {
    this.router.navigate(['/ui-showcase/money']);
  }

  protected navigateToIcons(): void {
    this.router.navigate(['/ui-showcase/icons']);
  }

  protected navigateToOther(): void {
    this.router.navigate(['/ui-showcase/other']);
  }

  protected navigateToSettings(): void {
    this.router.navigate(['/ui-showcase/settings']);
  }

  protected foodButtonStyle(): ButtonStyle {
    return this.selectedPage === SelectedPage.Food ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected moneyButtonStyle(): ButtonStyle {
    return this.selectedPage === SelectedPage.Money ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected otherButtonStyle(): ButtonStyle {
    return this.selectedPage === SelectedPage.Other ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected settingsButtonStyle(): ButtonStyle {
    return this.selectedPage === SelectedPage.Settings ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected iconsButtonStyle(): ButtonStyle {
    return this.selectedPage === SelectedPage.Icons ? ButtonStyle.Raised : ButtonStyle.Flat;
  }

  protected toggleMenuCollapse(): void {
    this.isMenuCollapsed = !this.isMenuCollapsed;
  }

  protected getMenuSizeControlIconName(): IconName {
    return this.isMenuCollapsed ? IconName.LeftPanelOpen : IconName.LeftPanelClose;
  }

  private subscribe(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.updateSelectedPageFromUrl(event.urlAfterRedirects);
      });
  }

  private updateSelectedPageFromUrl(url: string): void {
    if (url.includes('/ui-showcase/food')) {
      this.selectedPage = SelectedPage.Food;
    } else if (url.includes('/ui-showcase/money')) {
      this.selectedPage = SelectedPage.Money;
    } else if (url.includes('/ui-showcase/settings')) {
      this.selectedPage = SelectedPage.Settings;
    } else if (url.includes('/ui-showcase/icons')) {
      this.selectedPage = SelectedPage.Icons;
    } else {
      this.selectedPage = SelectedPage.Other;
    }
  }
}
