import { Component, inject, OnInit } from '@angular/core';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { RouterOutlet } from '@angular/router';
import { Navigation } from '@app/components/navigation/navigation';
import { PaginatorLocalisation } from '@app/paginator-localisation';
import { NavigationService } from '@app/services/navigation.service';
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
  imports: [Navigation, RouterOutlet, MatNativeDateModule],
})
export class MainAppComponent implements OnInit {
  protected readonly navigationService = inject(NavigationService);
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly networkMonitorService = inject(NetworkMonitor);

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
