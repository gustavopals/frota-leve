import type { Routes } from '@angular/router';
import { ChecklistTemplateEditorPage } from './pages/checklist-template-editor-page/checklist-template-editor-page';

export const CHECKLISTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: ChecklistTemplateEditorPage },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/checklist-executions-history-page/checklist-executions-history-page').then(
        (m) => m.ChecklistExecutionsHistoryPage,
      ),
  },
];
