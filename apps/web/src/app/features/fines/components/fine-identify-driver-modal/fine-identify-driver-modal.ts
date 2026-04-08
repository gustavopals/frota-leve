import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';
import type { PoComboOption, PoModalAction } from '@po-ui/ng-components';
import { PoFieldModule, PoModalComponent, PoModalModule, PoTagModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { FinesService } from '../../fines.service';
import type { FineRecord } from '../../fines.types';
import { formatFineAmount, formatFineDate } from '../../fines.utils';

@Component({
  selector: 'app-fine-identify-driver-modal',
  imports: [ReactiveFormsModule, PoModalModule, PoFieldModule, PoTagModule],
  templateUrl: './fine-identify-driver-modal.html',
  styleUrl: './fine-identify-driver-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FineIdentifyDriverModal {
  readonly identified = output<void>();

  private readonly modal = viewChild.required<PoModalComponent>('identifyModal');
  private readonly formBuilder = inject(FormBuilder);
  private readonly finesService = inject(FinesService);
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  fine: FineRecord | null = null;
  driverOptions: PoComboOption[] = [];
  isLoadingDrivers = false;
  isSaving = false;

  readonly form = this.formBuilder.group({
    driverId: ['', Validators.required],
    detranDeliveryDate: [''],
  });

  protected get primaryAction(): PoModalAction {
    return {
      label: this.isSaving ? 'Salvando...' : 'Identificar condutor',
      disabled: this.isSaving || this.form.invalid,
      action: () => {
        this.submit();
      },
    };
  }

  protected get secondaryAction(): PoModalAction {
    return {
      label: 'Cancelar',
      disabled: this.isSaving,
      action: () => {
        this.close();
      },
    };
  }

  protected get fineAutoNumber(): string {
    return this.fine?.autoNumber ?? '—';
  }

  protected get fineVehicleLabel(): string {
    if (!this.fine) return '—';
    const v = this.fine.vehicle;
    return `${v.plate} — ${v.brand} ${v.model} (${v.year})`;
  }

  protected get fineDateLabel(): string {
    return this.fine ? formatFineDate(this.fine.date) : '—';
  }

  protected get fineAmountLabel(): string {
    return this.fine ? formatFineAmount(this.fine.amount) : '—';
  }

  protected get fineDueDateLabel(): string {
    return this.fine ? formatFineDate(this.fine.dueDate) : '—';
  }

  protected get selectedDriverName(): string {
    const driverId = this.form.value.driverId;
    if (!driverId) return '';
    const option = this.driverOptions.find((o) => o.value === driverId);
    return option ? String(option.label) : '';
  }

  open(fine: FineRecord): void {
    this.fine = fine;
    this.form.reset({ driverId: '', detranDeliveryDate: '' });
    this.loadDriverOptions();
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onDriverSearch(search: string): void {
    this.loadDriverOptions(search);
  }

  private loadDriverOptions(search = ''): void {
    this.isLoadingDrivers = true;
    this.cdr.markForCheck();

    this.finesService
      .listDriverOptions(search)
      .pipe(
        finalize(() => {
          this.isLoadingDrivers = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (drivers) => {
          this.driverOptions = drivers.map((d) => ({ label: d.label, value: d.id }));
          this.cdr.markForCheck();
        },
      });
  }

  private submit(): void {
    if (!this.fine || this.form.invalid || this.isSaving) return;

    const fine = this.fine;
    const { driverId } = this.form.value;

    if (!driverId) return;

    this.isSaving = true;
    this.cdr.markForCheck();

    const payload = {
      vehicleId: fine.vehicleId,
      driverId,
      date: fine.date,
      autoNumber: fine.autoNumber,
      location: fine.location,
      description: fine.description,
      severity: fine.severity,
      points: fine.points,
      amount: fine.amount,
      discountAmount: fine.discountAmount,
      dueDate: fine.dueDate,
      status: FineStatus.DRIVER_IDENTIFIED,
      payrollDeduction: fine.payrollDeduction,
      notes: fine.notes,
      fileUrl: fine.fileUrl,
    };

    this.finesService
      .update(fine.id, payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success(`Condutor identificado na multa ${fine.autoNumber}.`);
          this.identified.emit();
          this.close();
        },
        error: () => {
          this.notificationService.error(
            'Não foi possível identificar o condutor. Tente novamente.',
          );
        },
      });
  }
}
