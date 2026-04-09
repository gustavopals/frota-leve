import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { MainLayout } from './layout/main-layout/main-layout';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainLayout,
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'onboarding',
        loadChildren: () =>
          import('./features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
      },
      {
        path: 'vehicles',
        loadChildren: () =>
          import('./features/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
      },
      {
        path: 'drivers',
        loadChildren: () =>
          import('./features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
      },
      {
        path: 'fuel',
        loadChildren: () => import('./features/fuel/fuel.routes').then((m) => m.FUEL_ROUTES),
      },
      {
        path: 'maintenance',
        loadChildren: () =>
          import('./features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      {
        path: 'checklists',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'ADMIN', 'MANAGER'] },
        loadChildren: () =>
          import('./features/checklists/checklists.routes').then((m) => m.CHECKLISTS_ROUTES),
      },
      {
        path: 'tires',
        loadChildren: () => import('./features/tires/tires.routes').then((m) => m.TIRES_ROUTES),
      },
      {
        path: 'fines',
        loadChildren: () => import('./features/fines/fines.routes').then((m) => m.FINES_ROUTES),
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        path: 'incidents',
        loadChildren: () =>
          import('./features/incidents/incidents.routes').then((m) => m.INCIDENTS_ROUTES),
      },
      {
        path: 'financial',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'ADMIN', 'FINANCIAL'] },
        loadChildren: () =>
          import('./features/financial/financial.routes').then((m) => m.FINANCIAL_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'ai-assistant',
        loadChildren: () =>
          import('./features/ai-assistant/ai-assistant.routes').then((m) => m.AI_ASSISTANT_ROUTES),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'ADMIN'] },
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
