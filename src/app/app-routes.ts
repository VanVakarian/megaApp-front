import { Routes } from '@angular/router';
import { FoodScreen } from '@app/components/food/food-screen';
import { MoneyScreen } from '@app/components/money/money-screen';
import { SettingsPageComponent } from '@app/components/settings/settings-page.component';
import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';

export const routes: Routes = [
  {
    path: 'food',
    component: FoodScreen,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'food/:section',
    component: FoodScreen,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'money',
    component: MoneyScreen,
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'settings',
    component: SettingsPageComponent,
    resolve: { auth: authResolver },
    data: { allowUnauthenticated: true },
  },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
