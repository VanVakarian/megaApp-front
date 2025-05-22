import { Routes } from '@angular/router';
import { FoodScreenComponent } from '@app/components/food/food-screen.component';
import { MoneyScreenComponent } from '@app/components/money/money-screen.component';
import { SettingsPageComponent } from '@app/components/settings/settings-page.component';
import { UiShowcaseComponent } from '@app/components/ui-sample/ui-showcase.component';
import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';

export const routes: Routes = [
  {
    path: 'food',
    component: FoodScreenComponent,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'food/:section',
    component: FoodScreenComponent,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'money',
    component: MoneyScreenComponent,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'settings',
    component: SettingsPageComponent,
    resolve: { auth: authResolver },
    data: { allowUnauthenticated: true },
  },
  {
    path: 'ui-showcase',
    component: UiShowcaseComponent,
    data: { allowUnauthenticated: true },
  },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
