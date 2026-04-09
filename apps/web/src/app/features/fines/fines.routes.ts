import type { Routes } from '@angular/router';
import { FinesPage } from './pages/fines-page/fines-page';
import { FinesDashboardPage } from './pages/fines-dashboard-page/fines-dashboard-page';

export const FINES_ROUTES: Routes = [
  { path: '', component: FinesPage },
  { path: 'dashboard', component: FinesDashboardPage },
];
