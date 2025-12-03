import { Routes } from '@angular/router';

export const fuelRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fuel-list/fuel-list.component').then(m => m.FuelListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/fuel-form/fuel-form.component').then(m => m.FuelFormComponent),
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./pages/fuel-form/fuel-form.component').then(m => m.FuelFormComponent),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/fuel-analytics/fuel-analytics.component').then(m => m.FuelAnalyticsComponent),
  },
];
