import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  PoBreadcrumb,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoFieldModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import type { PoTagType } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { DRIVER_CNH_ALERT_OPTIONS, DRIVER_STATUS_FILTER_OPTIONS } from '../../drivers.constants';
import { DriversService } from '../../drivers.service';
import type { DriverListItem, DriverListResponse } from '../../drivers.types';
import {
  formatDriverCpf,
  formatDriverDate,
  formatDriverPhone,
  getDriverCnhMeta,
  getDriverCnhState,
  getDriverScoreMeta,
  getDriverStatusMeta,
} from '../../drivers.utils';

type DriverIdentityCell = {
  name: string;
  email: string;
};

type DriverCnhCell = {
  category: string;
  expirationLabel: string;
  badgeLabel: string;
  badgeType: PoTagType;
};

type DriverScoreCell = {
  value: string;
  badgeLabel: string;
  badgeType: PoTagType;
};

type DriverStatusCell = {
  badgeLabel: string;
  badgeType: PoTagType;
};

type DriverTableItem = DriverListItem & {
  identityCell: DriverIdentityCell;
  cpfDisplay: string;
  phoneDisplay: string;
  departmentDisplay: string;
  cnhCell: DriverCnhCell;
  scoreCell: DriverScoreCell;
  statusCell: DriverStatusCell;
};

