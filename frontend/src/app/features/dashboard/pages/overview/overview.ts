import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent } from '../../../../shared/components/card/card';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardContentComponent,
    StatCardComponent
  ],
  templateUrl: './overview.html',
  styleUrls: ['./overview.scss']
})
export class OverviewComponent implements OnInit {
  stats = [
    { title: 'Total de Veículos', value: '0', icon: '🚗' },
    { title: 'Manutenções Pendentes', value: '0', icon: '🔧' },
    { title: 'Abastecimentos (Mês)', value: '0', icon: '⛽' },
    { title: 'Motoristas Ativos', value: '0', icon: '👤' }
  ];

  ngOnInit() {
    // TODO: Load real data from API
  }
}
