import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from '@app/app-routes';
import { MainAppComponent } from '@app/app.component';
import { AuthInterceptor } from '@app/services/auth.interceptor';
import { purgeStaleCacheVersions } from '@app/shared/cache';

purgeStaleCacheVersions();

bootstrapApplication(MainAppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
}).catch((err) => console.error(err));
