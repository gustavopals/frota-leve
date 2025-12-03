import { Routes } from '@angular/router';

export const checklistRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/submission-list/submission-list.component').then(
        (m) => m.SubmissionListComponent
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/submission-form/submission-form.component').then(
        (m) => m.SubmissionFormComponent
      ),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./pages/template-list/template-list.component').then(
        (m) => m.TemplateListComponent
      ),
  },
  {
    path: 'templates/new',
    loadComponent: () =>
      import('./pages/template-form/template-form.component').then(
        (m) => m.TemplateFormComponent
      ),
  },
  {
    path: 'templates/edit/:id',
    loadComponent: () =>
      import('./pages/template-form/template-form.component').then(
        (m) => m.TemplateFormComponent
      ),
  },
];
