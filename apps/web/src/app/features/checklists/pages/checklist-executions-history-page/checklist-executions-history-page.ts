import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChecklistExecutionStatus } from '@frota-leve/shared/src/enums/checklist-execution-status.enum';
import { ChecklistItemStatus } from '@frota-leve/shared/src/enums/checklist-status.enum';
import { formatCPF, formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import { PoTagType } from '@po-ui/ng-components';
import type { PoBreadcrumb, PoComboOption, PoPageAction } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTagModule,
} from '@po-ui/ng-components';
import { forkJoin, finalize } from 'rxjs';
import { DriversService } from '../../../drivers/drivers.service';
import { VEHICLE_CATEGORY_LABELS } from '../../../vehicles/vehicles.constants';
import { VehiclesService } from '../../../vehicles/vehicles.service';
import { ChecklistsService } from '../../checklists.service';
import type {
  ChecklistExecutionFilters,
  ChecklistExecutionItemRecord,
  ChecklistExecutionRecord,
} from '../../checklists.types';

type ExecutionStatusMeta = {
  label: string;
  type: PoTagType;
};

type ExecutionHistoryMetric = {
  label: string;
  value: string;
  detail: string;
};

type ExecutionHistoryRow = ChecklistExecutionRecord & {
  vehicleLabel: string;
  driverLabel: string;
  executedAtLabel: string;
  statusMeta: ExecutionStatusMeta;
};

type ExecutionItemStatusMeta = {
  label: string;
  type: PoTagType;
};

const PAGE_SIZE = 20;

const EXECUTION_STATUS_META: Record<ChecklistExecutionStatus, ExecutionStatusMeta> = {
  [ChecklistExecutionStatus.COMPLIANT]: {
    label: 'Conforme',
    type: PoTagType.Success,
  },
  [ChecklistExecutionStatus.ATTENTION]: {
    label: 'Atenção',
    type: PoTagType.Warning,
  },
  [ChecklistExecutionStatus.NON_COMPLIANT]: {
    label: 'Não conforme',
    type: PoTagType.Danger,
  },
};

const ITEM_STATUS_META: Record<ChecklistItemStatus, ExecutionItemStatusMeta> = {
  [ChecklistItemStatus.OK]: {
    label: 'OK',
    type: PoTagType.Success,
  },
  [ChecklistItemStatus.ATTENTION]: {
    label: 'Atenção',
    type: PoTagType.Warning,
  },
  [ChecklistItemStatus.NON_COMPLIANT]: {
    label: 'Não conforme',
    type: PoTagType.Danger,
  },
};

