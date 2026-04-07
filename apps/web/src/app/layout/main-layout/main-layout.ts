import { Component } from '@angular/core';
import type { PoMenuItem, PoToolbarAction, PoToolbarProfile } from '@po-ui/ng-components';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-main-layout',
  standalone: false,
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  protected readonly appName = environment.appName;
  protected readonly appVersion = environment.version;
  protected readonly menus: PoMenuItem[] = [
    { label: 'Dashboard', link: '/dashboard' },
    { label: 'Veiculos', link: '/vehicles' },
    { label: 'Motoristas', link: '/drivers' },
    { label: 'Combustivel', link: '/fuel' },
    { label: 'Manutencao', link: '/maintenance' },
    { label: 'Pneus', link: '/tires' },
    { label: 'Multas', link: '/fines' },
    { label: 'Documentos', link: '/documents' },
    { label: 'Sinistros', link: '/incidents' },
    { label: 'Financeiro', link: '/financial' },
    { label: 'Relatorios', link: '/reports' },
    { label: 'IA', link: '/ai-assistant' },
    { label: 'Configuracoes', link: '/settings' },
  ];
  constructor(private readonly authService: AuthService) {}

  protected get profileActions(): PoToolbarAction[] {
    return [
      {
        label: 'Sair',
        action: () => this.authService.logout(),
      },
    ];
  }

  protected get toolbarProfile(): PoToolbarProfile | undefined {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return undefined;
    }

    return {
      title: user.name,
      subtitle: user.email,
      avatar: user.avatarUrl ?? undefined,
    };
  }

  protected get currentTenantName(): string {
    return this.authService.getCurrentTenant()?.name ?? 'Operacao principal';
  }
}
