import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { PoBreadcrumb } from '@po-ui/ng-components';
import { PoTagType } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import {
  FUEL_TYPE_LABELS,
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_TAG_TYPES,
} from '../../vehicles.constants';
import { VehiclesService } from '../../vehicles.service';
import type { VehicleDetail } from '../../vehicles.types';
import {
  formatFuelType,
  formatVehicleCurrency,
  formatVehicleDate,
  formatVehicleDateTime,
  formatVehicleKilometers,
  formatVehiclePlate,
  getTimelineActionLabel,
  getTimelineChangeSummary,
} from '../../vehicles.utils';

import {
  PoPageModule,
  PoWidgetModule,
  PoTagModule,
  PoTabsModule,
  PoInfoModule,
  PoDividerModule,
} from '@po-ui/ng-components';

@Component({
  selector: 'app-vehicle-detail-page',
  imports: [PoPageModule, PoWidgetModule, PoTagModule, PoTabsModule, PoInfoModule, PoDividerModule],
  templateUrl: './vehicle-detail-page.html',
  styleUrl: './vehicle-detail-page.scss',
})
export class VehicleDetailPage {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehiclesService = inject(VehiclesService);

  vehicle: VehicleDetail | null = null;
  isLoading = false;

  constructor() {
    this.loadVehicle();
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Veículos', link: '/vehicles' },
        {
          label: this.vehicle ? formatVehiclePlate(this.vehicle.plate) : 'Detalhes',
          link: this.vehicle ? `/vehicles/${this.vehicle.id}` : '/vehicles',
        },
      ],
    };
  }

  protected get title(): string {
    if (!this.vehicle) {
      return 'Detalhes do veículo';
    }

    return `${formatVehiclePlate(this.vehicle.plate)} • ${this.vehicle.brand} ${this.vehicle.model}`;
  }

  protected get subtitle(): string {
    if (!this.vehicle) {
      return 'Visão operacional do cadastro e do histórico do veículo.';
    }

    return `${VEHICLE_CATEGORY_LABELS[this.vehicle.category]} • ${FUEL_TYPE_LABELS[this.vehicle.fuelType]} • ${formatVehicleKilometers(this.vehicle.currentMileage)}`;
  }

  protected get statusType(): PoTagType {
    if (!this.vehicle) {
      return PoTagType.Info;
    }

    return VEHICLE_STATUS_TAG_TYPES[this.vehicle.status];
  }

  goBack(): void {
    void this.router.navigate(['/vehicles']);
  }

  editVehicle(): void {
    if (!this.vehicle) {
      return;
    }

    void this.router.navigate(['/vehicles', this.vehicle.id, 'edit']);
  }

  formatPlate(value: string): string {
    return formatVehiclePlate(value);
  }

  formatMileage(value: number | null | undefined): string {
    return formatVehicleKilometers(value);
  }

  formatCurrency(value: number | null | undefined): string {
    return formatVehicleCurrency(value);
  }

  formatDate(value: string | null | undefined): string {
    return formatVehicleDate(value);
  }

  formatDateTime(value: string | null | undefined): string {
    return formatVehicleDateTime(value);
  }

  formatFuel(value: keyof typeof FUEL_TYPE_LABELS): string {
    return formatFuelType(value);
  }

  getStatusLabel(status: keyof typeof VEHICLE_STATUS_LABELS): string {
    return VEHICLE_STATUS_LABELS[status];
  }

  getCategoryLabel(category: keyof typeof VEHICLE_CATEGORY_LABELS): string {
    return VEHICLE_CATEGORY_LABELS[category];
  }

  getTimelineAction(action: string): string {
    return getTimelineActionLabel(action);
  }

  getTimelineSummary(item: VehicleDetail['timeline'][number]): string {
    return getTimelineChangeSummary(item);
  }

  private loadVehicle(): void {
    const vehicleId = this.activatedRoute.snapshot.paramMap.get('id');

    if (!vehicleId) {
      void this.router.navigate(['/vehicles']);
      return;
    }

    this.isLoading = true;

    this.vehiclesService
      .getById(vehicleId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.vehicle = vehicle;
        },
      });
  }
}
