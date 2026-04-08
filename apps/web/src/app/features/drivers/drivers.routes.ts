import type { Routes } from '@angular/router';
import { DriversPage } from './pages/drivers-page/drivers-page';

export const DRIVERS_ROUTES: Routes = [
  { path: '', component: DriversPage },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/driver-form-page/driver-form-page').then((m) => m.DriverFormPage),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/driver-form-page/driver-form-page').then((m) => m.DriverFormPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/driver-detail-page/driver-detail-page').then((m) => m.DriverDetailPage),
  },
];
