import type { Routes } from '@angular/router';
import { DocumentsPage } from './pages/documents-page/documents-page';

export const DOCUMENTS_ROUTES: Routes = [
  { path: '', component: DocumentsPage },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/documents-form-page/documents-form-page').then((m) => m.DocumentsFormPage),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/documents-form-page/documents-form-page').then((m) => m.DocumentsFormPage),
  },
];
