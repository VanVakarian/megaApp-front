import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { inject, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';
import { routes } from '@app/app-routes';
import { MainAppComponent } from '@app/app.component';
import { AuthInterceptor } from '@app/services/auth.interceptor';
import { NotificationService } from '@app/services/notification.service';
import { purgeStaleCacheVersions } from '@app/shared/cache';
import { isChunkLoadError } from '@app/shared/chunk-load-error';

purgeStaleCacheVersions();

function handleNavigationError(error: NavigationError): void {
  console.error('🧭 Navigation failed:', error.url, error.error);

  if (isChunkLoadError(error.error)) {
    window.location.reload();
    return;
  }

  inject(NotificationService).addNotification('error', 'Не удалось открыть страницу — обновите вкладку');
}

bootstrapApplication(MainAppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes, withNavigationErrorHandler(handleNavigationError)),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
}).catch((err) => console.error(err));
