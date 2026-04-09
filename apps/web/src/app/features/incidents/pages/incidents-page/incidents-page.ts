import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  PoComboOption,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoFieldModule,
  PoLoadingModule,
  PoModalComponent,
  PoModalModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoTagType,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import { INCIDENT_STATUS_OPTIONS, INCIDENT_TYPE_FILTER_OPTIONS } from '../../incidents.constants';
import { IncidentsService } from '../../incidents.service';
import type {
  IncidentListFilters,
  IncidentRecord,
  IncidentStatus,
  IncidentType,
} from '../../incidents.types';
import {
  formatCurrency,
  formatDowntime,
  formatIncidentDate,
  formatIncidentStatus,
  formatIncidentType,
  getStatusTagType,
  getTimelineSteps,
} from '../../incidents.utils';

type IncidentTableRow = IncidentRecord & {
  _vehicleLabel: string;
  _driverLabel: string;
  _typeLabel: string;
  _dateLabel: string;
  _statusLabel: string;
  _statusTagType: PoTagType;
  _estimatedCostLabel: string;
  _downtimeLabel: string;
};

const PAGE_SIZE = 20;
const MANAGE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

@Component({
  selector: 'app-incidents-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoTableModule,
    PoFieldModule,
    PoButtonModule,
    PoTagModule,
    PoLoadingModule,
    PoModalModule,
  ],
  templateUrl: './incidents-page.html',
  styleUrl: './incidents-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentsPage {
  private readonly incidentsService = inject(IncidentsService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly statusOptions: PoComboOption[] = INCIDENT_STATUS_OPTIONS;
  readonly typeOptions: PoComboOption[] = INCIDENT_TYPE_FILTER_OPTIONS;

  readonly filtersForm = this.formBuilder.group({
    search: [''],
    status: ['' as IncidentStatus | ''],
    type: ['' as IncidentType | ''],
    dateFrom: [''],
    dateTo: [''],
  });

  items: IncidentTableRow[] = [];
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  isLoading = false;
  hasLoadedOnce = false;

  private readonly timelineModal = viewChild.required<PoModalComponent>('timelineModal');

  // Timeline modal
  timelineIncident: IncidentRecord | null = null;

  readonly columns: PoTableColumn[] = [
    { property: '_vehicleLabel', label: 'Veículo', width: '14%' },
    { property: '_dateLabel', label: 'Data', width: '9%' },
    { property: '_typeLabel', label: 'Tipo', width: '12%' },
    { property: 'location', label: 'Local', width: '16%' },
    { property: 'description', label: 'Descrição', width: '18%' },
    { property: '_estimatedCostLabel', label: 'Custo est.', width: '10%' },
    { property: '_downtimeLabel', label: 'Indisp.', width: '8%' },
    { property: '_statusLabel', label: 'Status', width: '9%', type: 'cellTemplate' },
    { property: '_driverLabel', label: 'Motorista', width: '10%' },
  ];

  readonly tableActions: PoTableAction[] = [
    {
      label: 'Ver timeline',
      action: (row: IncidentTableRow) => this.openTimeline(row),
    },
    {
      label: 'Editar',
      action: (row: IncidentTableRow) => void this.router.navigate(['/incidents', row.id, 'edit']),
      disabled: (row: IncidentTableRow) => !this.canManage || row.status === 'CONCLUDED',
    },
    {
      label: 'Excluir',
      type: 'danger',
      action: (row: IncidentTableRow) => this.confirmDelete(row),
      disabled: (row: IncidentTableRow) => !this.canManage || row.status !== 'REGISTERED',
    },
  ];

  constructor() {
    this.load();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Registrar sinistro',
        icon: 'an an-plus',
        action: () => void this.router.navigate(['/incidents/new']),
        disabled: !this.canManage,
      },
      {
        label: this.isLoading ? 'Carregando...' : 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => this.reload(),
      },
    ];
  }

  protected get canManage(): boolean {
    return this.authService.hasAnyRole(MANAGE_ROLES as never);
  }

  protected get paginationLabel(): string {
    if (!this.hasLoadedOnce || this.totalItems === 0) return '';
    const start = (this.currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage * PAGE_SIZE, this.totalItems);
    return `${start}–${end} de ${this.totalItems} sinistros`;
  }

  protected get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  protected get timelineSteps() {
    return this.timelineIncident ? getTimelineSteps(this.timelineIncident) : [];
  }

  protected applyFilters(): void {
    this.currentPage = 1;
    this.load();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', type: '', dateFrom: '', dateTo: '' });
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

  protected openTimeline(incident: IncidentRecord): void {
    this.timelineIncident = incident;
    this.cdr.markForCheck();
    this.timelineModal().open();
  }

  protected closeTimeline(): void {
    this.timelineModal().close();
    this.timelineIncident = null;
    this.cdr.markForCheck();
  }

  protected editFromTimeline(): void {
    if (!this.timelineIncident) return;
    const id = this.timelineIncident.id;
    this.closeTimeline();
    void this.router.navigate(['/incidents', id, 'edit']);
  }

  protected formatCurrency = formatCurrency;
  protected formatIncidentDate = formatIncidentDate;
  protected formatIncidentStatus = formatIncidentStatus;
  protected formatIncidentType = formatIncidentType;
  protected getStatusTagType = getStatusTagType;

  private confirmDelete(incident: IncidentTableRow): void {
    if (
      !confirm(
        `Excluir sinistro do veículo ${incident.vehicle.plate} (${incident._dateLabel})? Esta ação não pode ser desfeita.`,
      )
    )
      return;

    this.incidentsService.delete(incident.id).subscribe({
      next: () => {
        this.notificationService.success('Sinistro excluído com sucesso.');
        this.load();
      },
      error: () => {
        this.notificationService.error('Não foi possível excluir o sinistro.');
      },
    });
  }

  private load(): void {
    if (this.isLoading) return;

    const v = this.filtersForm.value;
    const filters: IncidentListFilters = {
      ...(v.search?.trim() ? { search: v.search } : {}),
      ...(v.status ? { status: v.status as IncidentStatus } : {}),
      ...(v.type ? { type: v.type as IncidentType } : {}),
      ...(v.dateFrom ? { dateFrom: v.dateFrom } : {}),
      ...(v.dateTo ? { dateTo: v.dateTo } : {}),
    };

    this.isLoading = true;
    this.cdr.markForCheck();

    this.incidentsService
      .list(filters, this.currentPage, PAGE_SIZE)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.items = response.items.map((i) => this.toRow(i));
          this.totalItems = response.meta.total;
          this.totalPages = response.meta.totalPages;
          this.hasNext = response.hasNext;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar os sinistros.');
        },
      });
  }

  private toRow(incident: IncidentRecord): IncidentTableRow {
    return {
      ...incident,
      _vehicleLabel: `${incident.vehicle.plate} — ${incident.vehicle.brand} ${incident.vehicle.model}`,
      _driverLabel: incident.driver?.name ?? '—',
      _typeLabel: formatIncidentType(incident.type),
      _dateLabel: formatIncidentDate(incident.date),
      _statusLabel: formatIncidentStatus(incident.status),
      _statusTagType: getStatusTagType(incident.status),
      _estimatedCostLabel: formatCurrency(incident.estimatedCost),
      _downtimeLabel: formatDowntime(incident.downtime),
    };
  }
}
