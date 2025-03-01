import { Routes } from '@angular/router';

import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';

import { FoodScreenComponent } from '@app/components/food/food-screen.component';
import { MoneyScreenComponent } from '@app/components/money/money-screen.component';
import { SettingsPageComponent } from '@app/components/settings/settings-page.component';

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
  { path: 'settings', component: SettingsPageComponent },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
