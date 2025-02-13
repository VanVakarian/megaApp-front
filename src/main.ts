import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { MatDialogModule } from '@angular/material/dialog';

import { JwtModule } from '@auth0/angular-jwt';

import { routes } from '@app/app-routes';
import { MainAppComponent } from '@app/app.component';
import { AuthInterceptor } from '@app/services/auth.interceptor';
import { tokenGetter } from '@app/services/auth.service';

bootstrapApplication(MainAppComponent, {
  providers: [
    provideRouter(routes),
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    importProvidersFrom(
      HttpClientModule,
      BrowserAnimationsModule,
      JwtModule.forRoot({
        config: {
          tokenGetter,
          allowedDomains: ['localhost:3000'],
          disallowedRoutes: [
            'localhost:3000/api/auth/login',
            'localhost:3000/api/auth/register',
            'localhost:3000/api/auth/refresh',
          ],
        },
      }),
      MatDialogModule,
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
}).catch((err) => console.error(err));
