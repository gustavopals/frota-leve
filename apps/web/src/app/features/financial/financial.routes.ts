import type { Routes } from '@angular/router';
import { FinancialPage } from './pages/financial-page/financial-page';

export const FINANCIAL_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: FinancialPage },
  {
    path: 'comparison',
    loadComponent: () =>
      import('./pages/comparison-page/comparison-page').then((m) => m.ComparisonPage),
  },
  {
    path: 'comparison/:vehicleId',
    loadComponent: () =>
      import('./pages/comparison-page/comparison-page').then((m) => m.ComparisonPage),
  },
  {
    path: 'tco',
    loadComponent: () => import('./pages/tco-page/tco-page').then((m) => m.TcoPage),
  },
  {
    path: 'tco/:vehicleId',
    loadComponent: () => import('./pages/tco-page/tco-page').then((m) => m.TcoPage),
  },
];
