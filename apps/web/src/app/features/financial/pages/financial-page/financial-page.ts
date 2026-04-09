import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatCurrency } from '@frota-leve/shared/src/utils/format.utils';
import type { PoChartOptions, PoChartSerie, PoPageAction } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoLoadingModule,
  PoPageModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { FinancialService } from '../../financial.service';
import type {
  FinancialCategoryKey,
  FinancialOverviewFilters,
  FinancialOverviewMonthlyItem,
  FinancialOverviewResponse,
  FinancialVehicleCostItem,
} from '../../financial.types';

type FinancialMetricTone = 'neutral' | 'positive' | 'warning' | 'danger';

type FinancialMetric = {
  label: string;
  value: string;
  detail: string;
  tone: FinancialMetricTone;
};

type FinancialLegendItem = {
  key: FinancialCategoryKey;
  label: string;
  value: number;
  share: number;
  color: string;
};

type FinancialPreset = '6m' | '12m' | 'ytd';

type FinancialPresetOption = {
  value: FinancialPreset;
  label: string;
  description: string;
};

const CATEGORY_META: Record<FinancialCategoryKey, { label: string; color: string }> = {
  fuel: { label: 'Combustível', color: '#0f766e' },
  maintenance: { label: 'Manutenção', color: '#c75000' },
  tires: { label: 'Pneus', color: '#155eef' },
  fines: { label: 'Multas', color: '#c13c37' },
  documents: { label: 'Documentos', color: '#667085' },
};

const PRESET_OPTIONS: FinancialPresetOption[] = [
  { value: '6m', label: '6 meses', description: 'Janela curta para leitura de variação recente.' },
  { value: '12m', label: '12 meses', description: 'Ciclo mais completo para sazonalidade.' },
  { value: 'ytd', label: 'Ano atual', description: 'Acumulado desde janeiro.' },
];

