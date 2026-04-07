import { Component, ViewChild, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  PoBreadcrumb,
  PoModalAction,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import { PoModalComponent } from '@po-ui/ng-components';
import { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { VehicleImportModal } from '../../components/vehicle-import-modal/vehicle-import-modal';
import {
  FUEL_TYPE_OPTIONS,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_CATEGORY_TABLE_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_STATUS_TABLE_LABELS,
} from '../../vehicles.constants';
import { VehiclesService } from '../../vehicles.service';
import type {
  VehicleListFilters,
  VehicleListItem,
  VehicleStatsResponse,
} from '../../vehicles.types';
import { downloadBlob, formatVehicleKilometers, formatVehiclePlate } from '../../vehicles.utils';

function createEmptyStats(): VehicleStatsResponse {
  return {
    total: 0,
    byStatus: {
      [VehicleStatus.ACTIVE]: 0,
      [VehicleStatus.MAINTENANCE]: 0,
      [VehicleStatus.RESERVE]: 0,
      [VehicleStatus.DECOMMISSIONED]: 0,
      [VehicleStatus.INCIDENT]: 0,
    },
    byCategory: {
      [VehicleCategory.LIGHT]: 0,
      [VehicleCategory.HEAVY]: 0,
      [VehicleCategory.MOTORCYCLE]: 0,
      [VehicleCategory.MACHINE]: 0,
      [VehicleCategory.BUS]: 0,
    },
    byFuelType: {
      [FuelType.GASOLINE]: 0,
      [FuelType.ETHANOL]: 0,
      [FuelType.DIESEL]: 0,
      [FuelType.DIESEL_S10]: 0,
      [FuelType.GNV]: 0,
      [FuelType.ELECTRIC]: 0,
      [FuelType.HYBRID]: 0,
    },
    averageFleetAge: 0,
    averageMileage: 0,
  };
}

@Component({
  selector: 'app-vehicles-page',
  standalone: false,
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.scss',
})
export class VehiclesPage {
  @ViewChild('statusModal', { static: true }) private readonly statusModal?: PoModalComponent;
  @ViewChild(VehicleImportModal, { static: true })
  private readonly importModal?: VehicleImportModal;

  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly notificationService = inject(NotificationService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Veículos', link: '/vehicles' },
    ],
  };

  readonly filterForm = this.formBuilder.group({
    search: [''],
    status: [null as VehicleStatus | null],
    category: [null as VehicleCategory | null],
    fuelType: [null as FuelType | null],
  });

  readonly statusForm = this.formBuilder.nonNullable.group({
    status: [VehicleStatus.ACTIVE],
  });

  readonly statusOptions = VEHICLE_STATUS_OPTIONS;
  readonly categoryOptions = VEHICLE_CATEGORY_OPTIONS;
  readonly fuelTypeOptions = FUEL_TYPE_OPTIONS;
  readonly plateColumnProperty = 'plate';
  readonly mileageColumnProperty = 'currentMileage';
  readonly columns: PoTableColumn[] = [
    {
      property: 'plate',
      label: 'Placa',
      type: 'columnTemplate',
      width: '120px',
    },
    {
      property: 'brandModel',
      label: 'Marca / Modelo',
      width: '250px',
      sortable: false,
    },
    {
      property: 'yearModel',
      label: 'Ano',
      type: 'number',
      width: '90px',
    },
    {
      property: 'category',
      label: 'Categoria',
      type: 'label',
      labels: VEHICLE_CATEGORY_TABLE_LABELS,
      width: '120px',
      sortable: false,
    },
    {
      property: 'status',
      label: 'Status',
      type: 'label',
      labels: VEHICLE_STATUS_TABLE_LABELS,
      width: '140px',
      sortable: false,
    },
    {
      property: 'currentMileage',
      label: 'Km',
      type: 'columnTemplate',
      width: '130px',
    },
  ];

  readonly rowActions: PoTableAction[] = [
    {
      label: 'Ver detalhes',
      action: (vehicle: VehicleListItem) => {
        void this.router.navigate(['/vehicles', vehicle.id]);
      },
    },
    {
      label: 'Editar',
      action: (vehicle: VehicleListItem) => {
        void this.router.navigate(['/vehicles', vehicle.id, 'edit']);
      },
    },
    {
      label: 'Alterar status',
      action: (vehicle: VehicleListItem) => {
        this.openStatusModal(vehicle);
      },
    },
  ];

  serviceApiUrl = this.vehiclesService.getTableApiUrl({});
  stats = createEmptyStats();
  isLoadingStats = false;
  isExporting = false;
  isUpdatingStatus = false;
  selectedVehicle: VehicleListItem | null = null;
  refreshToken = 0;

  constructor() {
    this.loadStats();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Novo veículo',
        icon: 'an an-plus',
        action: () => {
          void this.router.navigate(['/vehicles/new']);
        },
      },
      {
        label: 'Importar',
        icon: 'an an-upload-simple',
        action: () => {
          this.openImportModal();
        },
      },
      {
        label: 'Exportar',
        icon: 'an an-download-simple',
        disabled: this.isExporting,
        action: () => {
          this.exportVehicles();
        },
      },
    ];
  }

  protected get activeFiltersCount(): number {
    const rawValue = this.filterForm.getRawValue();

    return [rawValue.search?.trim(), rawValue.status, rawValue.category, rawValue.fuelType].filter(
      Boolean,
    ).length;
  }

  protected get primaryStatusAction(): PoModalAction {
    return {
      label: this.isUpdatingStatus ? 'Salvando...' : 'Salvar status',
      disabled: this.isUpdatingStatus,
      action: () => {
        this.confirmStatusChange();
      },
    };
  }

  protected get secondaryStatusAction(): PoModalAction {
    return {
      label: 'Cancelar',
      disabled: this.isUpdatingStatus,
      action: () => {
        this.closeStatusModal();
      },
    };
  }

  protected get selectedVehicleStatusLabel(): string {
    if (!this.selectedVehicle) {
      return 'Não selecionado';
    }

    return VEHICLE_STATUS_LABELS[this.selectedVehicle.status];
  }

  applyFilters(): void {
    this.refreshTable();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: null,
      category: null,
      fuelType: null,
    });
    this.refreshTable();
  }

  handleImportCompleted(): void {
    this.refreshTable();
  }

  formatMileage(value: number): string {
    return formatVehicleKilometers(value);
  }

  formatPlate(value: string): string {
    return formatVehiclePlate(value);
  }

  openImportModal(): void {
    this.importModal?.open();
  }

  openStatusModal(vehicle: VehicleListItem): void {
    this.selectedVehicle = vehicle;
    this.statusForm.setValue({
      status: vehicle.status,
    });
    this.statusModal?.open();
  }

  closeStatusModal(): void {
    this.selectedVehicle = null;
    this.statusModal?.close();
  }

  private confirmStatusChange(): void {
    if (!this.selectedVehicle || this.statusForm.invalid || this.isUpdatingStatus) {
      return;
    }

    this.isUpdatingStatus = true;

    this.vehiclesService
      .updateStatus(this.selectedVehicle.id, this.statusForm.getRawValue().status)
      .pipe(
        finalize(() => {
          this.isUpdatingStatus = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Status do veículo atualizado.');
          this.closeStatusModal();
          this.refreshTable();
        },
      });
  }

  private exportVehicles(): void {
    if (this.isExporting) {
      return;
    }

    this.isExporting = true;

    this.vehiclesService
      .export(this.getFilters())
      .pipe(
        finalize(() => {
          this.isExporting = false;
        }),
      )
      .subscribe({
        next: (blob) => {
          downloadBlob(`veiculos-${new Date().toISOString().slice(0, 10)}.csv`, blob);
          this.notificationService.success('Exportação iniciada.');
        },
      });
  }

  private refreshTable(): void {
    this.refreshToken += 1;
    this.serviceApiUrl = this.vehiclesService.getTableApiUrl(this.getFilters(), this.refreshToken);
    this.loadStats();
  }

  private loadStats(): void {
    this.isLoadingStats = true;

    this.vehiclesService
      .getStats(this.getFilters())
      .pipe(
        finalize(() => {
          this.isLoadingStats = false;
        }),
      )
      .subscribe({
        next: (stats) => {
          this.stats = stats;
        },
      });
  }

  private getFilters(): VehicleListFilters {
    const rawValue = this.filterForm.getRawValue();

    return {
      search: rawValue.search?.trim() || undefined,
      status: rawValue.status ?? undefined,
      category: rawValue.category ?? undefined,
      fuelType: rawValue.fuelType ?? undefined,
    };
  }
}
