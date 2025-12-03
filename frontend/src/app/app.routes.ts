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
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'vehicles',
        loadChildren: () => import('./features/vehicles/vehicles.routes').then(m => m.VEHICLES_ROUTES)
      },
      {
        path: 'maintenance',
        loadChildren: () => import('./features/maintenance/maintenance.routes').then(m => m.maintenanceRoutes)
      },
      {
        path: 'fuel',
        loadChildren: () => import('./features/fuel/fuel.routes').then(m => m.fuelRoutes)
      },
      {
        path: 'checklist',
        loadChildren: () => import('./features/checklist/checklist.routes').then(m => m.checklistRoutes)
      },
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
