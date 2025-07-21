import { Routes } from '@angular/router';
import { FoodScreenComponent } from '@app/components/food/food-screen.component';
import { MoneyScreen } from '@app/components/money/money-screen';
import { SettingsPageComponent } from '@app/components/settings/settings-page.component';
import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';
import { Food } from './components/ui-showcase/pages/food/food';
import { Money } from './components/ui-showcase/pages/money/money';
import { Other } from './components/ui-showcase/pages/other/other';
import { Settings } from './components/ui-showcase/pages/settings/settings';
import { UiShowcase } from './components/ui-showcase/ui-showcase';

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
    data: { allowUnauthenticated: true },
    children: [
      { path: 'food', component: Food },
      { path: 'money', component: Money },
      { path: 'other', component: Other },
      { path: 'settings', component: Settings },
      { path: '', redirectTo: 'other', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
