import { Component, OnInit } from '@angular/core';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { RouterOutlet } from '@angular/router';

import { NavbarDesktopComponent } from '@app/components/main-menu/navbar-desktop/navbar-desktop.component';
import { NavbarMobileComponent } from '@app/components/main-menu/navbar-mobile/navbar-mobile.component';
import { PaginatorLocalisation } from '@app/paginator-localisation';
import { AuthService } from '@app/services/auth.service';
import { NetworkMonitor } from '@app/services/network-monitor.service';
import { SettingsService } from '@app/services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  providers: [
    {
      provide: MatPaginatorIntl,
      useClass: PaginatorLocalisation,
    },
  ],
  standalone: true,
  imports: [NavbarMobileComponent, NavbarDesktopComponent, RouterOutlet, MatNativeDateModule],
})
export class MainAppComponent implements OnInit {
  constructor(
    private dateAdapter: DateAdapter<Date>,
    public authService: AuthService,
    private settingsService: SettingsService,
    public networkMonitorService: NetworkMonitor,
  ) {
    this.authService.initCheckToken();
    this.networkMonitorService.initNetworkEvents();
  }

  async ngOnInit(): Promise<void> {
    this.makeMondayFirstDayOfWeek();

    await this.settingsService.initLoadSettings();
  }

  private makeMondayFirstDayOfWeek() {
    this.dateAdapter.setLocale('ru-RU');
    this.dateAdapter.getFirstDayOfWeek = () => 1;
  }
}
