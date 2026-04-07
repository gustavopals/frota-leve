import { Component } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { FeaturePlaceholder } from '../../../../shared/components/feature-placeholder/feature-placeholder';

@Component({
  selector: 'app-dashboard-page',
  imports: [FeaturePlaceholder],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  apiUrl = environment.apiUrl;
  milestones = [
    'Conectar indicadores reais de operacao',
    'Acoplar cards com dados do backend',
    'Fechar os CRUDs prioritarios da frota',
  ];
}
