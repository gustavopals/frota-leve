import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';
import type {
  PoComboOption,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoDialogModule,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoTagType,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import { FineIdentifyDriverModal } from '../../components/fine-identify-driver-modal/fine-identify-driver-modal';
import {
  FINE_SEVERITY_OPTIONS,
  FINE_STATUS_OPTIONS,
  FINE_WORKFLOW_ROLES,
} from '../../fines.constants';
import { FinesService } from '../../fines.service';
import type { FineListFilters, FineListResponse, FineRecord } from '../../fines.types';
import {
  formatDriverLabel,
  formatFineAmount,
  formatFineDate,
  formatFinePoints,
  formatFineSeverity,
  formatFineStatus,
  getSeverityTagType,
  getStatusTagType,
  isDueDateOverdue,
} from '../../fines.utils';

type FineTableItem = FineRecord & {
  _vehicleLabel: string;
  _driverLabel: string;
  _amountLabel: string;
  _discountLabel: string;
  _dateLabel: string;
  _dueDateLabel: string;
  _statusLabel: string;
  _statusTagType: PoTagType;
  _severityLabel: string;
  _severityTagType: PoTagType;
  _pointsLabel: string;
  _isOverdue: boolean;
};

const PAGE_SIZE = 20;

@Component({
  selector: 'app-fines-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoTableModule,
    PoFieldModule,
    PoButtonModule,
    PoTagModule,
    PoLoadingModule,
    PoDialogModule,
    FineIdentifyDriverModal,
  ],
  templateUrl: './fines-page.html',
  styleUrl: './fines-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinesPage {
  @ViewChild('importInput') importInputRef!: ElementRef<HTMLInputElement>;
  private readonly identifyDriverModal =
    viewChild.required<FineIdentifyDriverModal>('identifyDriverModal');

  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly finesService = inject(FinesService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly statusOptions: PoComboOption[] = FINE_STATUS_OPTIONS;
  readonly severityOptions: PoComboOption[] = FINE_SEVERITY_OPTIONS;

  readonly filtersForm = this.formBuilder.group({
    search: [''],
    status: ['' as FineStatus | ''],
    severity: [''],
    dateFrom: [''],
    dateTo: [''],
  });

  items: FineTableItem[] = [];
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  isLoading = false;
  isImporting = false;
  hasLoadedOnce = false;
  private focusedFineId: string | null = null;

  readonly columns: PoTableColumn[] = [
    { property: '_vehicleLabel', label: 'Veículo', width: '13%' },
    { property: 'autoNumber', label: 'Nº do auto', width: '11%' },
    { property: 'description', label: 'Descrição', width: '18%' },
    { property: '_severityLabel', label: 'Gravidade', width: '10%', type: 'cellTemplate' },
    { property: '_pointsLabel', label: 'Pontos', width: '7%' },
    { property: '_amountLabel', label: 'Valor', width: '10%', type: 'cellTemplate' },
    { property: '_dueDateLabel', label: 'Vencimento', width: '10%', type: 'cellTemplate' },
    { property: '_statusLabel', label: 'Status', width: '11%', type: 'cellTemplate' },
    { property: '_driverLabel', label: 'Motorista', width: '10%' },
  ];

  readonly tableActions: PoTableAction[] = [
    {
      label: 'Identificar condutor',
      action: (row: FineTableItem) => this.openIdentifyDriver(row),
      disabled: (row: FineTableItem) =>
        row.status !== FineStatus.PENDING || !this.canManageWorkflow,
    },
    {
      label: 'Registrar recurso',
      action: (row: FineTableItem) => this.confirmAppeal(row),
      disabled: (row: FineTableItem) =>
        ![FineStatus.PENDING, FineStatus.DRIVER_IDENTIFIED].includes(row.status) ||
        !this.canManageWorkflow,
    },
    {
      label: 'Registrar pagamento',
      action: (row: FineTableItem) => this.confirmPayment(row),
      disabled: (row: FineTableItem) =>
        [FineStatus.PAID, FineStatus.PAYROLL_DEDUCTED].includes(row.status) ||
        !this.canManageWorkflow,
    },
    {
      label: 'Excluir',
      action: (row: FineTableItem) => this.confirmDelete(row),
      disabled: (row: FineTableItem) =>
        row.status !== FineStatus.PENDING || !this.canManageWorkflow,
      type: 'danger',
    },
  ];

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const fineId = params.get('fineId');

      if (!fineId) {
        this.focusedFineId = null;
        this.load();
        return;
      }

      if (fineId === this.focusedFineId) {
        return;
      }

      this.focusedFineId = fineId;
      this.focusFineFromNotification(fineId);
    });
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Dashboard',
        icon: 'an an-chart-bar',
        action: () => void this.router.navigate(['/fines/dashboard']),
      },
      {
        label: 'Importar planilha',
        icon: 'an an-upload-simple',
        action: () => this.triggerImport(),
        disabled: this.isImporting || !this.canManageWorkflow,
      },
      {
        label: this.isLoading ? 'Carregando...' : 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => this.reload(),
      },
    ];
  }

  protected get canManageWorkflow(): boolean {
    return this.authService.hasAnyRole(FINE_WORKFLOW_ROLES);
  }

  protected get paginationLabel(): string {
    if (!this.hasLoadedOnce) return '';
    if (this.totalItems === 0) return 'Nenhuma multa encontrada';
    const start = (this.currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage * PAGE_SIZE, this.totalItems);
    return `${start}–${end} de ${this.totalItems} multas`;
  }

  protected get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  protected applyFilters(): void {
    this.currentPage = 1;
    this.load();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', severity: '', dateFrom: '', dateTo: '' });
    this.currentPage = 1;
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  protected goToPreviousPage(): void {
    if (this.hasPreviousPage) {
      this.currentPage--;
      this.load();
    }
  }

  protected goToNextPage(): void {
    if (this.hasNext) {
      this.currentPage++;
      this.load();
    }
  }

  protected triggerImport(): void {
    this.importInputRef.nativeElement.click();
  }

  protected onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    this.isImporting = true;
    this.cdr.markForCheck();

    this.finesService
      .importFile(file)
      .pipe(
        finalize(() => {
          this.isImporting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (result) => {
          if (result.imported > 0) {
            this.notificationService.success(
              `${result.imported} multa(s) importada(s) com sucesso.${result.failed > 0 ? ` ${result.failed} linha(s) com erro.` : ''}`,
            );
            this.reload();
          } else {
            this.notificationService.warning(
              `Nenhuma multa importada. ${result.failed} linha(s) com erro.`,
            );
          }
        },
        error: () => {
          this.notificationService.error(
            'Falha ao importar planilha. Verifique o formato do arquivo.',
          );
        },
      });
  }

  protected openIdentifyDriver(fine: FineTableItem): void {
    this.identifyDriverModal().open(fine);
  }

  private confirmAppeal(fine: FineTableItem): void {
    if (!confirm(`Registrar recurso para a multa ${fine.autoNumber}?`)) return;
    this.applyWorkflowTransition(fine, FineStatus.APPEALED);
  }

  private confirmPayment(fine: FineTableItem): void {
    if (!confirm(`Confirmar pagamento da multa ${fine.autoNumber} (${fine._amountLabel})?`)) return;
    this.applyWorkflowTransition(fine, FineStatus.PAID);
  }

  private confirmDelete(fine: FineTableItem): void {
    if (!confirm(`Excluir a multa ${fine.autoNumber}? Esta ação não pode ser desfeita.`)) return;

    this.finesService.delete(fine.id).subscribe({
      next: () => {
        this.notificationService.success('Multa excluída com sucesso.');
        this.load();
      },
      error: () => {
        this.notificationService.error('Não foi possível excluir a multa.');
      },
    });
  }

  private applyWorkflowTransition(fine: FineTableItem, nextStatus: FineStatus): void {
    const payload = {
      vehicleId: fine.vehicleId,
      driverId: fine.driverId,
      date: fine.date,
      autoNumber: fine.autoNumber,
      location: fine.location,
      description: fine.description,
      severity: fine.severity,
      points: fine.points,
      amount: fine.amount,
      discountAmount: fine.discountAmount,
      dueDate: fine.dueDate,
      status: nextStatus,
      payrollDeduction: fine.payrollDeduction,
      notes: fine.notes,
      fileUrl: fine.fileUrl,
    };

    this.finesService.update(fine.id, payload).subscribe({
      next: () => {
        this.notificationService.success(
          `Status da multa atualizado para: ${formatFineStatus(nextStatus)}`,
        );
        this.load();
      },
      error: () => {
        this.notificationService.error('Não foi possível atualizar o status da multa.');
      },
    });
  }

  private load(): void {
    if (this.isLoading) return;

    const values = this.filtersForm.value;
    const filters: FineListFilters = {
      ...(values.search?.trim() ? { search: values.search } : {}),
      ...(values.status ? { status: values.status as FineStatus } : {}),
      ...(values.severity ? { severity: values.severity as never } : {}),
      ...(values.dateFrom ? { dateFrom: values.dateFrom } : {}),
      ...(values.dateTo ? { dateTo: values.dateTo } : {}),
    };

    this.isLoading = true;
    this.cdr.markForCheck();

    this.finesService
      .list(filters, this.currentPage, PAGE_SIZE)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response: FineListResponse) => {
          this.items = response.items.map((fine) => this.toTableItem(fine));
          this.totalItems = response.meta.total;
          this.totalPages = response.meta.totalPages;
          this.hasNext = response.hasNext;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar as multas.');
        },
      });
  }

  private focusFineFromNotification(fineId: string): void {
    this.finesService.getById(fineId).subscribe({
      next: (fine) => {
        const referenceDate = fine.date.slice(0, 10);

        this.filtersForm.patchValue({
          search: fine.autoNumber,
          status: fine.status,
          severity: fine.severity,
          dateFrom: referenceDate,
          dateTo: referenceDate,
        });
        this.currentPage = 1;
        this.load();
      },
      error: () => {
        this.notificationService.warning(
          'Não foi possível abrir a multa diretamente a partir da notificação.',
        );
        void this.router.navigate(['/fines']);
      },
    });
  }

  private toTableItem(fine: FineRecord): FineTableItem {
    return {
      ...fine,
      _vehicleLabel: `${fine.vehicle.plate} — ${fine.vehicle.brand} ${fine.vehicle.model}`,
      _driverLabel: formatDriverLabel(fine.driver),
      _amountLabel: formatFineAmount(fine.amount),
      _discountLabel: fine.discountAmount != null ? formatFineAmount(fine.discountAmount) : '—',
      _dateLabel: formatFineDate(fine.date),
      _dueDateLabel: formatFineDate(fine.dueDate),
      _statusLabel: formatFineStatus(fine.status),
      _statusTagType: getStatusTagType(fine.status),
      _severityLabel: formatFineSeverity(fine.severity),
      _severityTagType: getSeverityTagType(fine.severity),
      _pointsLabel: formatFinePoints(fine.points),
      _isOverdue: isDueDateOverdue(fine.dueDate),
    };
  }
}
