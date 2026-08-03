import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { MobileShell } from './layout/mobile-shell/mobile-shell';

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: MobileShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'checklist',
        loadComponent: () =>
          import('./features/checklist/checklist-page').then((m) => m.ChecklistPage),
      },
      {
        path: 'fuel',
        loadComponent: () => import('./features/fuel/fuel-page').then((m) => m.FuelPage),
      },
      {
        path: 'alerts',
        loadComponent: () => import('./features/alerts/alerts-page').then((m) => m.AlertsPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'problem',
        loadComponent: () => import('./features/problem/problem-page').then((m) => m.ProblemPage),
      },
      {
        path: 'responsibility',
        loadComponent: () =>
          import('./features/responsibility/responsibility-page').then((m) => m.ResponsibilityPage),
      },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
