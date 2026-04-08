import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, viewChild } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  PoBreadcrumb,
  PoChartOptions,
  PoChartSerie,
  PoComboOption,
  PoModalAction,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoDividerModule,
  PoFieldModule,
  PoModalComponent,
  PoModalModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoTagType,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import {
  FUEL_ANOMALY_OPTIONS,
  FUEL_TANK_MODE_OPTIONS,
  FUEL_TYPE_OPTIONS,
} from '../../fuel.constants';
import { FuelService } from '../../fuel.service';
import type {
  FuelDriverOption,
  FuelRankingFilters,
  FuelRecord,
  FuelRecordFormPayload,
  FuelRecordListFilters,
  FuelRecordListResponse,
  FuelRecordRankingItem,
  FuelRecordRankingResponse,
  FuelRecordStatsResponse,
  FuelVehicleOption,
} from '../../fuel.types';
import {
  formatFuelCurrency,
  formatFuelDate,
  formatFuelDriverLabel,
  formatFuelNumber,
  formatFuelType,
  formatKmPerLiter,
  formatMileage,
  formatVehicleLabel,
  toIsoDateInputValue,
} from '../../fuel.utils';

type TankMode = 'full' | 'partial';

type FuelTableItem = FuelRecord & {
  vehicleCell: {
    title: string;
    subtitle: string;
    anomaly: boolean;
  };
  driverDisplay: string;
  fuelTypeDisplay: string;
  volumeCell: {
    liters: string;
    pricePerLiter: string;
    station: string;
  };
  costDisplay: string;
  efficiencyCell: {
    value: string;
    helper: string;
    anomaly: boolean;
  };
  anomalyCell: {
    label: string;
    helper: string;
    type: PoTagType;
  };
};

type FuelChartPoint = {
  label: string;
  totalCost: number;
};

function createEmptyStats(): FuelRecordStatsResponse {
  return {
    totalRecords: 0,
    totalCost: 0,
    totalLiters: 0,
    averageKmPerLiter: null,
    averagePricePerLiter: null,
    costPerKm: null,
    anomalyCount: 0,
  };
}

function createEmptyRanking(): FuelRecordRankingResponse {
  return {
    best: [],
    worst: [],
  };
}

function createEmptyListResponse(page: number, pageSize: number): FuelRecordListResponse {
  return {
    items: [],
    hasNext: false,
    meta: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };
}

function receiptUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? null : { invalidUrl: true };
  } catch {
    return {
      invalidUrl: true,
    };
  }
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

