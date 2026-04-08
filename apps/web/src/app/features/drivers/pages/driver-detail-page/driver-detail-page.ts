import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PoBreadcrumb, PoComboOption } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoDividerModule,
  PoFieldModule,
  PoInfoModule,
  PoPageModule,
  PoTabsModule,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { DriversService } from '../../drivers.service';
import type { DriverDetail, DriverVehicleOption } from '../../drivers.types';
import {
  formatAssignedVehicle,
  formatAssignedVehicleStatus,
  formatDriverCpf,
  formatDriverDate,
  formatDriverDateTime,
  formatDriverPhone,
  getDriverAuditSummary,
  getDriverCnhMeta,
  getDriverScoreMeta,
  getDriverStatusMeta,
  getDriverTimelineActionLabel,
} from '../../drivers.utils';
import { formatPlate } from '@frota-leve/shared/src/utils/format.utils';

@Component({
  selector: 'app-driver-detail-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoTagModule,
    PoTabsModule,
    PoInfoModule,
    PoDividerModule,
    PoFieldModule,
    PoButtonModule,
  ],
  templateUrl: './driver-detail-page.html',
  styleUrl: './driver-detail-page.scss',
})
export class DriverDetailPage {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly driversService = inject(DriversService);
  private readonly notificationService = inject(NotificationService);

  readonly linkForm = this.formBuilder.nonNullable.group({
    vehicleId: [''],
  });

  driver: DriverDetail | null = null;
  vehicleOptions: PoComboOption[] = [];
  isLoading = false;
  isLinkingVehicle = false;
  isLoadingVehicles = false;

  constructor() {
    this.loadDriver();
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Motoristas', link: '/drivers' },
        {
          label: this.driver?.name ?? 'Detalhes',
          link: this.driver ? `/drivers/${this.driver.id}` : '/drivers',
        },
      ],
    };
  }

  protected get title(): string {
    return this.driver ? this.driver.name : 'Ficha do motorista';
  }

  protected get subtitle(): string {
    if (!this.driver) {
      return 'Visão operacional do cadastro, score e vínculos do condutor.';
    }

    return `${formatDriverCpf(this.driver.cpf)} • ${this.driver.department ?? 'Sem departamento'} • ${this.scoreMeta.helper}`;
  }

  protected get statusMeta() {
    return getDriverStatusMeta(this.driver?.isActive ?? false);
  }

  protected get cnhMeta() {
    return getDriverCnhMeta(this.driver?.cnhExpiration);
  }

  protected get scoreMeta() {
    return getDriverScoreMeta(this.driver?.score);
  }

  protected get canLinkVehicle(): boolean {
    return Boolean(
      this.driver?.userId && this.linkForm.controls.vehicleId.value && !this.isLinkingVehicle,
    );
  }

  goBack(): void {
    void this.router.navigate(['/drivers']);
  }

  editDriver(): void {
    if (!this.driver) {
      return;
    }

    void this.router.navigate(['/drivers', this.driver.id, 'edit']);
  }

  linkVehicle(): void {
    if (!this.driver || !this.canLinkVehicle) {
      return;
    }

    this.isLinkingVehicle = true;

    this.driversService
      .linkVehicle(this.driver.id, this.linkForm.controls.vehicleId.value)
      .pipe(
        finalize(() => {
          this.isLinkingVehicle = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Veículo vinculado ao motorista.');
          this.linkForm.reset({
            vehicleId: '',
          });
          this.loadDriver();
        },
      });
  }

  formatCpf(value: string | null | undefined): string {
    return formatDriverCpf(value);
  }

  formatPhone(value: string | null | undefined): string {
    return formatDriverPhone(value);
  }

  formatDate(value: string | null | undefined): string {
    return formatDriverDate(value);
  }

  formatDateTime(value: string | null | undefined): string {
    return formatDriverDateTime(value);
  }

  formatVehicleLabel(vehicle: DriverDetail['history']['assignedVehicles'][number]): string {
    return formatAssignedVehicle(vehicle);
  }

  formatVehicleStatus(status: string): string {
    return formatAssignedVehicleStatus(status);
  }

  getTimelineAction(action: string): string {
    return getDriverTimelineActionLabel(action);
  }

  getTimelineSummary(entry: DriverDetail['history']['auditLog'][number]): string {
    return getDriverAuditSummary(entry);
  }

  private loadDriver(): void {
    const driverId = this.activatedRoute.snapshot.paramMap.get('id');

    if (!driverId) {
      void this.router.navigate(['/drivers']);
      return;
    }

    this.isLoading = true;

    this.driversService
      .getById(driverId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (driver) => {
          this.driver = driver;
          this.loadVehicleOptions(driver.history.assignedVehicles.map((vehicle) => vehicle.id));
        },
      });
  }

  private loadVehicleOptions(excludedVehicleIds: string[]): void {
    this.isLoadingVehicles = true;

    this.driversService
      .listVehicleOptions()
      .pipe(
        finalize(() => {
          this.isLoadingVehicles = false;
        }),
      )
      .subscribe({
        next: (vehicles) => {
          this.vehicleOptions = vehicles
            .filter((vehicle) => !excludedVehicleIds.includes(vehicle.id))
            .map((vehicle) => this.toVehicleOption(vehicle));
        },
      });
  }

  private toVehicleOption(vehicle: DriverVehicleOption): PoComboOption {
    return {
      value: vehicle.id,
      label: `${formatPlate(vehicle.plate)} • ${vehicle.brand} ${vehicle.model}`,
    };
  }
}