@Component({
  selector: 'app-checklist-executions-history-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoTagModule,
    PoLoadingModule,
  ],
  templateUrl: './checklist-executions-history-page.html',
  styleUrl: './checklist-executions-history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistExecutionsHistoryPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly checklistsService = inject(ChecklistsService);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly driversService = inject(DriversService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Checklists', link: '/checklists' },
      { label: 'Histórico', link: '/checklists/history' },
    ],
  };
  readonly filtersForm = this.formBuilder.group({
    vehicleId: [''],
    driverId: [''],
    dateFrom: [''],
    dateTo: [''],
  });
  protected readonly formatCPF = formatCPF;
  protected readonly vehicleCategoryLabels = VEHICLE_CATEGORY_LABELS;

  vehicleOptions: PoComboOption[] = [{ label: 'Todos os veículos', value: '' }];
  driverOptions: PoComboOption[] = [{ label: 'Todos os motoristas', value: '' }];
  items: ExecutionHistoryRow[] = [];
  selectedExecutionId: string | null = null;
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  isLoading = false;
  isLoadingOptions = false;
  hasLoadedOnce = false;
  hasLoadError = false;

  constructor() {
    this.loadOptions();
    this.loadHistory();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Editor de templates',
        action: () => {
          void this.router.navigate(['/checklists']);
        },
      },
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar histórico',
        disabled: this.isLoading,
        action: () => this.reload(),
      },
    ];
  }

  protected get selectedExecution(): ExecutionHistoryRow | null {
    return this.items.find((item) => item.id === this.selectedExecutionId) ?? null;
  }

  protected get summaryMetrics(): ExecutionHistoryMetric[] {
    const total = this.totalItems;
    const compliant = this.items.filter(
      (item) => item.status === ChecklistExecutionStatus.COMPLIANT,
    ).length;
    const attention = this.items.filter(
      (item) => item.status === ChecklistExecutionStatus.ATTENTION,
    ).length;
    const nonCompliant = this.items.filter(
      (item) => item.status === ChecklistExecutionStatus.NON_COMPLIANT,
    ).length;

    return [
      {
        label: 'Execuções filtradas',
        value: String(total),
        detail: total > 0 ? `${this.currentPage} / ${this.totalPages} páginas` : 'Sem resultados',
      },
      {
        label: 'Conformes na página',
        value: String(compliant),
        detail: 'Execuções sem apontamentos críticos',
      },
      {
        label: 'Não conformes na página',
        value: String(nonCompliant),
        detail: attention > 0 ? `${attention} com status atenção` : 'Sem itens em atenção',
      },
    ];
  }

  protected get paginationLabel(): string {
    if (!this.hasLoadedOnce) {
      return '';
    }

    if (this.totalItems === 0) {
      return 'Nenhuma execução encontrada';
    }

    const start = (this.currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage * PAGE_SIZE, this.totalItems);
    return `${start}–${end} de ${this.totalItems} execuções`;
  }

  protected get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  protected get detailStatusCounts(): Array<{ label: string; value: number; type: PoTagType }> {
    const selected = this.selectedExecution;

    if (!selected) {
      return [];
    }

    const okCount = selected.items.filter((item) => item.status === ChecklistItemStatus.OK).length;
    const attentionCount = selected.items.filter(
      (item) => item.status === ChecklistItemStatus.ATTENTION,
    ).length;
    const nonCompliantCount = selected.items.filter(
      (item) => item.status === ChecklistItemStatus.NON_COMPLIANT,
    ).length;

    return [
      { label: 'OK', value: okCount, type: PoTagType.Success },
      { label: 'Atenção', value: attentionCount, type: PoTagType.Warning },
      { label: 'Não conforme', value: nonCompliantCount, type: PoTagType.Danger },
    ];
  }

  protected get detailTitle(): string {
    const selected = this.selectedExecution;

    if (!selected) {
      return 'Selecione uma execução';
    }

    return `${selected.template.name} • ${selected.vehicleLabel}`;
  }

  protected get detailDescription(): string {
    const selected = this.selectedExecution;

    if (!selected) {
      return 'Clique em uma execução para ver itens, observações e contexto operacional.';
    }

    return `Executado em ${selected.executedAtLabel}${selected.driver ? ` por ${selected.driver.name}` : ''}.`;
  }

  protected applyFilters(): void {
    this.currentPage = 1;
    this.loadHistory();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({
      vehicleId: '',
      driverId: '',
      dateFrom: '',
      dateTo: '',
    });
    this.currentPage = 1;
    this.loadHistory();
  }

  protected reload(): void {
    this.loadHistory();
  }

  protected goToPreviousPage(): void {
    if (!this.hasPreviousPage) {
      return;
    }

    this.currentPage -= 1;
    this.loadHistory();
  }

  protected goToNextPage(): void {
    if (!this.hasNext) {
      return;
    }

    this.currentPage += 1;
    this.loadHistory();
  }

  protected selectExecution(item: ExecutionHistoryRow): void {
    this.selectedExecutionId = item.id;
    this.cdr.markForCheck();
  }

  protected getExecutionStatusMeta(status: ChecklistExecutionStatus): ExecutionStatusMeta {
    return EXECUTION_STATUS_META[status];
  }

  protected getItemStatusMeta(status: ChecklistItemStatus): ExecutionItemStatusMeta {
    return ITEM_STATUS_META[status];
  }

  protected openVehicle(vehicleId: string): void {
    void this.router.navigate(['/vehicles', vehicleId]);
  }

  protected openDriver(driverId: string | null): void {
    if (!driverId) {
      return;
    }

    void this.router.navigate(['/drivers', driverId]);
  }

  protected openServiceOrder(serviceOrderId: string | null): void {
    if (!serviceOrderId) {
      return;
    }

    void this.router.navigate(['/maintenance/service-orders', serviceOrderId, 'edit']);
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected formatDriverLabel(item: ExecutionHistoryRow): string {
    return item.driver
      ? `${item.driver.name} • CPF ${formatCPF(item.driver.cpf)}`
      : 'Sem motorista';
  }

  protected getNonCompliantNoteCount(items: ChecklistExecutionItemRecord[]): number {
    return items.filter((item) => item.notes && item.notes.trim().length > 0).length;
  }

  private loadOptions(): void {
    this.isLoadingOptions = true;
    this.cdr.markForCheck();

    forkJoin({
      vehicles: this.vehiclesService.list({}, 1, 100),
      drivers: this.driversService.list({}, 1, 100),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingOptions = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ vehicles, drivers }) => {
          this.vehicleOptions = [
            { label: 'Todos os veículos', value: '' },
            ...vehicles.items.map((vehicle) => ({
              label: `${formatPlate(vehicle.plate)} • ${vehicle.brand} ${vehicle.model} (${vehicle.year})`,
              value: vehicle.id,
            })),
          ];

          this.driverOptions = [
            { label: 'Todos os motoristas', value: '' },
            ...drivers.items.map((driver) => ({
              label: `${driver.name} • CPF ${formatCPF(driver.cpf)}`,
              value: driver.id,
            })),
          ];

          this.cdr.markForCheck();
        },
      });
  }

  private loadHistory(): void {
    this.isLoading = true;
    this.hasLoadError = false;
    this.cdr.markForCheck();

    this.checklistsService
      .listExecutions(this.getFilters(), this.currentPage, PAGE_SIZE)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.items = response.items.map((item) => this.toExecutionHistoryRow(item));
          this.totalItems = response.meta.total;
          this.totalPages = response.meta.totalPages;
          this.hasNext = response.hasNext;
          this.hasLoadError = false;
          this.resolveSelectedExecution();
          this.cdr.markForCheck();
        },
        error: () => {
          this.items = [];
          this.totalItems = 0;
          this.totalPages = 0;
          this.hasNext = false;
          this.selectedExecutionId = null;
          this.hasLoadError = true;
          this.cdr.markForCheck();
        },
      });
  }

  private resolveSelectedExecution(): void {
    if (this.items.length === 0) {
      this.selectedExecutionId = null;
      return;
    }

    if (
      this.selectedExecutionId &&
      this.items.some((item) => item.id === this.selectedExecutionId)
    ) {
      return;
    }

    this.selectedExecutionId = this.items[0]?.id ?? null;
  }

  private getFilters(): ChecklistExecutionFilters {
    const rawValue = this.filtersForm.getRawValue();

    return {
      vehicleId: rawValue.vehicleId?.trim() || undefined,
      driverId: rawValue.driverId?.trim() || undefined,
      dateFrom: rawValue.dateFrom || undefined,
      dateTo: rawValue.dateTo || undefined,
    };
  }

  private toExecutionHistoryRow(item: ChecklistExecutionRecord): ExecutionHistoryRow {
    return {
      ...item,
      vehicleLabel: `${formatPlate(item.vehicle.plate)} • ${item.vehicle.brand} ${item.vehicle.model}`,
      driverLabel: item.driver
        ? `${item.driver.name} • CPF ${formatCPF(item.driver.cpf)}`
        : 'Sem motorista',
      executedAtLabel: this.formatDateTime(item.executedAt),
      statusMeta: this.getExecutionStatusMeta(item.status),
    };
  }
}
