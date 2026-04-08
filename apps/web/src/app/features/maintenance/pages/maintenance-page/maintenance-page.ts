import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type {
  PoBreadcrumb,
  PoComboOption,
  PoPageAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoFieldModule,
  PoPageModule,
  PoTagType,
  PoTableModule,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import {
  MAINTENANCE_ACTIVITY_OPTIONS,
  MAINTENANCE_TYPE_OPTIONS,
} from '../../maintenance.constants';
import { MaintenanceService } from '../../maintenance.service';
import type {
  MaintenancePlanActivityFilter,
  MaintenancePlanListFilters,
  MaintenancePlanListResponse,
  MaintenancePlanRecord,
  MaintenancePlanVisualStatus,
  MaintenanceType,
} from '../../maintenance.types';
import {
  formatLastExecution,
  formatMaintenanceInterval,
  formatMaintenanceType,
  formatMaintenanceVehicleLabel,
  getMaintenancePlanVisualStatus,
  getMaintenanceStatusHelper,
  getMaintenanceStatusLabel,
  getNextDueSummary,
} from '../../maintenance.utils';

type MaintenanceTableItem = MaintenancePlanRecord & {
  planCell: {
    title: string;
    subtitle: string;
    activityLabel: string;
    status: MaintenancePlanVisualStatus;
  };
  vehicleCell: {
    title: string;
    subtitle: string;
  };
  scheduleCell: {
    primary: string;
    secondary: string;
  };
  nextDueCell: {
    primary: string;
    secondary: string;
  };
  statusCell: {
    label: string;
    helper: string;
    type: PoTagType;
    status: MaintenancePlanVisualStatus;
  };
};

function createEmptyResponse(page: number, pageSize: number): MaintenancePlanListResponse {
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

@Component({
  selector: 'app-maintenance-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoFieldModule,
    PoButtonModule,
    PoTableModule,
    PoTagModule,
  ],
  templateUrl: './maintenance-page.html',
  styleUrl: './maintenance-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenancePage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly notificationService = inject(NotificationService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Manutenção', link: '/maintenance' },
    ],
  };

  readonly filtersForm = this.formBuilder.group({
    search: [''],
    vehicleId: [''],
    type: [null as MaintenanceType | null],
    activity: ['active' as MaintenancePlanActivityFilter | ''],
  });

  readonly typeOptions = MAINTENANCE_TYPE_OPTIONS;
  readonly activityOptions = MAINTENANCE_ACTIVITY_OPTIONS;
  readonly planColumnProperty = 'planCell';
  readonly vehicleColumnProperty = 'vehicleCell';
  readonly scheduleColumnProperty = 'scheduleCell';
  readonly nextDueColumnProperty = 'nextDueCell';
  readonly statusColumnProperty = 'statusCell';
  readonly columns: PoTableColumn[] = [
    {
      property: this.planColumnProperty,
      label: 'Plano',
      type: 'columnTemplate',
      width: '260px',
      sortable: false,
    },
    {
      property: this.vehicleColumnProperty,
      label: 'Veículo',
      type: 'columnTemplate',
      width: '240px',
      sortable: false,
    },
    {
      property: this.scheduleColumnProperty,
      label: 'Cadência',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.nextDueColumnProperty,
      label: 'Próximo gatilho',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.statusColumnProperty,
      label: 'Status',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
  ];

  vehicleOptions: PoComboOption[] = [];
  response: MaintenancePlanListResponse | null = null;
  tableItems: MaintenanceTableItem[] = [];
  isLoading = false;
  isLoadingOptions = false;
  currentPage = 1;
  readonly pageSize = 10;

  constructor() {
    this.loadVehicleOptions();
    this.loadPlans();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => {
          this.reloadCurrentPage();
        },
      },
    ];
  }

  protected get activeFiltersCount(): number {
    const raw = this.filtersForm.getRawValue();

    return [
      raw.search?.trim(),
      raw.vehicleId,
      raw.type,
      raw.activity && raw.activity !== 'active' ? raw.activity : null,
    ].filter(Boolean).length;
  }

  protected get totalPlansOnPage(): number {
    return this.tableItems.length;
  }

  protected get healthyPlansCount(): number {
    return this.tableItems.filter((item) => item.statusCell.status === 'healthy').length;
  }

  protected get upcomingPlansCount(): number {
    return this.tableItems.filter((item) => item.statusCell.status === 'upcoming').length;
  }

  protected get overduePlansCount(): number {
    return this.tableItems.filter((item) => item.statusCell.status === 'overdue').length;
  }

  protected get activePlansCount(): number {
    return this.tableItems.filter((item) => item.isActive).length;
  }

  protected get coverageRateLabel(): string {
    if (this.activePlansCount === 0) {
      return 'Sem planos ativos na página';
    }

    const rate = Math.round((this.healthyPlansCount / this.activePlansCount) * 100);
    return `${rate}% dos ativos em zona verde`;
  }

  protected get paginationSummary(): string {
    if (!this.response) {
      return 'Sem dados carregados.';
    }

    return `Página ${this.response.meta.page} de ${this.response.meta.totalPages} • ${this.response.meta.total} planos`;
  }

  protected get canGoBack(): boolean {
    return this.currentPage > 1 && !this.isLoading;
  }

  protected get canGoForward(): boolean {
    return Boolean(this.response?.hasNext) && !this.isLoading;
  }

  protected get hasItems(): boolean {
    return this.tableItems.length > 0;
  }

  protected applyFilters(): void {
    this.loadPlans(1);
  }

  protected clearFilters(): void {
    this.filtersForm.reset({
      search: '',
      vehicleId: '',
      type: null,
      activity: 'active',
    });
    this.loadPlans(1);
  }

  protected previousPage(): void {
    if (!this.canGoBack) {
      return;
    }

    this.loadPlans(this.currentPage - 1);
  }

  protected nextPage(): void {
    if (!this.canGoForward) {
      return;
    }

    this.loadPlans(this.currentPage + 1);
  }

  private reloadCurrentPage(): void {
    this.loadPlans(this.currentPage);
  }

  private loadVehicleOptions(): void {
    this.isLoadingOptions = true;

    this.maintenanceService
      .listVehicleOptions()
      .pipe(
        finalize(() => {
          this.isLoadingOptions = false;
        }),
      )
      .subscribe({
        next: (vehicles) => {
          this.vehicleOptions = vehicles.map((vehicle) => ({
            label: formatMaintenanceVehicleLabel(vehicle),
            value: vehicle.id,
          }));
        },
        error: () => {
          this.notificationService.warning(
            'Não foi possível carregar os veículos para o filtro de manutenção.',
          );
        },
      });
  }

  private loadPlans(page = this.currentPage): void {
    this.isLoading = true;
    const filters = this.getFilters();

    this.maintenanceService
      .listPlans(filters, page, this.pageSize)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.response = response;
          this.currentPage = response.meta.page;
          this.tableItems = response.items.map((item) => this.toTableItem(item));
        },
        error: () => {
          this.response = createEmptyResponse(page, this.pageSize);
          this.tableItems = [];
          this.notificationService.error('Não foi possível carregar os planos de manutenção.');
        },
      });
  }

  private getFilters(): MaintenancePlanListFilters {
    const raw = this.filtersForm.getRawValue();

    return {
      ...(raw.search?.trim() ? { search: raw.search.trim() } : {}),
      ...(raw.vehicleId ? { vehicleId: raw.vehicleId } : {}),
      ...(raw.type ? { type: raw.type } : {}),
      ...(raw.activity ? { activity: raw.activity as MaintenancePlanActivityFilter } : {}),
    };
  }

  private toTableItem(plan: MaintenancePlanRecord): MaintenanceTableItem {
    const status = getMaintenancePlanVisualStatus(plan);
    const nextDue = getNextDueSummary(plan);

    return {
      ...plan,
      planCell: {
        title: plan.name,
        subtitle: formatMaintenanceType(plan.type),
        activityLabel: plan.isActive ? 'Ativo' : 'Pausado',
        status,
      },
      vehicleCell: {
        title: plan.vehicle.plate,
        subtitle: `${plan.vehicle.brand} ${plan.vehicle.model} • ${plan.vehicle.year}`,
      },
      scheduleCell: {
        primary: formatMaintenanceInterval(plan),
        secondary: formatLastExecution(plan),
      },
      nextDueCell: nextDue,
      statusCell: {
        label: getMaintenanceStatusLabel(status),
        helper: getMaintenanceStatusHelper(plan, status),
        type: this.getStatusTagType(status),
        status,
      },
    };
  }

  private getStatusTagType(status: MaintenancePlanVisualStatus): PoTagType {
    switch (status) {
      case 'healthy':
        return PoTagType.Success;
      case 'upcoming':
        return PoTagType.Warning;
      case 'overdue':
        return PoTagType.Danger;
      case 'inactive':
        return PoTagType.Neutral;
      default:
        return PoTagType.Neutral;
    }
  }
}
