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
import type { PoBreadcrumb, PoComboOption, PoPageAction } from '@po-ui/ng-components';
import { PoButtonModule, PoFieldModule, PoLoadingModule, PoPageModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { FinancialService } from '../../financial.service';
import type {
  FinancialCategoryKey,
  FinancialComparisonResponse,
  FinancialComparisonVehicle,
} from '../../financial.types';

type ComparisonColumn = {
  id: string;
  vehicle: FinancialComparisonVehicle;
  isReference: boolean;
};

type ComparisonCell = {
  vehicleId: string;
  main: string;
  detail: string;
  isReference: boolean;
};

type ComparisonRow = {
  key: string;
  label: string;
  helper: string;
  cells: ComparisonCell[];
};

type BenchmarkMetric = {
  label: string;
  value: string;
  detail: string;
};

const COMPARISON_LIMIT = 3;

const COMPONENT_META: Record<FinancialCategoryKey, { label: string; helper: string }> = {
  fuel: {
    label: 'Combustível',
    helper: 'Abastecimentos conhecidos do ativo.',
  },
  maintenance: {
    label: 'Manutenção',
    helper: 'OS e custos operacionais vinculados.',
  },
  tires: {
    label: 'Pneus',
    helper: 'Compras e recapagens alocadas.',
  },
  fines: {
    label: 'Multas',
    helper: 'Somente infrações já pagas.',
  },
  documents: {
    label: 'Documentos',
    helper: 'IPVA, seguro e demais custos documentais.',
  },
};

@Component({
  selector: 'app-comparison-page',
  imports: [ReactiveFormsModule, PoPageModule, PoFieldModule, PoButtonModule, PoLoadingModule],
  templateUrl: './comparison-page.html',
  styleUrl: './comparison-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonPage {
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
      { label: 'Comparativo', link: '/financial/comparison' },
    ],
  };
  readonly filtersForm = this.formBuilder.group({
    vehicleId: [''],
  });

  vehicleOptions: PoComboOption[] = [];
  comparison: FinancialComparisonResponse | null = null;
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
        label: 'Abrir TCO',
        disabled: !this.selectedVehicleId,
        action: () => this.openTco(this.selectedVehicleId),
      },
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar comparativo',
        disabled: !this.selectedVehicleId || this.isLoading,
        action: () => this.refresh(),
      },
    ];
  }

  protected get heroTitle(): string {
    if (!this.selectedVehicleId) {
      return 'Escolha um ativo para comparar lado a lado';
    }

    if (!this.comparison) {
      return 'Montando comparativo operacional';
    }

    const key = this.comparison.comparisonKey;
    return `${key.brand} ${key.model} ${key.year}`;
  }

  protected get heroDescription(): string {
    if (!this.selectedVehicleId) {
      return 'Selecione o veículo de referência para abrir uma matriz side-by-side com os ativos mais próximos da mesma marca, modelo e ano.';
    }

    if (!this.comparison) {
      return 'O comparativo cruza custo operacional, custo por quilômetro e cada componente financeiro conhecido da base comparável.';
    }

    return `A coluna de referência fica fixa e os pares ao lado mostram até ${COMPARISON_LIMIT} veículos comparáveis para leitura rápida de desvio.`;
  }

  protected get benchmarkMetrics(): BenchmarkMetric[] {
    if (!this.comparison) {
      return [];
    }

    return [
      {
        label: 'Base comparável',
        value: `${this.comparison.benchmark.vehicleCount} veículos`,
        detail: 'mesma marca, modelo e ano',
      },
      {
        label: 'Operacional médio',
        value: formatCurrency(this.comparison.benchmark.averageOperational),
        detail: 'média do grupo comparável',
      },
      {
        label: 'Média custo/km',
        value: this.formatCostPerKm(this.comparison.benchmark.averageCostPerKm),
        detail: 'somente ativos com km suficiente',
      },
      {
        label: 'Posição da referência',
        value:
          this.comparison.benchmark.referenceRankByCostPerKm != null
            ? `${this.comparison.benchmark.referenceRankByCostPerKm}º`
            : 'Sem ranking',
        detail: 'ordem por custo/km dentro do grupo',
      },
    ];
  }

  protected get comparisonColumns(): ComparisonColumn[] {
    if (!this.comparison) {
      return [];
    }

    return [
      {
        id: this.comparison.referenceVehicle.vehicle.id,
        vehicle: this.comparison.referenceVehicle,
        isReference: true,
      },
      ...this.comparison.similarVehicles.map((vehicle) => ({
        id: vehicle.vehicle.id,
        vehicle,
        isReference: false,
      })),
    ];
  }

  protected get comparisonRows(): ComparisonRow[] {
    if (!this.comparison) {
      return [];
    }

    const columns = this.comparisonColumns;
    const reference = this.comparison.referenceVehicle;

    return [
      this.buildRow(
        'Quilometragem atual',
        'Base do custo por quilômetro.',
        columns,
        (column) => this.formatMileage(column.vehicle.vehicle.currentMileage),
        (column) =>
          this.formatNumberDelta(
            column.vehicle.vehicle.currentMileage,
            reference.vehicle.currentMileage,
            ' km vs referência',
            column.isReference,
            0,
          ),
      ),
      this.buildRow(
        'Aquisição',
        'Valor cadastrado no ativo.',
        columns,
        (column) => this.formatNullableCurrency(column.vehicle.vehicle.acquisitionValue),
        (column) =>
          this.formatCurrencyDelta(
            column.vehicle.vehicle.acquisitionValue,
            reference.vehicle.acquisitionValue,
            column.isReference,
          ),
      ),
      this.buildRow(
        'Custo operacional',
        'Combustível, manutenção, pneus, multas e documentos.',
        columns,
        (column) => formatCurrency(column.vehicle.totals.operational),
        (column) =>
          this.formatCurrencyDelta(
            column.vehicle.totals.operational,
            reference.totals.operational,
            column.isReference,
          ),
      ),
      this.buildRow(
        'Custo por km',
        'Operacional dividido pela quilometragem atual.',
        columns,
        (column) => this.formatCostPerKm(column.vehicle.totals.costPerKm),
        (column) =>
          this.formatCurrencyDelta(
            column.vehicle.totals.costPerKm,
            reference.totals.costPerKm,
            column.isReference,
            '/km vs referência',
          ),
      ),
      ...(Object.keys(COMPONENT_META) as FinancialCategoryKey[]).map((key) =>
        this.buildRow(
          COMPONENT_META[key].label,
          COMPONENT_META[key].helper,
          columns,
          (column) => formatCurrency(column.vehicle.components[key]),
          (column) =>
            this.formatCurrencyDelta(
              column.vehicle.components[key],
              reference.components[key],
              column.isReference,
            ),
          key,
        ),
      ),
    ];
  }

  protected get hasPeers(): boolean {
    return (this.comparison?.similarVehicles.length ?? 0) > 0;
  }

  protected get comparisonWarnings(): string[] {
    return this.comparison?.warnings ?? [];
  }

  protected applyFilters(): void {
    const vehicleId = this.filtersForm.controls.vehicleId.value?.trim();

    if (!vehicleId) {
      return;
    }

    void this.router.navigate(['/financial', 'comparison', vehicleId]);
  }

  protected openVehicle(vehicleId: string | null): void {
    if (!vehicleId) {
      void this.router.navigate(['/vehicles']);
      return;
    }

    void this.router.navigate(['/vehicles', vehicleId]);
  }

  protected openTco(vehicleId: string | null): void {
    if (!vehicleId) {
      return;
    }

    void this.router.navigate(['/financial', 'tco', vehicleId]);
  }

  protected refreshComparison(): void {
    this.refresh();
  }

  protected formatPlate(value: string): string {
    return formatPlate(value);
  }

  protected formatMileage(value: number): string {
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`;
  }

  protected formatCostPerKm(value: number | null): string {
    return value != null ? `${formatCurrency(value)}/km` : 'Sem km suficiente';
  }

  private bindRouteState(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const vehicleId = params.get('vehicleId');

      this.selectedVehicleId = vehicleId;
      this.filtersForm.patchValue({ vehicleId: vehicleId ?? '' }, { emitEvent: false });

      if (!vehicleId) {
        this.comparison = null;
        this.hasLoadError = false;
        this.cdr.markForCheck();
        return;
      }

      this.loadComparison(vehicleId);
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

  private loadComparison(vehicleId: string): void {
    this.isLoading = true;
    this.hasLoadError = false;
    this.cdr.markForCheck();

    this.financialService
      .getComparison(vehicleId, COMPARISON_LIMIT)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.comparison = response;
          this.hasLoadError = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.comparison = null;
          this.hasLoadError = true;
          this.cdr.markForCheck();
        },
      });
  }

  private refresh(): void {
    if (!this.selectedVehicleId) {
      return;
    }

    this.loadComparison(this.selectedVehicleId);
  }

  private buildRow(
    label: string,
    helper: string,
    columns: ComparisonColumn[],
    getMain: (column: ComparisonColumn) => string,
    getDetail: (column: ComparisonColumn) => string,
    key = label,
  ): ComparisonRow {
    return {
      key,
      label,
      helper,
      cells: columns.map((column) => ({
        vehicleId: column.id,
        main: getMain(column),
        detail: getDetail(column),
        isReference: column.isReference,
      })),
    };
  }

  private formatNullableCurrency(value: number | null): string {
    return value != null ? formatCurrency(value) : 'Não informado';
  }

  private formatCurrencyDelta(
    value: number | null,
    reference: number | null,
    isReference: boolean,
    suffix = ' vs referência',
  ): string {
    if (isReference) {
      return 'linha de referência';
    }

    if (value == null || reference == null) {
      return 'sem base comparável';
    }

    const delta = value - reference;

    if (Math.abs(delta) < 0.01) {
      return 'igual à referência';
    }

    return `${delta > 0 ? '+' : ''}${formatCurrency(delta)}${suffix}`;
  }

  private formatNumberDelta(
    value: number,
    reference: number,
    suffix: string,
    isReference: boolean,
    fractionDigits = 0,
  ): string {
    if (isReference) {
      return 'linha de referência';
    }

    const delta = value - reference;

    if (Math.abs(delta) < 0.01) {
      return 'igual à referência';
    }

    return `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}${suffix}`;
  }
}