@Component({
  selector: 'app-drivers-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoFieldModule,
    PoButtonModule,
    PoTableModule,
    PoTagModule,
  ],
  templateUrl: './drivers-page.html',
  styleUrl: './drivers-page.scss',
})
export class DriversPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly driversService = inject(DriversService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Motoristas', link: '/drivers' },
    ],
  };

  readonly filterForm = this.formBuilder.group({
    search: [''],
    department: [''],
    status: [null as 'active' | 'inactive' | null],
    cnhAlert: [null as 'alert' | null],
  });

  readonly statusOptions = DRIVER_STATUS_FILTER_OPTIONS;
  readonly cnhAlertOptions = DRIVER_CNH_ALERT_OPTIONS;
  readonly identityColumnProperty = 'identityCell';
  readonly cnhColumnProperty = 'cnhCell';
  readonly scoreColumnProperty = 'scoreCell';
  readonly statusColumnProperty = 'statusCell';
  readonly columns: PoTableColumn[] = [
    {
      property: this.identityColumnProperty,
      label: 'Nome',
      type: 'columnTemplate',
      width: '250px',
      sortable: false,
    },
    {
      property: 'cpfDisplay',
      label: 'CPF',
      width: '150px',
      sortable: false,
    },
    {
      property: this.cnhColumnProperty,
      label: 'CNH',
      type: 'columnTemplate',
      width: '240px',
      sortable: false,
    },
    {
      property: 'phoneDisplay',
      label: 'Telefone',
      width: '160px',
      sortable: false,
    },
    {
      property: 'departmentDisplay',
      label: 'Departamento',
      width: '170px',
      sortable: false,
    },
    {
      property: this.scoreColumnProperty,
      label: 'Score',
      type: 'columnTemplate',
      width: '140px',
      sortable: false,
    },
    {
      property: this.statusColumnProperty,
      label: 'Status',
      type: 'columnTemplate',
      width: '130px',
      sortable: false,
    },
  ];

  readonly rowActions: PoTableAction[] = [
    {
      label: 'Ver detalhes',
      action: (driver: DriverTableItem) => {
        void this.router.navigate(['/drivers', driver.id]);
      },
    },
    {
      label: 'Editar',
      action: (driver: DriverTableItem) => {
        void this.router.navigate(['/drivers', driver.id, 'edit']);
      },
    },
  ];

  tableItems: DriverTableItem[] = [];
  response: DriverListResponse | null = null;
  isLoading = false;
  currentPage = 1;
  readonly pageSize = 10;

  constructor() {
    this.loadDrivers();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Novo motorista',
        icon: 'an an-user-plus',
        action: () => {
          void this.router.navigate(['/drivers/new']);
        },
      },
    ];
  }

  protected get activeFiltersCount(): number {
    const raw = this.filterForm.getRawValue();

    return [raw.search?.trim(), raw.department?.trim(), raw.status, raw.cnhAlert].filter(Boolean)
      .length;
  }

  protected get totalDrivers(): number {
    return this.response?.meta.total ?? 0;
  }

  protected get activeDriversCount(): number {
    return this.tableItems.filter((driver) => driver.isActive).length;
  }

  protected get criticalCnhCount(): number {
    return this.tableItems.filter((driver) => {
      const state = getDriverCnhState(driver.cnhExpiration);
      return state === 'expired' || state === 'expiring';
    }).length;
  }

  protected get averageScore(): string {
    const scoredDrivers = this.tableItems.filter((driver) => driver.score != null);

    if (scoredDrivers.length === 0) {
      return 'Sem score';
    }

    const scoreAverage =
      scoredDrivers.reduce((sum, driver) => sum + Number(driver.score ?? 0), 0) /
      scoredDrivers.length;

    return `${scoreAverage.toFixed(1)} pts`;
  }

  protected get paginationSummary(): string {
    if (!this.response) {
      return 'Sem dados carregados.';
    }

    return `Página ${this.response.meta.page} de ${this.response.meta.totalPages} • ${this.response.meta.total} motoristas`;
  }

  protected get canGoBack(): boolean {
    return this.currentPage > 1 && !this.isLoading;
  }

  protected get canGoForward(): boolean {
    return Boolean(this.response?.hasNext) && !this.isLoading;
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadDrivers();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      department: '',
      status: null,
      cnhAlert: null,
    });
    this.currentPage = 1;
    this.loadDrivers();
  }

  previousPage(): void {
    if (!this.canGoBack) {
      return;
    }

    this.currentPage -= 1;
    this.loadDrivers();
  }

  nextPage(): void {
    if (!this.canGoForward) {
      return;
    }

    this.currentPage += 1;
    this.loadDrivers();
  }

  private loadDrivers(): void {
    const rawFilters = this.filterForm.getRawValue();

    this.isLoading = true;

    this.driversService
      .list(
        {
          search: rawFilters.search ?? '',
          department: rawFilters.department ?? '',
          isActive:
            rawFilters.status === 'active' ? true : rawFilters.status === 'inactive' ? false : null,
          cnhExpiring: rawFilters.cnhAlert === 'alert',
        },
        this.currentPage,
        this.pageSize,
      )
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.response = response;
          this.tableItems = response.items.map((driver) => this.toTableItem(driver));
        },
      });
  }

  private toTableItem(driver: DriverListItem): DriverTableItem {
    const cnhMeta = getDriverCnhMeta(driver.cnhExpiration);
    const scoreMeta = getDriverScoreMeta(driver.score);
    const statusMeta = getDriverStatusMeta(driver.isActive);

    return {
      ...driver,
      identityCell: {
        name: driver.name,
        email: driver.email ?? driver.user?.email ?? 'Sem e-mail informado',
      },
      cpfDisplay: formatDriverCpf(driver.cpf),
      phoneDisplay: formatDriverPhone(driver.phone),
      departmentDisplay: driver.department ?? 'Sem departamento',
      cnhCell: {
        category: driver.cnhCategory ? `Categoria ${driver.cnhCategory}` : 'Sem categoria',
        expirationLabel:
          driver.cnhExpiration != null
            ? `Validade ${formatDriverDate(driver.cnhExpiration)}`
            : 'Sem validade registrada',
        badgeLabel: cnhMeta.label,
        badgeType: cnhMeta.type,
      },
      scoreCell: {
        value: driver.score == null ? 'Sem score' : `${driver.score.toFixed(1)} / 100`,
        badgeLabel: scoreMeta.label,
        badgeType: scoreMeta.type,
      },
      statusCell: {
        badgeLabel: statusMeta.label,
        badgeType: statusMeta.type,
      },
    };
  }
}
