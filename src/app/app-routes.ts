import { Routes } from '@angular/router';
import { FoodScreen } from '@app/components/food/food-screen';
import { MoneyScreen } from '@app/components/money/money-screen';
import { SettingsPageComponent } from '@app/components/settings/settings-page.component';
import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';
import { Food } from './components/ui-showcase/pages/food/food';
import { Icons } from './components/ui-showcase/pages/icons/icons';
import { Money } from './components/ui-showcase/pages/money/money';
import { Other } from './components/ui-showcase/pages/other/other';
import { Settings } from './components/ui-showcase/pages/settings/settings';
import { UiShowcase } from './components/ui-showcase/ui-showcase';

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
  {
    path: 'ui-showcase',
    component: UiShowcase,
    resolve: { auth: authResolver },
    data: { allowUnauthenticated: true },
    children: [
      { path: 'dishes', component: Food },
      { path: 'finance', component: Money },
      { path: 'icons', component: Icons },
      { path: 'other', component: Other },
      { path: 'settings', component: Settings },
      { path: '', redirectTo: 'other', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
