import type { Routes } from '@angular/router';
import { MaintenancePage } from './pages/maintenance-page/maintenance-page';

export const MAINTENANCE_ROUTES: Routes = [
  { path: '', component: MaintenancePage },
  {
    path: 'service-orders/new',
    loadComponent: () =>
      import('./pages/service-order-form-page/service-order-form-page').then(
        (m) => m.ServiceOrderFormPage,
      ),
  },
  {
    path: 'service-orders/:id/edit',
    loadComponent: () =>
      import('./pages/service-order-form-page/service-order-form-page').then(
        (m) => m.ServiceOrderFormPage,
      ),
  },
];
