import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServiceOrderStatus } from '@frota-leve/shared/src/enums/os-status.enum';
import type {
  PoBreadcrumb,
  PoChartOptions,
  PoChartSerie,
  PoComboOption,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoFieldModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoTagType,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import {
  MAINTENANCE_ACTIVITY_OPTIONS,
  MAINTENANCE_TYPE_OPTIONS,
  SERVICE_ORDER_STATUS_OPTIONS,
  SERVICE_ORDER_WORKFLOW_ROLES,
} from '../../maintenance.constants';
import { MaintenanceService } from '../../maintenance.service';
import type {
  MaintenancePlanActivityFilter,
  MaintenancePlanListFilters,
  MaintenancePlanListResponse,
  MaintenancePlanRecord,
  MaintenanceStatsResponse,
  MaintenancePlanVisualStatus,
  MaintenanceType,
  MaintenanceVehicleOption,
  ServiceOrderListFilters,
  ServiceOrderListResponse,
  ServiceOrderRecord,
} from '../../maintenance.types';
import {
  formatLastExecution,
  formatMaintenanceCurrency,
  formatMaintenanceDate,
  formatMaintenanceInterval,
  formatMaintenanceType,
  formatMaintenanceVehicleLabel,
  formatServiceOrderContext,
  formatServiceOrderCostHelper,
  formatServiceOrderStatus,
  formatServiceOrderTimeline,
  getMaintenancePlanVisualStatus,
  getMaintenanceStatusHelper,
  getMaintenanceStatusLabel,
  getNextDueSummary,
} from '../../maintenance.utils';

type MaintenancePlanTableItem = MaintenancePlanRecord & {
  planCell: {
    title: string;
    subtitle: string;
    activityLabel: string;
    status: MaintenancePlanVisualStatus;
  };
  planVehicleCell: {
    title: string;
    subtitle: string;
  };
  planScheduleCell: {
    primary: string;
    secondary: string;
  };
  planNextDueCell: {
    primary: string;
    secondary: string;
  };
  planStatusCell: {
    label: string;
    helper: string;
    type: PoTagType;
    status: MaintenancePlanVisualStatus;
  };
};

type ServiceOrderTableItem = ServiceOrderRecord & {
  serviceOrderCell: {
    title: string;
    subtitle: string;
    helper: string;
    status: ServiceOrderStatus;
  };
  serviceOrderVehicleCell: {
    title: string;
    subtitle: string;
  };
  serviceOrderTimelineCell: {
    primary: string;
    secondary: string;
  };
  serviceOrderCostCell: {
    primary: string;
    secondary: string;
  };
  serviceOrderStatusCell: {
    label: string;
    helper: string;
    type: PoTagType;
  };
  serviceOrderWorkflowCell: {
    order: ServiceOrderRecord;
    actions: ServiceOrderWorkflowAction[];
    canManage: boolean;
    helper: string;
  };
};

type ServiceOrderWorkflowAction = {
  label: string;
  nextStatus: ServiceOrderStatus;
  kind: 'primary' | 'secondary' | 'tertiary';
};

type MaintenanceDashboardWorkflowCounts = {
  open: number;
  approved: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

type MaintenanceDashboardTopVehicle = {
  id: string;
  title: string;
  subtitle: string;
  totalCost: string;
  totalOrders: number;
};

function createEmptyPlanResponse(page: number, pageSize: number): MaintenancePlanListResponse {
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

function createEmptyServiceOrderResponse(page: number, pageSize: number): ServiceOrderListResponse {
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
    DecimalPipe,
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoChartModule,
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
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly notificationService = inject(NotificationService);

  readonly dashboardCostChartType = PoChartType.Column;
  readonly dashboardWorkflowChartType = PoChartType.Donut;
  readonly dashboardCostChartOptions: PoChartOptions = {
    stacked: true,
    legend: true,
    legendPosition: 'right',
    legendVerticalPosition: 'top',
    descriptionChart: 'Custos de manutenção por período e por tipo.',
    rendererOption: 'svg',
  };

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Manutenção', link: '/maintenance' },
    ],
  };

  readonly planFiltersForm = this.formBuilder.group({
    search: [''],
    vehicleId: [''],
    type: [null as MaintenanceType | null],
    activity: ['active' as MaintenancePlanActivityFilter | ''],
  });

  readonly serviceOrderFiltersForm = this.formBuilder.group({
    vehicleId: [''],
    status: ['' as ServiceOrderStatus | ''],
    dateFrom: [null as string | null],
    dateTo: [null as string | null],
  });

  readonly typeOptions = MAINTENANCE_TYPE_OPTIONS;
  readonly activityOptions = MAINTENANCE_ACTIVITY_OPTIONS;
  readonly serviceOrderStatusOptions = SERVICE_ORDER_STATUS_OPTIONS;
  readonly planColumnProperty = 'planCell';
  readonly planVehicleColumnProperty = 'planVehicleCell';
  readonly planScheduleColumnProperty = 'planScheduleCell';
  readonly planNextDueColumnProperty = 'planNextDueCell';
  readonly planStatusColumnProperty = 'planStatusCell';
  readonly serviceOrderColumnProperty = 'serviceOrderCell';
  readonly serviceOrderVehicleColumnProperty = 'serviceOrderVehicleCell';
  readonly serviceOrderTimelineColumnProperty = 'serviceOrderTimelineCell';
  readonly serviceOrderCostColumnProperty = 'serviceOrderCostCell';
  readonly serviceOrderStatusColumnProperty = 'serviceOrderStatusCell';
  readonly serviceOrderWorkflowColumnProperty = 'serviceOrderWorkflowCell';
  readonly planColumns: PoTableColumn[] = [
    {
      property: this.planColumnProperty,
      label: 'Plano',
      type: 'columnTemplate',
      width: '260px',
      sortable: false,
    },
    {
      property: this.planVehicleColumnProperty,
      label: 'Veículo',
      type: 'columnTemplate',
      width: '240px',
      sortable: false,
    },
    {
      property: this.planScheduleColumnProperty,
      label: 'Cadência',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.planNextDueColumnProperty,
      label: 'Próximo gatilho',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.planStatusColumnProperty,
      label: 'Status',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
  ];
  readonly serviceOrderColumns: PoTableColumn[] = [
    {
      property: this.serviceOrderColumnProperty,
      label: 'OS',
      type: 'columnTemplate',
      width: '320px',
      sortable: false,
    },
    {
      property: this.serviceOrderVehicleColumnProperty,
      label: 'Veículo',
      type: 'columnTemplate',
      width: '240px',
      sortable: false,
    },
    {
      property: this.serviceOrderTimelineColumnProperty,
      label: 'Período',
      type: 'columnTemplate',
      width: '230px',
      sortable: false,
    },
    {
      property: this.serviceOrderCostColumnProperty,
      label: 'Custos',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.serviceOrderStatusColumnProperty,
      label: 'Status',
      type: 'columnTemplate',
      width: '220px',
      sortable: false,
    },
    {
      property: this.serviceOrderWorkflowColumnProperty,
      label: 'Workflow',
      type: 'columnTemplate',
      width: '260px',
      sortable: false,
    },
  ];

  vehicleOptions: PoComboOption[] = [];
  dashboardStats: MaintenanceStatsResponse | null = null;
  parkedVehiclesSnapshot: MaintenanceVehicleOption[] = [];
  parkedVehiclesTotal = 0;
  dashboardWorkflowCounts: MaintenanceDashboardWorkflowCounts = {
    open: 0,
    approved: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  };
  planResponse: MaintenancePlanListResponse | null = null;
  planTableItems: MaintenancePlanTableItem[] = [];
  serviceOrderResponse: ServiceOrderListResponse | null = null;
  serviceOrderTableItems: ServiceOrderTableItem[] = [];
  isLoadingDashboard = false;
  isLoadingPlans = false;
  isLoadingServiceOrders = false;
  isLoadingOptions = false;
  updatingServiceOrderId: string | null = null;
  currentPlanPage = 1;
  currentServiceOrderPage = 1;
  readonly planPageSize = 10;
  readonly serviceOrderPageSize = 10;

  constructor() {
    this.loadVehicleOptions();
    this.loadDashboard();
    this.loadPlans();
    this.loadServiceOrders();
  }

  protected get pageActions(): PoPageAction[] {
    const actions: PoPageAction[] = [];

    if (this.canManageServiceOrderWorkflow) {
      actions.push({
        label: 'Nova OS',
        icon: 'an an-plus',
        action: () => {
          void this.router.navigate(['/maintenance/service-orders/new']);
        },
      });
    }

    actions.push({
      label: 'Atualizar',
      icon: 'an an-arrows-clockwise',
      disabled: this.isLoadingDashboard || this.isLoadingPlans || this.isLoadingServiceOrders,
      action: () => {
        this.reloadCurrentPage();
      },
    });

    return actions;
  }

  protected get activePlanFiltersCount(): number {
    const raw = this.planFiltersForm.getRawValue();

    return [
      raw.search?.trim(),
      raw.vehicleId,
      raw.type,
      raw.activity && raw.activity !== 'active' ? raw.activity : null,
    ].filter(Boolean).length;
  }

  protected get activeServiceOrderFiltersCount(): number {
    const raw = this.serviceOrderFiltersForm.getRawValue();

    return [raw.vehicleId, raw.status, raw.dateFrom, raw.dateTo].filter(Boolean).length;
  }

  protected get serviceOrderWorkflowRoleLabel(): string {
    return 'workflow disponível para OWNER, ADMIN e MANAGER';
  }

  protected get maintenanceCostLabel(): string {
    return formatMaintenanceCurrency(this.dashboardStats?.costs.summary.totalCost ?? 0);
  }

  protected get averageOrderCostLabel(): string {
    return formatMaintenanceCurrency(this.dashboardStats?.costs.summary.averageOrderCost ?? 0);
  }

  protected get openServiceOrdersCount(): number {
    return (
      this.dashboardWorkflowCounts.open +
      this.dashboardWorkflowCounts.approved +
      this.dashboardWorkflowCounts.inProgress
    );
  }

  protected get closedServiceOrdersCount(): number {
    return this.dashboardWorkflowCounts.completed + this.dashboardWorkflowCounts.cancelled;
  }

  protected get parkedVehiclesCount(): number {
    return this.parkedVehiclesTotal;
  }

  protected get maintenanceDowntimeLabel(): string {
    const hours = this.dashboardStats?.reliability.summary.totalDowntimeHours ?? 0;
    return `${hours.toLocaleString('pt-BR')} h acumuladas`;
  }

  protected get dashboardCostCategories(): string[] {
    return this.dashboardStats?.costs.byPeriod.map((item) => item.label) ?? [];
  }

  protected get dashboardCostSeries(): PoChartSerie[] {
    const series = this.dashboardStats?.costs.byPeriod ?? [];

    return [
      {
        label: 'Preventiva',
        data: series.map((item) => item.preventiveCost),
        color: '#027a48',
      },
      {
        label: 'Corretiva',
        data: series.map((item) => item.correctiveCost),
        color: '#c75000',
      },
      {
        label: 'Preditiva',
        data: series.map((item) => item.predictiveCost),
        color: '#155eef',
      },
    ];
  }

  protected get hasDashboardCostData(): boolean {
    return Boolean(this.dashboardStats?.costs.byPeriod.some((item) => item.totalCost > 0));
  }

  protected get dashboardWorkflowSeries(): PoChartSerie[] {
    return [
      {
        label: 'Abertas',
        data: this.openServiceOrdersCount,
        color: '#b54708',
      },
      {
        label: 'Fechadas',
        data: this.closedServiceOrdersCount,
        color: '#027a48',
      },
    ].filter((item) => (item.data as number) > 0);
  }

  protected get dashboardWorkflowChartOptions(): PoChartOptions {
    return {
      innerRadius: 70,
      legend: true,
      legendPosition: 'right',
      legendVerticalPosition: 'top',
      textCenterGraph: `${this.openServiceOrdersCount + this.closedServiceOrdersCount} OS`,
      descriptionChart: 'Comparativo entre ordens de serviço abertas e fechadas.',
      rendererOption: 'svg',
    };
  }

  protected get workflowStatusBreakdown(): Array<{ label: string; value: number }> {
    return [
      { label: 'Abertas', value: this.dashboardWorkflowCounts.open },
      { label: 'Aprovadas', value: this.dashboardWorkflowCounts.approved },
      { label: 'Em execução', value: this.dashboardWorkflowCounts.inProgress },
      { label: 'Concluídas', value: this.dashboardWorkflowCounts.completed },
      { label: 'Canceladas', value: this.dashboardWorkflowCounts.cancelled },
    ];
  }

  protected get parkedVehicles(): MaintenanceVehicleOption[] {
    return this.parkedVehiclesSnapshot;
  }

  protected get serviceOrderRowActions(): PoTableAction[] {
    if (!this.canManageServiceOrderWorkflow) {
      return [];
    }

    return [
      {
        label: 'Editar',
        action: (item: ServiceOrderTableItem) => {
          void this.router.navigate(['/maintenance/service-orders', item.id, 'edit']);
        },
      },
    ];
  }

  protected get topMaintenanceVehicles(): MaintenanceDashboardTopVehicle[] {
    return (
      this.dashboardStats?.costs.byVehicle.slice(0, 5).map((item) => ({
        id: item.vehicle.id,
        title: item.vehicle.plate,
        subtitle: `${item.vehicle.brand} ${item.vehicle.model} • ${item.totalOrders} OS`,
        totalCost: formatMaintenanceCurrency(item.totalCost),
        totalOrders: item.totalOrders,
      })) ?? []
    );
  }

  protected get totalPlansOnPage(): number {
    return this.planTableItems.length;
  }

  protected get healthyPlansCount(): number {
    return this.planTableItems.filter((item) => item.planStatusCell.status === 'healthy').length;
  }

  protected get upcomingPlansCount(): number {
    return this.planTableItems.filter((item) => item.planStatusCell.status === 'upcoming').length;
  }

  protected get overduePlansCount(): number {
    return this.planTableItems.filter((item) => item.planStatusCell.status === 'overdue').length;
  }

  protected get activePlansCount(): number {
    return this.planTableItems.filter((item) => item.isActive).length;
  }

  protected get coverageRateLabel(): string {
    if (this.activePlansCount === 0) {
      return 'Sem planos ativos na página';
    }

    const rate = Math.round((this.healthyPlansCount / this.activePlansCount) * 100);
    return `${rate}% dos ativos em zona verde`;
  }

  protected get plansPaginationSummary(): string {
    if (!this.planResponse) {
      return 'Sem dados carregados.';
    }

    if (this.planResponse.meta.total === 0) {
      return 'Nenhum plano no recorte atual.';
    }

    return `Página ${this.planResponse.meta.page} de ${this.planResponse.meta.totalPages} • ${this.planResponse.meta.total} planos`;
  }

  protected get canGoBackPlans(): boolean {
    return this.currentPlanPage > 1 && !this.isLoadingPlans;
  }

  protected get canGoForwardPlans(): boolean {
    return Boolean(this.planResponse?.hasNext) && !this.isLoadingPlans;
  }

  protected get hasPlans(): boolean {
    return this.planTableItems.length > 0;
  }

  protected get totalServiceOrdersOnPage(): number {
    return this.serviceOrderTableItems.length;
  }

  protected get pendingServiceOrdersCount(): number {
    return this.serviceOrderTableItems.filter(
      (item) =>
        item.status === ServiceOrderStatus.OPEN || item.status === ServiceOrderStatus.APPROVED,
    ).length;
  }

  protected get inProgressServiceOrdersCount(): number {
    return this.serviceOrderTableItems.filter(
      (item) => item.status === ServiceOrderStatus.IN_PROGRESS,
    ).length;
  }

  protected get completedServiceOrdersCount(): number {
    return this.serviceOrderTableItems.filter(
      (item) => item.status === ServiceOrderStatus.COMPLETED,
    ).length;
  }

  protected get cancelledServiceOrdersCount(): number {
    return this.serviceOrderTableItems.filter(
      (item) => item.status === ServiceOrderStatus.CANCELLED,
    ).length;
  }

  protected get serviceOrderCostSummary(): string {
    return formatMaintenanceCurrency(
      this.serviceOrderTableItems.reduce((total, item) => total + item.totalCost, 0),
    );
  }

  protected get serviceOrderCostHelper(): string {
    return `${this.completedServiceOrdersCount} concluídas • ${this.cancelledServiceOrdersCount} canceladas`;
  }

  protected get serviceOrdersPaginationSummary(): string {
    if (!this.serviceOrderResponse) {
      return 'Sem dados carregados.';
    }

    if (this.serviceOrderResponse.meta.total === 0) {
      return 'Nenhuma OS no recorte atual.';
    }

    return `Página ${this.serviceOrderResponse.meta.page} de ${this.serviceOrderResponse.meta.totalPages} • ${this.serviceOrderResponse.meta.total} ordens de serviço`;
  }

  protected get canGoBackServiceOrders(): boolean {
    return this.currentServiceOrderPage > 1 && !this.isLoadingServiceOrders;
  }

  protected get canGoForwardServiceOrders(): boolean {
    return Boolean(this.serviceOrderResponse?.hasNext) && !this.isLoadingServiceOrders;
  }

  protected get hasServiceOrders(): boolean {
    return this.serviceOrderTableItems.length > 0;
  }

  protected get canManageServiceOrderWorkflow(): boolean {
    return this.authService.hasAnyRole(SERVICE_ORDER_WORKFLOW_ROLES);
  }

  protected applyPlanFilters(): void {
    this.loadPlans(1);
  }

  protected clearPlanFilters(): void {
    this.planFiltersForm.reset({
      search: '',
      vehicleId: '',
      type: null,
      activity: 'active',
    });
    this.loadPlans(1);
  }

  protected applyServiceOrderFilters(): void {
    this.loadServiceOrders(1, true);
  }

  protected clearServiceOrderFilters(): void {
    this.serviceOrderFiltersForm.reset({
      vehicleId: '',
      status: '',
      dateFrom: null,
      dateTo: null,
    });
    this.loadServiceOrders(1);
  }

  protected previousPlansPage(): void {
    if (!this.canGoBackPlans) {
      return;
    }

    this.loadPlans(this.currentPlanPage - 1);
  }

  protected nextPlansPage(): void {
    if (!this.canGoForwardPlans) {
      return;
    }

    this.loadPlans(this.currentPlanPage + 1);
  }

  protected previousServiceOrdersPage(): void {
    if (!this.canGoBackServiceOrders) {
      return;
    }

    this.loadServiceOrders(this.currentServiceOrderPage - 1, true);
  }

  protected nextServiceOrdersPage(): void {
    if (!this.canGoForwardServiceOrders) {
      return;
    }

    this.loadServiceOrders(this.currentServiceOrderPage + 1, true);
  }

  protected executeServiceOrderWorkflowAction(
    order: ServiceOrderRecord,
    nextStatus: ServiceOrderStatus,
  ): void {
    if (!this.canManageServiceOrderWorkflow || this.updatingServiceOrderId) {
      return;
    }

    if (
      nextStatus === ServiceOrderStatus.CANCELLED &&
      !globalThis.confirm('Cancelar esta ordem de serviço? Essa transição encerra o workflow.')
    ) {
      return;
    }

    this.updatingServiceOrderId = order.id;

    this.maintenanceService
      .updateServiceOrderStatus(order, nextStatus)
      .pipe(
        finalize(() => {
          this.updatingServiceOrderId = null;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success(this.getWorkflowSuccessMessage(nextStatus));
          this.reloadCurrentPage();
        },
        error: () => {
          this.notificationService.error(
            'Não foi possível atualizar o workflow da ordem de serviço.',
          );
        },
      });
  }

  protected isUpdatingServiceOrder(orderId: string): boolean {
    return this.updatingServiceOrderId === orderId;
  }

  private reloadCurrentPage(): void {
    this.loadDashboard();
    this.loadPlans(this.currentPlanPage);
    this.loadServiceOrders(this.currentServiceOrderPage, true);
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
            'Não foi possível carregar os veículos para os filtros de manutenção.',
          );
        },
      });
  }

  private loadDashboard(): void {
    this.isLoadingDashboard = true;

    forkJoin({
      stats: this.maintenanceService.getStats(),
      openOrders: this.maintenanceService.listServiceOrders(
        { status: ServiceOrderStatus.OPEN },
        1,
        1,
      ),
      approvedOrders: this.maintenanceService.listServiceOrders(
        { status: ServiceOrderStatus.APPROVED },
        1,
        1,
      ),
      inProgressOrders: this.maintenanceService.listServiceOrdersAll({
        status: ServiceOrderStatus.IN_PROGRESS,
      }),
      completedOrders: this.maintenanceService.listServiceOrders(
        { status: ServiceOrderStatus.COMPLETED },
        1,
        1,
      ),
      cancelledOrders: this.maintenanceService.listServiceOrders(
        { status: ServiceOrderStatus.CANCELLED },
        1,
        1,
      ),
    })
      .pipe(
        finalize(() => {
          this.isLoadingDashboard = false;
        }),
      )
      .subscribe({
        next: ({
          stats,
          openOrders,
          approvedOrders,
          inProgressOrders,
          completedOrders,
          cancelledOrders,
        }) => {
          const uniqueParkedVehicles = Array.from(
            inProgressOrders.reduce<Map<string, MaintenanceVehicleOption>>((acc, order) => {
              if (!acc.has(order.vehicle.id)) {
                acc.set(order.vehicle.id, order.vehicle);
              }

              return acc;
            }, new Map()),
          )
            .map(([, vehicle]) => vehicle)
            .sort((left, right) => left.plate.localeCompare(right.plate, 'pt-BR'));

          this.dashboardStats = stats;
          this.dashboardWorkflowCounts = {
            open: openOrders.meta.total,
            approved: approvedOrders.meta.total,
            inProgress: inProgressOrders.length,
            completed: completedOrders.meta.total,
            cancelled: cancelledOrders.meta.total,
          };
          this.parkedVehiclesSnapshot = uniqueParkedVehicles.slice(0, 5);
          this.parkedVehiclesTotal = uniqueParkedVehicles.length;
        },
        error: () => {
          this.dashboardStats = null;
          this.dashboardWorkflowCounts = {
            open: 0,
            approved: 0,
            inProgress: 0,
            completed: 0,
            cancelled: 0,
          };
          this.parkedVehiclesSnapshot = [];
          this.parkedVehiclesTotal = 0;
          this.notificationService.warning('Não foi possível carregar o dashboard de manutenção.');
        },
      });
  }

  private loadPlans(page = this.currentPlanPage): void {
    this.isLoadingPlans = true;
    const filters = this.getPlanFilters();

    this.maintenanceService
      .listPlans(filters, page, this.planPageSize)
      .pipe(
        finalize(() => {
          this.isLoadingPlans = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.planResponse = response;
          this.currentPlanPage = response.meta.page;
          this.planTableItems = response.items.map((item) => this.toPlanTableItem(item));
        },
        error: () => {
          this.planResponse = createEmptyPlanResponse(page, this.planPageSize);
          this.planTableItems = [];
          this.notificationService.error('Não foi possível carregar os planos de manutenção.');
        },
      });
  }

  private loadServiceOrders(page = this.currentServiceOrderPage, showInvalidWarning = false): void {
    if (this.hasInvalidServiceOrderDateRange(showInvalidWarning)) {
      return;
    }

    this.isLoadingServiceOrders = true;
    const filters = this.getServiceOrderFilters();

    this.maintenanceService
      .listServiceOrders(filters, page, this.serviceOrderPageSize)
      .pipe(
        finalize(() => {
          this.isLoadingServiceOrders = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.serviceOrderResponse = response;
          this.currentServiceOrderPage = response.meta.page;
          this.serviceOrderTableItems = response.items.map((item) =>
            this.toServiceOrderTableItem(item),
          );
        },
        error: () => {
          this.serviceOrderResponse = createEmptyServiceOrderResponse(
            page,
            this.serviceOrderPageSize,
          );
          this.serviceOrderTableItems = [];
          this.notificationService.error('Não foi possível carregar as ordens de serviço.');
        },
      });
  }

  private hasInvalidServiceOrderDateRange(showWarning: boolean): boolean {
    const raw = this.serviceOrderFiltersForm.getRawValue();

    if (!raw.dateFrom || !raw.dateTo || raw.dateFrom <= raw.dateTo) {
      return false;
    }

    if (showWarning) {
      this.notificationService.warning(
        'Período inválido. A data final precisa ser igual ou posterior à data inicial.',
      );
    }

    return true;
  }

  private getPlanFilters(): MaintenancePlanListFilters {
    const raw = this.planFiltersForm.getRawValue();

    return {
      ...(raw.search?.trim() ? { search: raw.search.trim() } : {}),
      ...(raw.vehicleId ? { vehicleId: raw.vehicleId } : {}),
      ...(raw.type ? { type: raw.type } : {}),
      ...(raw.activity ? { activity: raw.activity as MaintenancePlanActivityFilter } : {}),
    };
  }

  private getServiceOrderFilters(): ServiceOrderListFilters {
    const raw = this.serviceOrderFiltersForm.getRawValue();

    return {
      ...(raw.vehicleId ? { vehicleId: raw.vehicleId } : {}),
      ...(raw.status ? { status: raw.status as ServiceOrderStatus } : {}),
      ...(raw.dateFrom ? { dateFrom: raw.dateFrom } : {}),
      ...(raw.dateTo ? { dateTo: raw.dateTo } : {}),
    };
  }

  private toPlanTableItem(plan: MaintenancePlanRecord): MaintenancePlanTableItem {
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
      planVehicleCell: {
        title: plan.vehicle.plate,
        subtitle: `${plan.vehicle.brand} ${plan.vehicle.model} • ${plan.vehicle.year}`,
      },
      planScheduleCell: {
        primary: formatMaintenanceInterval(plan),
        secondary: formatLastExecution(plan),
      },
      planNextDueCell: nextDue,
      planStatusCell: {
        label: getMaintenanceStatusLabel(status),
        helper: getMaintenanceStatusHelper(plan, status),
        type: this.getPlanStatusTagType(status),
        status,
      },
    };
  }

  private toServiceOrderTableItem(order: ServiceOrderRecord): ServiceOrderTableItem {
    const actions = this.getServiceOrderWorkflowActions(order.status);
    const canManage = this.canManageServiceOrderWorkflow;

    return {
      ...order,
      serviceOrderCell: {
        title: order.description,
        subtitle: `${formatMaintenanceType(order.type)} • ${order.workshop ?? 'Oficina não informada'}`,
        helper: formatServiceOrderContext(order),
        status: order.status,
      },
      serviceOrderVehicleCell: {
        title: order.vehicle.plate,
        subtitle: `${order.vehicle.brand} ${order.vehicle.model} • ${order.vehicle.year}`,
      },
      serviceOrderTimelineCell: formatServiceOrderTimeline(order),
      serviceOrderCostCell: {
        primary: formatMaintenanceCurrency(order.totalCost),
        secondary: formatServiceOrderCostHelper(order),
      },
      serviceOrderStatusCell: {
        label: formatServiceOrderStatus(order.status),
        helper: this.getServiceOrderStatusHelper(order),
        type: this.getServiceOrderStatusTagType(order.status),
      },
      serviceOrderWorkflowCell: {
        order,
        actions,
        canManage,
        helper: this.getServiceOrderWorkflowHelper(order.status, canManage),
      },
    };
  }

  private getServiceOrderWorkflowActions(status: ServiceOrderStatus): ServiceOrderWorkflowAction[] {
    switch (status) {
      case ServiceOrderStatus.OPEN:
        return [
          {
            label: 'Aprovar',
            nextStatus: ServiceOrderStatus.APPROVED,
            kind: 'primary',
          },
          {
            label: 'Cancelar',
            nextStatus: ServiceOrderStatus.CANCELLED,
            kind: 'secondary',
          },
        ];
      case ServiceOrderStatus.APPROVED:
        return [
          {
            label: 'Iniciar execução',
            nextStatus: ServiceOrderStatus.IN_PROGRESS,
            kind: 'primary',
          },
        ];
      case ServiceOrderStatus.IN_PROGRESS:
        return [
          {
            label: 'Concluir',
            nextStatus: ServiceOrderStatus.COMPLETED,
            kind: 'primary',
          },
        ];
      case ServiceOrderStatus.COMPLETED:
      case ServiceOrderStatus.CANCELLED:
      default:
        return [];
    }
  }

  private getServiceOrderWorkflowHelper(status: ServiceOrderStatus, canManage: boolean): string {
    if (!canManage) {
      return 'Somente perfis gestores podem avançar o fluxo.';
    }

    switch (status) {
      case ServiceOrderStatus.OPEN:
        return 'Aprove ou cancele a OS antes da execução.';
      case ServiceOrderStatus.APPROVED:
        return 'A próxima etapa é iniciar a execução.';
      case ServiceOrderStatus.IN_PROGRESS:
        return 'Finalize a execução para concluir a OS.';
      case ServiceOrderStatus.COMPLETED:
        return 'Fluxo encerrado com execução concluída.';
      case ServiceOrderStatus.CANCELLED:
        return 'Fluxo encerrado sem execução.';
      default:
        return 'Sem ações disponíveis.';
    }
  }

  private getWorkflowSuccessMessage(status: ServiceOrderStatus): string {
    switch (status) {
      case ServiceOrderStatus.APPROVED:
        return 'Ordem de serviço aprovada com sucesso.';
      case ServiceOrderStatus.IN_PROGRESS:
        return 'Execução iniciada com sucesso.';
      case ServiceOrderStatus.COMPLETED:
        return 'Ordem de serviço concluída com sucesso.';
      case ServiceOrderStatus.CANCELLED:
        return 'Ordem de serviço cancelada com sucesso.';
      default:
        return 'Workflow atualizado com sucesso.';
    }
  }

  private getPlanStatusTagType(status: MaintenancePlanVisualStatus): PoTagType {
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

  private getServiceOrderStatusHelper(order: ServiceOrderRecord): string {
    switch (order.status) {
      case ServiceOrderStatus.OPEN:
        return 'Aguardando aprovação para seguir à execução.';
      case ServiceOrderStatus.APPROVED:
        return order.approvedByUser?.name
          ? `Aprovada por ${order.approvedByUser.name}`
          : 'Aprovada e pronta para iniciar.';
      case ServiceOrderStatus.IN_PROGRESS:
        return order.startDate
          ? `Em execução desde ${formatMaintenanceDate(order.startDate)}`
          : 'Execução registrada sem data de início.';
      case ServiceOrderStatus.COMPLETED:
        return order.endDate
          ? `Concluída em ${formatMaintenanceDate(order.endDate)}`
          : 'OS concluída.';
      case ServiceOrderStatus.CANCELLED:
        return 'Fluxo encerrado antes da conclusão.';
      default:
        return 'Status não identificado.';
    }
  }

  private getServiceOrderStatusTagType(status: ServiceOrderStatus): PoTagType {
    switch (status) {
      case ServiceOrderStatus.OPEN:
        return PoTagType.Neutral;
      case ServiceOrderStatus.APPROVED:
        return PoTagType.Info;
      case ServiceOrderStatus.IN_PROGRESS:
        return PoTagType.Warning;
      case ServiceOrderStatus.COMPLETED:
        return PoTagType.Success;
      case ServiceOrderStatus.CANCELLED:
        return PoTagType.Danger;
      default:
        return PoTagType.Neutral;
    }
  }
}