@Component({
  selector: 'app-fuel-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoFieldModule,
    PoButtonModule,
    PoTableModule,
    PoTagModule,
    PoModalModule,
    PoDividerModule,
    PoChartModule,
  ],
  templateUrl: './fuel-page.html',
  styleUrl: './fuel-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FuelPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly fuelService = inject(FuelService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly formModal = viewChild.required<PoModalComponent>('formModal');

  readonly chartType = PoChartType.Column;
  readonly efficiencyChartType = PoChartType.Line;
  readonly rankingBestTagType = PoTagType.Success;
  readonly rankingWorstTagType = PoTagType.Danger;
  readonly filtersForm = this.formBuilder.group({
    vehicleId: [''],
    driverId: [''],
    fuelType: [null as FuelType | null],
    gasStation: [''],
    anomaly: [''],
    dateFrom: [null as string | null],
    dateTo: [null as string | null],
  });
  readonly form = this.formBuilder.group({
    vehicleId: ['', [Validators.required]],
    driverId: [''],
    date: [this.getTodayDate(), [Validators.required]],
    mileage: [null as number | null, [Validators.required, Validators.min(0)]],
    liters: [null as number | null, [Validators.required, Validators.min(0.01)]],
    pricePerLiter: [null as number | null, [Validators.required, Validators.min(0.01)]],
    fuelType: [null as FuelType | null, [Validators.required]],
    tankMode: ['full' as TankMode, [Validators.required]],
    gasStation: [''],
    receiptUrl: ['', [receiptUrlValidator]],
    notes: [''],
  });
  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Combustível', link: '/fuel' },
    ],
  };
  readonly fuelTypeOptions = FUEL_TYPE_OPTIONS;
  readonly anomalyOptions = FUEL_ANOMALY_OPTIONS;
  readonly tankModeOptions = FUEL_TANK_MODE_OPTIONS;
  readonly vehicleColumnProperty = 'vehicleCell';
  readonly volumeColumnProperty = 'volumeCell';
  readonly efficiencyColumnProperty = 'efficiencyCell';
  readonly anomalyColumnProperty = 'anomalyCell';
  readonly columns: PoTableColumn[] = [
    {
      property: 'date',
      label: 'Data',
      type: 'date',
      format: 'dd/MM/yyyy',
      width: '110px',
    },
    {
      property: this.vehicleColumnProperty,
      label: 'Veículo',
      type: 'columnTemplate',
      width: '270px',
      sortable: false,
    },
    {
      property: 'driverDisplay',
      label: 'Motorista',
      width: '220px',
      sortable: false,
    },
    {
      property: 'fuelTypeDisplay',
      label: 'Combustível',
      width: '140px',
      sortable: false,
    },
    {
      property: this.volumeColumnProperty,
      label: 'Volume',
      type: 'columnTemplate',
      width: '190px',
      sortable: false,
    },
    {
      property: 'costDisplay',
      label: 'Total',
      width: '140px',
      sortable: false,
    },
    {
      property: this.efficiencyColumnProperty,
      label: 'Eficiência',
      type: 'columnTemplate',
      width: '180px',
      sortable: false,
    },
    {
      property: this.anomalyColumnProperty,
      label: 'Status',
      type: 'columnTemplate',
      width: '170px',
      sortable: false,
    },
  ];
  readonly monthlyCostChartOptions: PoChartOptions = {
    legend: false,
    rendererOption: 'svg',
    descriptionChart: 'Custo mensal agregado com base no filtro atual.',
  };
  readonly efficiencyChartOptions: PoChartOptions = {
    legend: false,
    rendererOption: 'svg',
    descriptionChart: 'Evolução de km/l nos últimos abastecimentos com tanque cheio.',
  };

  vehicleOptions: PoComboOption[] = [];
  driverOptions: PoComboOption[] = [];
  vehicleCatalog: FuelVehicleOption[] = [];
  driverCatalog: FuelDriverOption[] = [];
  tableItems: FuelTableItem[] = [];
  response: FuelRecordListResponse | null = null;
  stats = createEmptyStats();
  ranking = createEmptyRanking();
  chartSource: FuelRecord[] = [];
  selectedRecord: FuelRecord | null = null;
  isLoading = false;
  isLoadingOptions = false;
  isSaving = false;
  currentPage = 1;
  readonly pageSize = 10;

  constructor() {
    this.form.controls.vehicleId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vehicleId) => {
        this.handleVehicleSelection(vehicleId ?? '');
      });

    this.loadOptions();
    this.loadFuelModule();
  }

  protected get pageActions(): PoPageAction[] {
    if (!this.canManageRecords) {
      return [];
    }

    return [
      {
        label: 'Novo abastecimento',
        icon: 'an an-gas-pump',
        action: () => {
          this.openCreateModal();
        },
      },
    ];
  }

  protected get rowActions(): PoTableAction[] {
    if (!this.canManageRecords) {
      return [];
    }

    return [
      {
        label: 'Editar',
        action: (item: FuelTableItem) => {
          this.openEditModal(item);
        },
      },
      {
        label: 'Excluir',
        action: (item: FuelTableItem) => {
          this.removeRecord(item);
        },
      },
    ];
  }

  protected get canManageRecords(): boolean {
    return this.authService.hasAnyRole(['OWNER', 'ADMIN', 'MANAGER']);
  }

  protected get activeFiltersCount(): number {
    const raw = this.filtersForm.getRawValue();

    return [
      raw.vehicleId,
      raw.driverId,
      raw.fuelType,
      raw.gasStation?.trim(),
      raw.anomaly,
      raw.dateFrom,
      raw.dateTo,
    ].filter(Boolean).length;
  }

  protected get paginationSummary(): string {
    if (!this.response) {
      return 'Sem dados carregados.';
    }

    return `Página ${this.response.meta.page} de ${this.response.meta.totalPages} • ${this.response.meta.total} abastecimentos`;
  }

  protected get canGoBack(): boolean {
    return this.currentPage > 1 && !this.isLoading;
  }

  protected get canGoForward(): boolean {
    return Boolean(this.response?.hasNext) && !this.isLoading;
  }

  protected get isEditMode(): boolean {
    return Boolean(this.selectedRecord);
  }

  protected get modalTitle(): string {
    return this.isEditMode ? 'Editar abastecimento' : 'Novo abastecimento';
  }

  protected get modalSubtitle(): string {
    return this.isEditMode
      ? 'Revise volume, custo, quilometragem e informações do lançamento.'
      : 'Registre o abastecimento com foco em eficiência, custo e rastreabilidade.';
  }

  protected get canSave(): boolean {
    return this.form.valid && !this.isSaving;
  }

  protected get totalCostPreview(): number {
    const liters = Number(this.form.controls.liters.value ?? 0);
    const pricePerLiter = Number(this.form.controls.pricePerLiter.value ?? 0);

    return Number((liters * pricePerLiter).toFixed(2));
  }

  protected get totalCostPreviewLabel(): string {
    return formatFuelCurrency(this.totalCostPreview);
  }

  protected get selectedVehicle(): FuelVehicleOption | null {
    const vehicleId = this.form.controls.vehicleId.value;
    return this.vehicleCatalog.find((vehicle) => vehicle.id === vehicleId) ?? null;
  }

  protected get selectedVehicleHelper(): string {
    const vehicle = this.selectedVehicle;

    if (!vehicle) {
      return 'Selecione um veículo para sincronizar combustível e quilometragem sugerida.';
    }

    const consumption =
      vehicle.averageConsumption != null
        ? formatKmPerLiter(vehicle.averageConsumption)
        : 'Sem média histórica';

    return `${formatMileage(vehicle.currentMileage)} atuais • média histórica ${consumption}`;
  }

  protected get filterMetaLabel(): string {
    if (this.isLoading) {
      return 'Atualizando tabela, métricas e ranking...';
    }

    return `${this.stats.totalRecords} registros no recorte atual`;
  }

  protected get anomalySummaryLabel(): string {
    if (this.stats.anomalyCount === 0) {
      return 'Sem anomalias no filtro atual';
    }

    return `${this.stats.anomalyCount} lançamentos fora do padrão`;
  }

  protected get bestRanking(): FuelRecordRankingItem[] {
    return this.ranking.best.slice(0, 3);
  }

  protected get worstRanking(): FuelRecordRankingItem[] {
    return this.ranking.worst.slice(0, 3);
  }

  protected get hasMonthlyCostChart(): boolean {
    return this.monthlyCostPoints.length > 0;
  }

  protected get hasEfficiencyChart(): boolean {
    return this.getRecentEfficiencyRecords().length > 0;
  }

  protected get monthlyCostCategories(): string[] {
    return this.monthlyCostPoints.map((item) => item.label);
  }

  protected get monthlyCostSeries(): PoChartSerie[] {
    return [
      {
        label: 'Custo',
        data: this.monthlyCostPoints.map((item) => item.totalCost),
        color: '#c75000',
      },
    ];
  }

  protected get efficiencyTrendCategories(): string[] {
    return this.getRecentEfficiencyRecords().map((record) => formatFuelDate(record.date));
  }

  protected get efficiencyTrendSeries(): PoChartSerie[] {
    return [
      {
        label: 'Km/l',
        data: this.getRecentEfficiencyRecords().map((record) => Number(record.kmPerLiter ?? 0)),
        color: '#0f766e',
      },
    ];
  }

  protected get formPrimaryAction(): PoModalAction {
    return {
      label: this.isSaving
        ? 'Salvando...'
        : this.isEditMode
          ? 'Salvar alterações'
          : 'Registrar abastecimento',
      disabled: !this.canSave,
      action: () => {
        this.submitForm();
      },
    };
  }

  protected get formSecondaryAction(): PoModalAction {
    return {
      label: 'Cancelar',
      disabled: this.isSaving,
      action: () => {
        this.closeFormModal();
      },
    };
  }

  protected get monthlyCostPoints(): FuelChartPoint[] {
    const grouped = new Map<string, FuelChartPoint>();

    this.chartSource.forEach((record) => {
      const date = new Date(record.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          label: monthFormatter.format(date).replace('.', ''),
          totalCost: 0,
        });
      }

      const current = grouped.get(key);
      if (current) {
        current.totalCost += record.totalCost;
      }
    });

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => ({
        label: value.label,
        totalCost: Number(value.totalCost.toFixed(2)),
      }));
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadFuelModule();
  }

  clearFilters(): void {
    this.filtersForm.reset({
      vehicleId: '',
      driverId: '',
      fuelType: null,
      gasStation: '',
      anomaly: '',
      dateFrom: null,
      dateTo: null,
    });
    this.currentPage = 1;
    this.loadFuelModule();
  }

  previousPage(): void {
    if (!this.canGoBack) {
      return;
    }

    this.currentPage -= 1;
    this.loadFuelModule();
  }

  nextPage(): void {
    if (!this.canGoForward) {
      return;
    }

    this.currentPage += 1;
    this.loadFuelModule();
  }

  formatCurrency(value: number | null | undefined): string {
    return formatFuelCurrency(value);
  }

  formatNumber(value: number | null | undefined, suffix = ''): string {
    return formatFuelNumber(value, suffix);
  }

  formatRankingVehicle(item: FuelRecordRankingItem): string {
    return `${item.plate} • ${item.brand} ${item.model}`;
  }

  getControlErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control || !control.touched || !control.errors) {
      return [];
    }

    const errors: string[] = [];

    if (control.errors['required']) {
      errors.push('Campo obrigatório.');
    }

    if (control.errors['min']) {
      errors.push('Informe um valor válido.');
    }

    if (control.errors['invalidUrl']) {
      errors.push('Informe uma URL válida com http ou https.');
    }

    return errors;
  }

  openCreateModal(): void {
    this.selectedRecord = null;
    this.form.reset({
      vehicleId: '',
      driverId: '',
      date: this.getTodayDate(),
      mileage: null,
      liters: null,
      pricePerLiter: null,
      fuelType: null,
      tankMode: 'full',
      gasStation: '',
      receiptUrl: '',
      notes: '',
    });
    this.formModal().open();
  }

  openEditModal(item: FuelRecord): void {
    this.selectedRecord = item;
    this.form.reset({
      vehicleId: item.vehicleId,
      driverId: item.driverId ?? '',
      date: toIsoDateInputValue(item.date),
      mileage: item.mileage,
      liters: item.liters,
      pricePerLiter: item.pricePerLiter,
      fuelType: item.fuelType,
      tankMode: item.fullTank ? 'full' : 'partial',
      gasStation: item.gasStation ?? '',
      receiptUrl: item.receiptUrl ?? '',
      notes: item.notes ?? '',
    });
    this.formModal().open();
  }

  closeFormModal(): void {
    if (this.isSaving) {
      return;
    }

    this.formModal().close();
    this.selectedRecord = null;
  }

  private loadOptions(): void {
    this.isLoadingOptions = true;

    forkJoin({
      vehicles: this.fuelService.listVehicleOptions(),
      drivers: this.fuelService.listDriverOptions(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingOptions = false;
        }),
      )
      .subscribe({
        next: ({ vehicles, drivers }) => {
          this.vehicleCatalog = vehicles;
          this.driverCatalog = drivers;
          this.vehicleOptions = vehicles.map((vehicle) => ({
            value: vehicle.id,
            label: formatVehicleLabel(vehicle),
          }));
          this.driverOptions = drivers.map((driver) => ({
            value: driver.id,
            label: formatFuelDriverLabel(driver.name, driver.cpf),
          }));
        },
      });
  }

  private loadFuelModule(): void {
    const filters = this.getFilters();

    this.isLoading = true;

    forkJoin({
      list: this.fuelService.list(filters, this.currentPage, this.pageSize),
      stats: this.fuelService.getStats(filters),
      ranking: this.fuelService.getRanking(filters),
      chart: this.fuelService.list(filters, 1, 100),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({ list, stats, ranking, chart }) => {
          this.response = list;
          this.stats = stats;
          this.ranking = ranking;
          this.chartSource = chart.items;
          this.tableItems = list.items.map((item) => this.toTableItem(item));
        },
        error: () => {
          this.response = createEmptyListResponse(this.currentPage, this.pageSize);
          this.stats = createEmptyStats();
          this.ranking = createEmptyRanking();
          this.chartSource = [];
          this.tableItems = [];
          this.notificationService.error(
            'Nao foi possivel carregar o modulo de combustivel. Verifique as migrations e a API.',
          );
        },
      });
  }

  private submitForm(): void {
    if (!this.canSave) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    this.isSaving = true;

    const request$ = this.selectedRecord
      ? this.fuelService.update(this.selectedRecord.id, payload)
      : this.fuelService.create(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success(
            this.selectedRecord
              ? 'Abastecimento atualizado com sucesso.'
              : 'Abastecimento registrado com sucesso.',
          );
          this.closeFormModal();
          this.loadFuelModule();
        },
      });
  }

  private removeRecord(item: FuelRecord): void {
    if (!this.canManageRecords) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir o abastecimento de ${formatFuelDate(item.date)} para ${item.vehicle.plate}?`,
    );

    if (!confirmed) {
      return;
    }

    this.fuelService
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationService.success('Abastecimento removido.');

          if (this.tableItems.length === 1 && this.currentPage > 1) {
            this.currentPage -= 1;
          }

          this.loadFuelModule();
        },
      });
  }

  private getFilters(): FuelRecordListFilters & FuelRankingFilters {
    const raw = this.filtersForm.getRawValue();

    return {
      vehicleId: raw.vehicleId?.trim() || undefined,
      driverId: raw.driverId?.trim() || undefined,
      fuelType: raw.fuelType ?? undefined,
      gasStation: raw.gasStation?.trim() || undefined,
      anomaly: raw.anomaly === 'true' ? true : null,
      dateFrom: raw.dateFrom || undefined,
      dateTo: raw.dateTo || undefined,
    };
  }

  private buildPayload(): FuelRecordFormPayload {
    const raw = this.form.getRawValue();

    return {
      vehicleId: raw.vehicleId ?? '',
      driverId: raw.driverId?.trim() || null,
      date: raw.date ?? this.getTodayDate(),
      mileage: Number(raw.mileage ?? 0),
      liters: Number(raw.liters ?? 0),
      pricePerLiter: Number(raw.pricePerLiter ?? 0),
      totalCost: this.totalCostPreview,
      fuelType: raw.fuelType as FuelType,
      fullTank: raw.tankMode === 'full',
      gasStation: raw.gasStation?.trim() || null,
      receiptUrl: raw.receiptUrl?.trim() || null,
      notes: raw.notes?.trim() || null,
    };
  }

  private handleVehicleSelection(vehicleId: string): void {
    const vehicle = this.vehicleCatalog.find((item) => item.id === vehicleId);

    if (!vehicle) {
      return;
    }

    this.form.controls.fuelType.setValue(vehicle.fuelType, {
      emitEvent: false,
    });

    if (!this.isEditMode) {
      const currentMileage = Number(this.form.controls.mileage.value ?? 0);

      if (currentMileage < vehicle.currentMileage) {
        this.form.controls.mileage.setValue(vehicle.currentMileage, {
          emitEvent: false,
        });
      }
    }
  }

  private getRecentEfficiencyRecords(): FuelRecord[] {
    return [...this.chartSource]
      .filter((record) => record.fullTank && record.kmPerLiter != null)
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .slice(-8);
  }

  private toTableItem(item: FuelRecord): FuelTableItem {
    const anomalyMeta = item.anomaly
      ? {
          label: 'Anomalia',
          helper: item.anomalyReason ?? 'Consumo fora do padrão esperado.',
          type: PoTagType.Danger,
        }
      : {
          label: item.fullTank ? 'Em dia' : 'Parcial',
          helper: item.fullTank ? 'Cálculo de eficiência disponível.' : 'Sem cálculo de km/l.',
          type: item.fullTank ? PoTagType.Success : PoTagType.Warning,
        };

    return {
      ...item,
      vehicleCell: {
        title: formatVehicleLabel(item.vehicle),
        subtitle: item.driver
          ? formatFuelDriverLabel(item.driver.name, item.driver.cpf)
          : 'Sem motorista vinculado',
        anomaly: item.anomaly,
      },
      driverDisplay: item.driver ? item.driver.name : 'Sem motorista',
      fuelTypeDisplay: formatFuelType(item.fuelType),
      volumeCell: {
        liters: formatFuelNumber(item.liters, ' l'),
        pricePerLiter: `${formatFuelCurrency(item.pricePerLiter)}/l`,
        station: item.gasStation ?? 'Posto não informado',
      },
      costDisplay: formatFuelCurrency(item.totalCost),
      efficiencyCell: {
        value: formatKmPerLiter(item.kmPerLiter),
        helper: formatMileage(item.mileage),
        anomaly: item.anomaly,
      },
      anomalyCell: anomalyMeta,
    };
  }

  private getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
