import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },
  {
    path: 'vehicles',
    canActivate: [authGuard],
    loadChildren: () => import('./features/vehicles/vehicles.routes').then(m => m.VEHICLES_ROUTES)
  },
  {
    path: 'maintenance',
    canActivate: [authGuard],
    loadChildren: () => import('./features/maintenance/maintenance.routes').then(m => m.maintenanceRoutes)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
