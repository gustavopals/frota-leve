import { Component } from '@angular/core';
import type { PoMenuItem } from '@po-ui/ng-components';
import { environment } from '../../../environments/environment';

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
}
