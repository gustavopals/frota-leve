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
    { icon: 'an an-house-line', label: 'Dashboard', link: '/dashboard', shortLabel: 'Dash' },
    { icon: 'an an-car-profile', label: 'Veiculos', link: '/vehicles', shortLabel: 'Veic' },
    { icon: 'an an-users-three', label: 'Motoristas', link: '/drivers', shortLabel: 'Moto' },
    { icon: 'an an-gas-pump', label: 'Combustivel', link: '/fuel', shortLabel: 'Comb' },
    { icon: 'an an-wrench', label: 'Manutencao', link: '/maintenance', shortLabel: 'Manu' },
    { icon: 'an an-circle-half-tilt', label: 'Pneus', link: '/tires', shortLabel: 'Pneu' },
    { icon: 'an an-warning-circle', label: 'Multas', link: '/fines', shortLabel: 'Mult' },
    { icon: 'an an-file-text', label: 'Documentos', link: '/documents', shortLabel: 'Docs' },
    { icon: 'an an-shield-warning', label: 'Sinistros', link: '/incidents', shortLabel: 'Sini' },
    { icon: 'an an-coins', label: 'Financeiro', link: '/financial', shortLabel: 'Fina' },
    { icon: 'an an-chart-line-up', label: 'Relatorios', link: '/reports', shortLabel: 'Rela' },
    { icon: 'an an-sparkle', label: 'IA', link: '/ai-assistant', shortLabel: 'IA' },
    { icon: 'an an-gear-six', label: 'Configuracoes', link: '/settings', shortLabel: 'Conf' },
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
