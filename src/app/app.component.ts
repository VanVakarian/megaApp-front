import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from '@app/components/navigation/navigation';
import { Notifications } from '@app/components/notifications/notifications';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { NavigationService } from '@app/services/navigation.service';
import { NetworkMonitor } from '@app/services/network-monitor.service';
import { PerformanceMetricsService } from '@app/services/performance-metrics.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [Navigation, RouterOutlet, Notifications],
})
export class MainAppComponent implements OnInit {
  protected readonly AuthSessionState = AuthSessionState;

  protected readonly navigationService = inject(NavigationService);
  protected readonly authService = inject(AuthService);
  private readonly networkMonitorService = inject(NetworkMonitor);
  private readonly performanceMetricsService = inject(PerformanceMetricsService);

  constructor() {
    this.networkMonitorService.initNetworkEvents();
  }

  public ngOnInit(): void {
    void this.authService.ensureBootstrapped();
  }
}
