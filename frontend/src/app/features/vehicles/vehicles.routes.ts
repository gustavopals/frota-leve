import { Routes } from '@angular/router';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/vehicle-list/vehicle-list').then(m => m.VehicleListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form').then(m => m.VehicleFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form').then(m => m.VehicleFormComponent)
  }
];
