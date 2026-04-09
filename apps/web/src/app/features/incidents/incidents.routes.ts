import type { Routes } from '@angular/router';
import { IncidentFormPage } from './pages/incident-form-page/incident-form-page';
import { IncidentsPage } from './pages/incidents-page/incidents-page';

export const INCIDENTS_ROUTES: Routes = [
  { path: '', component: IncidentsPage },
  { path: 'new', component: IncidentFormPage },
  { path: ':id/edit', component: IncidentFormPage },
];
