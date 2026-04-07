import type { Routes } from '@angular/router';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page';

export const VEHICLES_ROUTES: Routes = [
  { path: '', component: VehiclesPage },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/vehicle-form-page/vehicle-form-page').then((m) => m.VehicleFormPage),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/vehicle-form-page/vehicle-form-page').then((m) => m.VehicleFormPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/vehicle-detail-page/vehicle-detail-page').then((m) => m.VehicleDetailPage),
  },
];
