import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { formatCurrency, formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import type {
  PoBreadcrumb,
  PoChartOptions,
  PoChartSerie,
  PoComboOption,
  PoPageAction,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
} from '@po-ui/ng-components';
import { combineLatest, finalize } from 'rxjs';
import { FinancialService } from '../../financial.service';
import type { FinancialCategoryKey, FinancialTcoResponse } from '../../financial.types';

type TcoComponentKey = FinancialCategoryKey | 'depreciation';

type TcoComponentMeta = {
  label: string;
  description: string;
  color: string;
};

type TcoComponentDetail = TcoComponentMeta & {
  key: TcoComponentKey;
  value: number;
  share: number;
  barWidth: number;
  note: string;
};

const COMPONENT_META: Record<TcoComponentKey, TcoComponentMeta> = {
  fuel: {
    label: 'Combustível',
    description: 'Abastecimentos lançados para o veículo no histórico conhecido.',
    color: '#0f766e',
  },
  maintenance: {
    label: 'Manutenção',
    description: 'Ordens de serviço concluídas e custos operacionais já fechados.',
    color: '#c75000',
  },
  tires: {
    label: 'Pneus',
    description: 'Pneus alocados e recapagens conhecidas no ativo atual.',
    color: '#155eef',
  },
  fines: {
    label: 'Multas',
    description: 'Infrações pagas vinculadas ao veículo.',
    color: '#c13c37',
  },
  documents: {
    label: 'Documentos',
    description: 'Custos cadastrados de CRLV, seguro e documentos relacionados.',
    color: '#667085',
  },
  depreciation: {
    label: 'Depreciação',
    description: 'Diferença entre o valor de aquisição e o valor de mercado informado.',
    color: '#17313b',
  },
};

@Component({
  selector: 'app-tco-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoChartModule,
    PoLoadingModule,
  ],
  templateUrl: './tco-page.html',
  styleUrl: './tco-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TcoPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly financialService = inject(FinancialService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Financeiro', link: '/financial' },
      { label: 'TCO por veículo', link: '/financial/tco' },
    ],
  };
  readonly donutChartType = PoChartType.Donut;
  readonly filtersForm = this.formBuilder.group({
    vehicleId: [''],
    currentMarketValue: [null as number | null],
  });

  vehicleOptions: PoComboOption[] = [];
  tco: FinancialTcoResponse | null = null;
  selectedVehicleId: string | null = null;
  isLoadingOptions = false;
  isLoading = false;
  hasLoadError = false;

  constructor() {
    this.loadVehicleOptions();
    this.bindRouteState();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Dashboard financeiro',
        action: () => {
          void this.router.navigate(['/financial']);
        },
      },
      {
        label: 'Comparar similares',
        disabled: !this.selectedVehicleId,
        action: () => this.openComparisonPage(),
      },
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar TCO',
        disabled: !this.selectedVehicleId || this.isLoading,
        action: () => this.refresh(),
      },
    ];
  }

  protected get chartOptions(): PoChartOptions {
    return {
      innerRadius: 78,
      legend: true,
      legendPosition: 'right',
      legendVerticalPosition: 'top',
      textCenterGraph: this.tco ? formatCurrency(this.tco.totals.tco) : 'TCO',
      descriptionChart: 'Composição do TCO do veículo selecionado.',
      rendererOption: 'svg',
    };
  }

  protected get heroTitle(): string {
    if (!this.tco) {
      return 'Selecione um veículo para abrir o TCO';
    }

    return `${formatPlate(this.tco.vehicle.plate)} • ${this.tco.vehicle.brand} ${this.tco.vehicle.model}`;
  }

  protected get heroDescription(): string {
    if (!this.selectedVehicleId) {
      return 'Escolha o ativo e, se quiser, informe o valor atual de mercado para incluir a depreciação no cálculo.';
    }

    if (!this.tco) {
      return 'O cálculo cruza combustível, manutenção, pneus, multas, documentos e depreciação opcional em uma única leitura.';
    }

    return this.tco.depreciation.included
      ? 'A depreciação está ativa neste cenário. Ajuste o valor de mercado para simular o impacto no TCO total.'
      : 'O TCO está sendo exibido no modo operacional. Informe o valor atual de mercado para acrescentar depreciação.';
  }

  protected get heroMetrics(): Array<{ label: string; value: string; detail: string }> {
    if (!this.tco) {
      return [];
    }

    return [
      {
        label: 'TCO total',
        value: formatCurrency(this.tco.totals.tco),
        detail: this.tco.depreciation.included ? 'com depreciação' : 'modo operacional',
      },
      {
        label: 'Custo operacional',
        value: formatCurrency(this.tco.totals.operational),
        detail: 'base dos módulos já lançados',
      },
      {
        label: 'Custo por km',
        value: this.formatCostPerKm(this.tco.totals.costPerKm),
        detail: `${this.formatMileage(this.tco.vehicle.currentMileage)} acumulados`,
      },
    ];
  }

  protected get componentDetails(): TcoComponentDetail[] {
    if (!this.tco) {
      return [];
    }

    const totalBase = this.tco.totals.tco || this.tco.totals.operational;
    const rawValues: Record<TcoComponentKey, number> = {
      fuel: this.tco.components.fuel,
      maintenance: this.tco.components.maintenance,
      tires: this.tco.components.tires,
      fines: this.tco.components.fines,
      documents: this.tco.components.documents,
      depreciation: this.tco.components.depreciation ?? 0,
    };
    const maxValue = Math.max(...Object.values(rawValues), 0);

    return (Object.keys(COMPONENT_META) as TcoComponentKey[]).map((key) => {
      const value = rawValues[key];

      return {
        key,
        ...COMPONENT_META[key],
        value,
        share: totalBase > 0 ? (value / totalBase) * 100 : 0,
        barWidth: maxValue > 0 ? (value / maxValue) * 100 : 0,
        note: this.getComponentNote(key),
      };
    });
  }

  protected get chartSeries(): PoChartSerie[] {
    return this.componentDetails
      .filter((item) => item.value > 0)
      .map((item) => ({
        label: item.label,
        data: item.value,
        color: item.color,
      }));
  }

  protected get selectedVehicleSummary(): Array<{ label: string; value: string; detail: string }> {
    if (!this.tco) {
      return [];
    }

    return [
      {
        label: 'Placa',
        value: formatPlate(this.tco.vehicle.plate),
        detail: `${this.tco.vehicle.brand} ${this.tco.vehicle.model} ${this.tco.vehicle.year}`,
      },
      {
        label: 'Aquisição',
        value: this.formatNullableCurrency(this.tco.depreciation.acquisitionValue),
        detail: 'valor base do cadastro do veículo',
      },
      {
        label: 'Mercado atual',
        value: this.formatNullableCurrency(this.tco.depreciation.currentMarketValue),
        detail: this.tco.depreciation.included
          ? 'depreciação ativada'
          : 'não informado neste cenário',
      },
      {
        label: 'Depreciação',
        value: this.formatNullableCurrency(this.tco.depreciation.amount),
        detail: this.tco.depreciation.included ? 'incluída no TCO total' : 'fora do cálculo',
      },
    ];
  }

  protected get assumptionRows(): Array<{ label: string; value: string }> {
    if (!this.tco) {
      return [];
    }

    return [
      {
        label: 'Quilometragem-base',
        value: this.formatMileage(this.tco.vehicle.currentMileage),
      },
      {
        label: 'TCO total',
        value: formatCurrency(this.tco.totals.tco),
      },
      {
        label: 'Operacional conhecido',
        value: formatCurrency(this.tco.totals.operational),
      },
      {
        label: 'Custo por km',
        value: this.formatCostPerKm(this.tco.totals.costPerKm),
      },
    ];
  }

  protected applyFilters(): void {
    const vehicleId = this.filtersForm.controls.vehicleId.value?.trim();

    if (!vehicleId) {
      return;
    }

    const marketValue = this.normalizeMarketValue(
      this.filtersForm.controls.currentMarketValue.value,
    );

    void this.router.navigate(['/financial', 'tco', vehicleId], {
      queryParams: marketValue != null ? { marketValue } : {},
    });
  }

  protected clearCurrentMarketValue(): void {
    this.filtersForm.patchValue({ currentMarketValue: null }, { emitEvent: false });

    if (!this.selectedVehicleId) {
      return;
    }

    void this.router.navigate(['/financial', 'tco', this.selectedVehicleId]);
  }

  protected openVehicleDetails(): void {
    if (!this.selectedVehicleId) {
      return;
    }

    void this.router.navigate(['/vehicles', this.selectedVehicleId]);
  }

  protected openVehiclesPage(): void {
    void this.router.navigate(['/vehicles']);
  }

  protected openComparisonPage(): void {
    if (!this.selectedVehicleId) {
      void this.router.navigate(['/financial', 'comparison']);
      return;
    }

    void this.router.navigate(['/financial', 'comparison', this.selectedVehicleId]);
  }

  protected refreshTco(): void {
    this.refresh();
  }

  protected formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  protected formatNullableCurrency(value: number | null): string {
    return value != null ? formatCurrency(value) : 'Não informado';
  }

  protected formatCostPerKm(value: number | null): string {
    return value != null ? `${formatCurrency(value)}/km` : 'Sem km suficiente';
  }

  protected formatShare(value: number): string {
    return `${value.toFixed(1).replace('.', ',')}%`;
  }

  protected formatMileage(value: number): string {
    return (
      value.toLocaleString('pt-BR', {
        maximumFractionDigits: 0,
      }) + ' km'
    );
  }

  private bindRouteState(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        const vehicleId = params.get('vehicleId');
        const marketValue = this.parseMarketValueQuery(queryParams.get('marketValue'));

        this.selectedVehicleId = vehicleId;
        this.filtersForm.patchValue(
          {
            vehicleId: vehicleId ?? '',
            currentMarketValue: marketValue,
          },
          { emitEvent: false },
        );

        if (!vehicleId) {
          this.tco = null;
          this.hasLoadError = false;
          this.cdr.markForCheck();
          return;
        }

        this.loadTco(vehicleId, marketValue);
      });
  }

  private loadVehicleOptions(): void {
    this.isLoadingOptions = true;
    this.cdr.markForCheck();

    this.financialService
      .listVehicleOptions()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingOptions = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (options) => {
          this.vehicleOptions = options.map((option) => ({
            label: option.label,
            value: option.id,
          }));
          this.cdr.markForCheck();
        },
      });
  }

  private loadTco(vehicleId: string, currentMarketValue: number | null): void {
    this.isLoading = true;
    this.hasLoadError = false;
    this.cdr.markForCheck();

    this.financialService
      .getVehicleTco(vehicleId, currentMarketValue)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.tco = response;
          this.hasLoadError = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.tco = null;
          this.hasLoadError = true;
          this.cdr.markForCheck();
        },
      });
  }

  private refresh(): void {
    if (!this.selectedVehicleId) {
      return;
    }

    this.loadTco(
      this.selectedVehicleId,
      this.normalizeMarketValue(this.filtersForm.controls.currentMarketValue.value),
    );
  }

  private parseMarketValueQuery(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private normalizeMarketValue(value: number | null): number | null {
    if (value == null || Number.isNaN(Number(value))) {
      return null;
    }

    return Number(value) >= 0 ? Number(value) : null;
  }

  private getComponentNote(key: TcoComponentKey): string {
    if (!this.tco) {
      return '';
    }

    if (key !== 'depreciation') {
      return this.tco.components[key] > 0 ? 'incluído' : 'sem custo conhecido';
    }

    return this.tco.depreciation.included
      ? 'valor de mercado informado'
      : 'informe o valor atual para incluir';
  }
}
