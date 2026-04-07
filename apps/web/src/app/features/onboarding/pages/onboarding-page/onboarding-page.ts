import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/services/auth';

type OnboardingStep = {
  title: string;
  description: string;
  helper: string;
};

@Component({
  selector: 'app-onboarding-page',
  standalone: false,
  templateUrl: './onboarding-page.html',
  styleUrl: './onboarding-page.scss',
})
export class OnboardingPage {
  private readonly authService = inject(AuthService);

  readonly steps: OnboardingStep[] = [
    {
      title: 'Sobre sua empresa',
      description: 'Revise os dados cadastrais e confirme a operacao inicial da conta.',
      helper: 'Ja concluido no registro, mas voce podera editar antes de seguir.',
    },
    {
      title: 'Adicione seus veiculos',
      description: 'Cadastre os primeiros ativos para liberar os indicadores da frota.',
      helper: 'Comece com placa, marca e modelo para ganhar velocidade.',
    },
    {
      title: 'Cadastre os motoristas',
      description: 'Associe condutores aos veiculos e organize responsabilidades.',
      helper: 'Voce pode fazer isso em lote depois, se preferir.',
    },
    {
      title: 'Convide sua equipe',
      description: 'Adicione outros usuarios para distribuir operacao e acompanhamento.',
      helper: 'Owner e Admin entram primeiro para fechar a implantacao inicial.',
    },
    {
      title: 'Explore o painel',
      description: 'Valide o ambiente e avance para a operacao diaria.',
      helper: 'O tour guiado completo entra na fase 5.2.',
    },
  ];

  protected get tenantName(): string {
    return this.authService.getCurrentTenant()?.name ?? 'sua operacao';
  }
}
