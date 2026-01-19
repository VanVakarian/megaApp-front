import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { routes } from '@app/app-routes';
import { MainAppComponent } from '@app/app.component';
import { AuthInterceptor } from '@app/services/auth.interceptor';
import { tokenGetter } from '@app/services/auth.service';
import { JwtModule } from '@auth0/angular-jwt';

bootstrapApplication(MainAppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    importProvidersFrom(
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
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
}).catch((err) => console.error(err));
