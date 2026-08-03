import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';
import { SettingsPage } from './pages/settings-page/settings-page';

export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsPage },
  {
    // Painel de IA é exclusivo do OWNER (TASK 3.8).
    path: 'ai',
    canActivate: [roleGuard],
    data: { roles: ['OWNER'] },
    loadChildren: () =>
      import('../ai-settings/ai-settings.routes').then((m) => m.AI_SETTINGS_ROUTES),
  },
];
