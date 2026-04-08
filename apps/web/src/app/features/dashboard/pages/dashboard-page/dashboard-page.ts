import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import type {
  DashboardAlertItem,
  DashboardSummaryResponse,
} from '@frota-leve/shared/src/types/dashboard.type';
import { formatCurrency } from '@frota-leve/shared/src/utils/format.utils';
import type { PoChartOptions, PoChartSerie, PoPageAction, PoTagType } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoPageModule,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { DashboardService } from '../../dashboard.service';
import {
  formatDashboardAlertDueAt,
  formatDashboardDateTime,
  getDashboardActivityActionLabel,
  getDashboardAlertSeverityMeta,
  getDashboardAlertTypeLabel,
  getDashboardVariationLabel,
} from '../../dashboard.utils';

type DashboardPillTone = 'success' | 'warning' | 'danger' | 'neutral';

type DashboardMetricPill = {
  label: string;
  value: string;
  tone: DashboardPillTone;
};

type DashboardStatusLegendItem = {
  label: string;
  value: number;
  share: string;
  description: string;
  color: string;
};

@Component({
  selector: 'app-dashboard-page',
  imports: [PoPageModule, PoWidgetModule, PoTagModule, PoChartModule, PoButtonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  readonly costChartType = PoChartType.Column;
  readonly statusChartType = PoChartType.Donut;
  readonly costChartOptions: PoChartOptions = {
    stacked: true,
    legend: true,
    legendPosition: 'right',
    legendVerticalPosition: 'top',
    descriptionChart: 'Custos operacionais mensais por categoria.',
    rendererOption: 'svg',
  };
  readonly heroActions = [
    {
      label: 'Abrir frota',
      link: '/vehicles',
      kind: 'primary' as const,
    },
    {
      label: 'Abrir motoristas',
      link: '/drivers',
      kind: 'secondary' as const,
    },
  ];

  summary: DashboardSummaryResponse | null = null;
  isLoading = false;
  hasLoadError = false;

  constructor() {
    this.loadSummary();
  }

  protected get pageSubtitle(): string {
    return 'KPIs de frota, pessoas, alertas e custo mensal consolidados para a operacao.';
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar painel',
        disabled: this.isLoading,
        action: () => {
          this.reload();
        },
      },
    ];
  }

  protected get tenantName(): string {
    return this.authService.getCurrentTenant()?.name ?? 'sua operacao';
  }

  protected get heroTitle(): string {
    if (!this.summary) {
      return `Visao principal da ${this.tenantName}`;
    }

    if (this.summary.vehicles.total === 0 && this.summary.drivers.total === 0) {
      return 'Cadastre a frota e os motoristas para destravar os indicadores';
    }

    if (this.summary.alerts.totalPending > 0) {
      return `${this.summary.alerts.totalPending} alertas merecem prioridade agora`;
    }

    return 'Operacao estabilizada para o inicio do dia';
  }

  protected get heroDescription(): string {
    if (!this.summary) {
      return 'O painel consolida disponibilidade da frota, condutores, pendencias e os primeiros sinais de custo da operacao.';
    }

    if (this.summary.vehicles.total === 0 && this.summary.drivers.total === 0) {
      return 'A base do dashboard ja esta conectada. Assim que os primeiros cadastros entrarem, os cards e graficos passam a refletir a operacao real.';
    }

    if (this.summary.alerts.totalPending > 0) {
      return 'Use este resumo para distribuir tratativas entre manutencao, documentos, multas e vencimentos de CNH antes que virem indisponibilidade.';
    }

    return 'Os principais indicadores estao saudaveis. O painel segue pronto para acompanhar crescimento de frota e custos nas proximas fases.';
  }

  protected get heroSnapshot(): DashboardMetricPill[] {
    return [
      {
        label: 'ativos',
        value: String(this.summary?.vehicles.active ?? 0),
        tone: 'success',
      },
      {
        label: 'motoristas ativos',
        value: String(this.summary?.drivers.active ?? 0),
        tone: 'neutral',
      },
      {
        label: 'alertas pendentes',
        value: String(this.summary?.alerts.totalPending ?? 0),
        tone: (this.summary?.alerts.totalPending ?? 0) > 0 ? 'warning' : 'success',
      },
    ];
  }

  protected get vehicleBreakdown(): DashboardMetricPill[] {
    const vehicles = this.summary?.vehicles;

    return [
      {
        label: 'ativos',
        value: String(vehicles?.active ?? 0),
        tone: 'success',
      },
      {
        label: 'em manutencao',
        value: String(vehicles?.maintenance ?? 0),
        tone: (vehicles?.maintenance ?? 0) > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'reserva',
        value: String(vehicles?.reserve ?? 0),
        tone: 'neutral',
      },
      {
        label: 'sinistro',
        value: String(vehicles?.incident ?? 0),
        tone: (vehicles?.incident ?? 0) > 0 ? 'danger' : 'neutral',
      },
    ];
  }

  protected get driverBreakdown(): DashboardMetricPill[] {
    const drivers = this.summary?.drivers;

    return [
      {
        label: 'ativos',
        value: String(drivers?.active ?? 0),
        tone: 'success',
      },
      {
        label: 'CNHs a vencer',
        value: String(drivers?.cnhExpiring ?? 0),
        tone: (drivers?.cnhExpiring ?? 0) > 0 ? 'warning' : 'neutral',
      },
    ];
  }

  protected get alertBreakdown(): DashboardMetricPill[] {
    const alerts = this.summary?.alerts;

    return [
      {
        label: 'manutencoes',
        value: String(alerts?.maintenanceDue ?? 0),
        tone: (alerts?.maintenanceDue ?? 0) > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'documentos',
        value: String(alerts?.documentsExpiring ?? 0),
        tone: (alerts?.documentsExpiring ?? 0) > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'multas',
        value: String(alerts?.pendingFines ?? 0),
        tone: (alerts?.pendingFines ?? 0) > 0 ? 'danger' : 'neutral',
      },
      {
        label: 'CNHs',
        value: String(alerts?.cnhExpiring ?? 0),
        tone: (alerts?.cnhExpiring ?? 0) > 0 ? 'warning' : 'neutral',
      },
    ];
  }

  protected get currentMonthCostBreakdown(): DashboardMetricPill[] {
    const costs = this.summary?.costs.breakdownCurrentMonth;

    return [
      {
        label: 'combustivel',
        value: formatCurrency(costs?.fuel ?? 0),
        tone: 'neutral',
      },
      {
        label: 'manutencao',
        value: formatCurrency(costs?.maintenance ?? 0),
        tone: 'warning',
      },
      {
        label: 'multas',
        value: formatCurrency(costs?.fines ?? 0),
        tone: 'danger',
      },
      {
        label: 'outros',
        value: formatCurrency(costs?.other ?? 0),
        tone: 'neutral',
      },
    ];
  }

  protected get hasCostData(): boolean {
    return Boolean(this.summary?.costs.monthlySeries.some((item) => item.total > 0));
  }

  protected get hasVehicleStatusData(): boolean {
    return (this.summary?.vehicles.total ?? 0) > 0;
  }

  protected get alerts(): DashboardAlertItem[] {
    return this.summary?.alerts.items ?? [];
  }

  protected get recentActivity() {
    return this.summary?.recentActivity ?? [];
  }

  protected get costCategories(): string[] {
    return this.summary?.costs.monthlySeries.map((item) => item.month) ?? [];
  }

  protected get costSeries(): PoChartSerie[] {
    const series = this.summary?.costs.monthlySeries ?? [];

    return [
      {
        label: 'Combustivel',
        data: series.map((item) => item.fuel),
        color: '#0f766e',
      },
      {
        label: 'Manutencao',
        data: series.map((item) => item.maintenance),
        color: '#c75000',
      },
      {
        label: 'Multas',
        data: series.map((item) => item.fines),
        color: '#c13c37',
      },
      {
        label: 'Outros',
        data: series.map((item) => item.other),
        color: '#5f6b75',
      },
    ];
  }

  protected get statusChartSeries(): PoChartSerie[] {
    const vehicles = this.summary?.vehicles;

    if (!vehicles) {
      return [];
    }

    return [
      {
        label: 'Ativos',
        data: vehicles.active,
        color: '#2f855a',
      },
      {
        label: 'Manutencao',
        data: vehicles.maintenance,
        color: '#c78f00',
      },
      {
        label: 'Reserva',
        data: vehicles.reserve,
        color: '#50616d',
      },
      {
        label: 'Baixados',
        data: vehicles.decommissioned,
        color: '#7a3e1d',
      },
      {
        label: 'Sinistro',
        data: vehicles.incident,
        color: '#b42318',
      },
    ].filter((item) => (item.data as number) > 0);
  }

  protected get statusChartOptions(): PoChartOptions {
    return {
      innerRadius: 72,
      legend: true,
      legendPosition: 'right',
      legendVerticalPosition: 'top',
      textCenterGraph: `${this.summary?.vehicles.total ?? 0} veiculos`,
      descriptionChart: 'Distribuicao da frota por status operacional.',
      rendererOption: 'svg',
    };
  }

  protected get statusLegend(): DashboardStatusLegendItem[] {
    const vehicles = this.summary?.vehicles;
    const total = vehicles?.total ?? 0;

    return [
      {
        label: 'Ativos',
        value: vehicles?.active ?? 0,
        share: this.getShareLabel(vehicles?.active ?? 0, total),
        description: 'Disponiveis para operacao',
        color: '#2f855a',
      },
      {
        label: 'Em manutencao',
        value: vehicles?.maintenance ?? 0,
        share: this.getShareLabel(vehicles?.maintenance ?? 0, total),
        description: 'Parados para intervencao',
        color: '#c78f00',
      },
      {
        label: 'Reserva',
        value: vehicles?.reserve ?? 0,
        share: this.getShareLabel(vehicles?.reserve ?? 0, total),
        description: 'Backup para cobertura',
        color: '#50616d',
      },
      {
        label: 'Baixados',
        value: vehicles?.decommissioned ?? 0,
        share: this.getShareLabel(vehicles?.decommissioned ?? 0, total),
        description: 'Fora do ciclo operacional',
        color: '#7a3e1d',
      },
      {
        label: 'Sinistro',
        value: vehicles?.incident ?? 0,
        share: this.getShareLabel(vehicles?.incident ?? 0, total),
        description: 'Com ocorrencia aberta',
        color: '#b42318',
      },
    ];
  }

  protected get lastUpdatedLabel(): string {
    return formatDashboardDateTime(this.summary?.generatedAt);
  }

  protected get costVariationLabel(): string {
    return getDashboardVariationLabel(this.summary?.costs.variation ?? 0);
  }

  protected get costReadinessLabel(): string {
    return this.hasCostData
      ? 'Serie alimentada pelos dados ja consolidados na API.'
      : 'Os modulos de combustivel, manutencao e multas entram nas tasks 2.x; por isso a serie ainda aparece zerada.';
  }

  reload(): void {
    this.loadSummary();
  }

  openInternalLink(link: string | null): void {
    if (!link) {
      return;
    }

    void this.router.navigateByUrl(link);
  }

  formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  formatAlertDueAt(value: string | null): string {
    return formatDashboardAlertDueAt(value);
  }

  formatDateTime(value: string | null): string {
    return formatDashboardDateTime(value);
  }

  getAlertSeverityMeta(alert: DashboardAlertItem): { label: string; type: PoTagType } {
    return getDashboardAlertSeverityMeta(alert.severity);
  }

  getAlertTypeLabel(alert: DashboardAlertItem): string {
    return getDashboardAlertTypeLabel(alert.type);
  }

  getActivityActionLabel(action: string): string {
    return getDashboardActivityActionLabel(action);
  }

  getVehiclePillClass(tone: DashboardPillTone): string {
    return this.getPillClass(tone);
  }

  getDriverPillClass(tone: DashboardPillTone): string {
    return this.getPillClass(tone);
  }

  getAlertPillClass(tone: DashboardPillTone): string {
    return this.getPillClass(tone);
  }

  getCostPillClass(tone: DashboardPillTone): string {
    return this.getPillClass(tone);
  }

  private loadSummary(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.hasLoadError = false;

    this.dashboardService
      .getSummary()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (summary) => {
          this.summary = summary;
        },
        error: () => {
          this.hasLoadError = true;
        },
      });
  }

  private getPillClass(tone: DashboardPillTone): string {
    return `dashboard-page__pill dashboard-page__pill--${tone}`;
  }

  private getShareLabel(value: number, total: number): string {
    if (total === 0) {
      return '0%';
    }

    return `${Math.round((value / total) * 100)}%`;
  }
}
