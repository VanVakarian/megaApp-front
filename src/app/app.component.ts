import { Component, OnInit } from '@angular/core';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarDesktopComponent } from '@app/components/main-menu/navbar-desktop/navbar-desktop.component';
import { NavbarMobileComponent } from '@app/components/main-menu/navbar-mobile/navbar-mobile.component';
import { PaginatorLocalisation } from '@app/paginator-localisation';
import { NetworkMonitor } from '@app/services/network-monitor.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  providers: [
    {
      provide: MatPaginatorIntl,
      useClass: PaginatorLocalisation,
    },
  ],
  imports: [NavbarMobileComponent, NavbarDesktopComponent, RouterOutlet, MatNativeDateModule],
})
export class MainAppComponent implements OnInit {
  constructor(
    private dateAdapter: DateAdapter<Date>,
    private networkMonitorService: NetworkMonitor,
    private router: Router,
  ) {
    this.networkMonitorService.initNetworkEvents();
  }

  public ngOnInit(): void {
    this.makeMondayFirstDayOfWeek();
  }

  protected getIsNavbarHidden(): boolean {
    return this.router.url.startsWith('/ui-showcase');
  }

  private makeMondayFirstDayOfWeek() {
    this.dateAdapter.setLocale('ru-RU');
    this.dateAdapter.getFirstDayOfWeek = () => 1;
  }
}