@Component({
  selector: 'app-financial-page',
  imports: [PoPageModule, PoChartModule, PoButtonModule, PoLoadingModule],
  templateUrl: './financial-page.html',
  styleUrl: './financial-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly financialService = inject(FinancialService);

  readonly columnChartType = PoChartType.Column;
  readonly donutChartType = PoChartType.Donut;
  readonly evolutionChartOptions: PoChartOptions = {
    stacked: true,
    legend: true,
    legendPosition: 'right',
    legendVerticalPosition: 'top',
    descriptionChart: 'Evolução mensal do custo operacional por categoria.',
    rendererOption: 'svg',
  };
  readonly categoryChartOptions: PoChartOptions = {
    innerRadius: 72,
    legend: true,
    legendPosition: 'right',
    legendVerticalPosition: 'top',
    descriptionChart: 'Composição do gasto operacional por categoria.',
    rendererOption: 'svg',
  };
  readonly presetOptions = PRESET_OPTIONS;

  selectedPreset: FinancialPreset = '6m';
  overview: FinancialOverviewResponse | null = null;
  ranking: FinancialVehicleCostItem[] = [];
  isLoading = false;
  hasLoadedOnce = false;
  hasLoadError = false;

  constructor() {
    this.loadDashboard();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Comparar veículos',
        icon: 'an an-columns',
        action: () => this.openComparisonPage(),
      },
      {
        label: 'TCO por veículo',
        icon: 'an an-chart-line-up',
        action: () => this.openTcoPage(),
      },
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => this.refreshDashboard(),
      },
    ];
  }

  protected get metrics(): FinancialMetric[] {
    const summary = this.overview?.summary;
    const budget = this.overview?.budget;
    const monthly = this.overview?.monthly ?? [];
    const averageMonthlyCost =
      monthly.length > 0 ? (summary ? summary.total / monthly.length : 0) : 0;
    const costPerVehicle =
      summary && summary.vehicles > 0 ? summary.total / summary.vehicles : null;
    const variance = budget?.variance ?? null;

    return [
      {
        label: 'Realizado no período',
        value: formatCurrency(summary?.total ?? 0),
        detail: this.dateRangeLabel,
        tone: 'neutral',
      },
      {
        label: 'Média mensal',
        value: formatCurrency(averageMonthlyCost),
        detail: monthly.length > 0 ? `${monthly.length} meses consolidados` : 'Sem série mensal',
        tone: 'neutral',
      },
      {
        label: 'Budget vs realizado',
        value: budget?.configured ? formatCurrency(variance ?? 0) : 'Sem budget configurado',
        detail: budget?.configured
          ? this.varianceLabel
          : 'Envie monthlyBudget no endpoint para destravar comparação',
        tone: this.getVarianceTone(variance, budget?.configured ?? false),
      },
      {
        label: 'Custo médio por veículo',
        value: costPerVehicle != null ? formatCurrency(costPerVehicle) : '—',
        detail: summary ? `${summary.vehicles} veículos no recorte` : 'Sem frota no período',
        tone: 'warning',
      },
    ];
  }

  protected get evolutionCategories(): string[] {
    return this.overview?.monthly.map((item) => item.label) ?? [];
  }

  protected get evolutionSeries(): PoChartSerie[] {
    const monthly = this.overview?.monthly ?? [];

    return (Object.keys(CATEGORY_META) as FinancialCategoryKey[]).map((key) => ({
      label: CATEGORY_META[key].label,
      data: monthly.map((item) => item[key]),
      color: CATEGORY_META[key].color,
    }));
  }

  protected get categorySeries(): PoChartSerie[] {
    return this.categoryLegend
      .filter((item) => item.value > 0)
      .map((item) => ({
        label: item.label,
        data: item.value,
        color: item.color,
      }));
  }

  protected get categoryLegend(): FinancialLegendItem[] {
    const summary = this.overview?.summary;
    const total = summary?.total ?? 0;

    return (Object.keys(CATEGORY_META) as FinancialCategoryKey[]).map((key) => {
      const value = summary?.[key] ?? 0;

      return {
        key,
        label: CATEGORY_META[key].label,
        value,
        share: total > 0 ? (value / total) * 100 : 0,
        color: CATEGORY_META[key].color,
      };
    });
  }

  protected get dominantCategory(): FinancialLegendItem | null {
    return this.categoryLegend.reduce<FinancialLegendItem | null>((highest, item) => {
      if (item.value <= 0) {
        return highest;
      }

      if (!highest || item.value > highest.value) {
        return item;
      }

      return highest;
    }, null);
  }

  protected get peakMonth(): FinancialOverviewMonthlyItem | null {
    return (this.overview?.monthly ?? []).reduce<FinancialOverviewMonthlyItem | null>(
      (highest, item) => {
        if (!highest || item.total > highest.total) {
          return item;
        }

        return highest;
      },
      null,
    );
  }

  protected get dateRangeLabel(): string {
    const summary = this.overview?.summary;

    if (!summary?.dateFrom || !summary.dateTo) {
      return 'Recorte ainda não disponível';
    }

    return `${this.formatShortDate(summary.dateFrom)} até ${this.formatShortDate(summary.dateTo)}`;
  }

  protected get heroTitle(): string {
    if (!this.overview) {
      return 'Consolidação financeira da operação';
    }

    const dominantCategory = this.dominantCategory;
    if (dominantCategory && dominantCategory.share >= 45) {
      return `${dominantCategory.label} lidera a pressão de custo neste recorte`;
    }

    return 'Evolução financeira pronta para leitura operacional';
  }

  protected get heroDescription(): string {
    if (!this.overview) {
      return 'O painel cruza combustível, manutenção, pneus, multas e documentos para revelar onde o caixa da frota está sendo consumido.';
    }

    if ((this.overview.summary.total ?? 0) === 0) {
      return 'Ainda não há gastos registrados no período selecionado. Conforme os módulos operacionais forem alimentados, a visão financeira passa a consolidar os custos automaticamente.';
    }

    return 'Use a curva mensal para detectar aceleração de gasto, o donut para entender composição e o ranking para decidir onde atacar custo primeiro.';
  }

  protected get hasOverviewData(): boolean {
    return Boolean(this.overview && this.overview.monthly.length > 0);
  }

  protected get hasRankingData(): boolean {
    return this.ranking.length > 0;
  }

  protected get varianceLabel(): string {
    const variancePercent = this.overview?.budget.variancePercent;

    if (variancePercent == null) {
      return 'Sem variação calculada';
    }

    const prefix = variancePercent > 0 ? '+' : '';
    return `${prefix}${variancePercent.toFixed(1).replace('.', ',')}% contra o budget`;
  }

  protected formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  protected formatShare(value: number): string {
    return `${value.toFixed(1).replace('.', ',')}%`;
  }

  protected formatCostPerKm(value: number | null): string {
    if (value == null) {
      return 'Sem km suficiente';
    }

    return `${formatCurrency(value)}/km`;
  }

  protected selectPreset(preset: FinancialPreset): void {
    if (this.selectedPreset === preset || this.isLoading) {
      return;
    }

    this.selectedPreset = preset;
    this.loadDashboard();
  }

  protected trackByPreset(_: number, option: FinancialPresetOption): FinancialPreset {
    return option.value;
  }

  protected openTcoPage(vehicleId?: string): void {
    void this.router.navigate(vehicleId ? ['/financial', 'tco', vehicleId] : ['/financial', 'tco']);
  }

  protected openComparisonPage(vehicleId?: string): void {
    void this.router.navigate(
      vehicleId ? ['/financial', 'comparison', vehicleId] : ['/financial', 'comparison'],
    );
  }

  protected refreshDashboard(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.hasLoadError = false;

    const filters = this.buildFilters();

    this.financialService
      .getDashboardData(filters, 5)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.hasLoadedOnce = true;
        }),
      )
      .subscribe({
        next: ({ overview, ranking }) => {
          this.overview = overview;
          this.ranking = ranking;
        },
        error: () => {
          this.overview = null;
          this.ranking = [];
          this.hasLoadError = true;
        },
      });
  }

  private buildFilters(): FinancialOverviewFilters {
    const now = new Date();
    const end = this.toIsoDate(now);
    let start = new Date(now);

    if (this.selectedPreset === '6m') {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (this.selectedPreset === '12m') {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }

    return {
      dateFrom: this.toIsoDate(start),
      dateTo: end,
    };
  }

  private getVarianceTone(variance: number | null, budgetConfigured: boolean): FinancialMetricTone {
    if (!budgetConfigured || variance == null) {
      return 'neutral';
    }

    if (variance > 0) {
      return 'danger';
    }

    if (variance < 0) {
      return 'positive';
    }

    return 'warning';
  }

  private formatShortDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
