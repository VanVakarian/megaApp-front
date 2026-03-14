import { Routes } from '@angular/router';
import { authResolver } from '@app/services/auth.resolver';
import { isChapterSelected } from '@app/services/is-chapter-selected.guard';

export const routes: Routes = [
  {
    path: 'food',
    loadComponent: () => import('@app/components/food/food-screen').then((m) => m.FoodScreen),
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'food/:section',
    loadComponent: () => import('@app/components/food/food-screen').then((m) => m.FoodScreen),
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'money',
    loadComponent: () => import('@app/components/money/money-screen').then((m) => m.MoneyScreen),
    resolve: { auth: authResolver },
    canActivate: [isChapterSelected],
  },
  {
    path: 'settings',
    loadComponent: () => import('@app/components/settings/settings').then((m) => m.Settings),
    resolve: { auth: authResolver },
    data: { allowUnauthenticated: true },
  },
  { path: '', redirectTo: 'food', pathMatch: 'full' },
  { path: '**', redirectTo: 'food', pathMatch: 'full' },
];
