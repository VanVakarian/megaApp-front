import { Component, inject, OnInit } from '@angular/core';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { RouterOutlet } from '@angular/router';
import { MainNavbar } from '@app/components/main-menu/navbar/navbar';
import { PaginatorLocalisation } from '@app/paginator-localisation';
import { MainMenuService } from '@app/services/main-menu.service';
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
  imports: [MainNavbar, RouterOutlet, MatNativeDateModule],
})
export class MainAppComponent implements OnInit {
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly networkMonitorService = inject(NetworkMonitor);
  protected readonly mainMenuService = inject(MainMenuService);

  constructor() {
    this.networkMonitorService.initNetworkEvents();
  }

  public ngOnInit(): void {
    this.makeMondayFirstDayOfTheWeek();
  }

  private makeMondayFirstDayOfTheWeek() {
    this.dateAdapter.setLocale('ru-RU');
    this.dateAdapter.getFirstDayOfWeek = () => 1;
  }
}
