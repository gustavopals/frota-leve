import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PoBreadcrumb, PoUploadFile, PoUploadFileRestrictions } from '@po-ui/ng-components';
import { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import {
  FUEL_TYPE_OPTIONS,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
} from '../../vehicles.constants';
import { VehiclesService } from '../../vehicles.service';
import type { VehicleDetail, VehicleFormPayload } from '../../vehicles.types';
import {
  maskVehiclePlateInput,
  toIsoDateInputValue,
  validateVehiclePlate,
} from '../../vehicles.utils';

const CURRENT_YEAR = new Date().getFullYear();

function yearModelConsistencyValidator(group: AbstractControl): ValidationErrors | null {
  const year = Number(group.get('year')?.value);
  const yearModel = Number(group.get('yearModel')?.value);

  if (!Number.isFinite(year) || !Number.isFinite(yearModel)) {
    return null;
  }

  return yearModel < year
    ? {
        yearModelInvalid: true,
      }
    : null;
}

function plateValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  return validateVehiclePlate(value)
    ? null
    : {
        invalidPlate: true,
      };
}

function urlValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? null : { invalidUrl: true };
  } catch {
    return {
      invalidUrl: true,
    };
  }
}

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  PoPageModule,
  PoFieldModule,
  PoButtonModule,
  PoDividerModule,
  PoWidgetModule,
} from '@po-ui/ng-components';

@Component({
  selector: 'app-vehicle-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoDividerModule,
    PoWidgetModule,
  ],
  templateUrl: './vehicle-form-page.html',
  styleUrl: './vehicle-form-page.scss',
})
export class VehicleFormPage implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly notificationService = inject(NotificationService);

  readonly statusOptions = VEHICLE_STATUS_OPTIONS;
  readonly categoryOptions = VEHICLE_CATEGORY_OPTIONS;
  readonly fuelTypeOptions = FUEL_TYPE_OPTIONS;
  readonly currentYearMax = CURRENT_YEAR + 1;
  readonly currentYearModelMax = CURRENT_YEAR + 2;
  readonly photoUrlFieldNames = ['photoUrl1', 'photoUrl2', 'photoUrl3', 'photoUrl4'] as const;
  readonly photoRestrictions: PoUploadFileRestrictions = {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxFiles: 4,
    maxFileSize: 5 * 1024 * 1024,
  };

  readonly form = this.formBuilder.group(
    {
      plate: ['', [Validators.required, plateValidator]],
      renavam: [''],
      chassis: [''],
      brand: ['', [Validators.required]],
      model: ['', [Validators.required]],
      year: [
        CURRENT_YEAR,
        [Validators.required, Validators.min(1950), Validators.max(CURRENT_YEAR + 1)],
      ],
      yearModel: [
        CURRENT_YEAR,
        [Validators.required, Validators.min(1950), Validators.max(CURRENT_YEAR + 2)],
      ],
      color: [''],
      fuelType: [FuelType.GASOLINE as FuelType, [Validators.required]],
      category: [VehicleCategory.LIGHT as VehicleCategory, [Validators.required]],
      status: [VehicleStatus.ACTIVE as VehicleStatus, [Validators.required]],
      currentMileage: [0, [Validators.required, Validators.min(0)]],
      expectedConsumption: [null as number | null, [Validators.min(0.1)]],
      acquisitionDate: [null as string | null],
      acquisitionValue: [null as number | null, [Validators.min(0)]],
      notes: [''],
      photoUrl1: ['', [urlValidator]],
      photoUrl2: ['', [urlValidator]],
      photoUrl3: ['', [urlValidator]],
      photoUrl4: ['', [urlValidator]],
    },
    {
      validators: [yearModelConsistencyValidator],
    },
  );

  vehicle: VehicleDetail | null = null;
  isLoading = false;
  isSaving = false;
  photoUploadFiles: PoUploadFile[] = [];
  localPhotoPreviewUrls: string[] = [];

  constructor() {
    this.form.controls.plate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const maskedValue = maskVehiclePlateInput(value ?? '');

        if (maskedValue !== value) {
          this.form.controls.plate.setValue(maskedValue, {
            emitEvent: false,
          });
        }
      });

    this.loadVehicleIfNeeded();
  }

  ngOnDestroy(): void {
    this.revokePhotoPreviewUrls();
  }

  protected get isEditMode(): boolean {
    return !!this.vehicleId;
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Veículos', link: '/vehicles' },
        {
          label: this.isEditMode ? 'Editar' : 'Novo veículo',
          link: this.isEditMode ? `/vehicles/${this.vehicleId}/edit` : '/vehicles/new',
        },
      ],
    };
  }

  protected get title(): string {
    return this.isEditMode ? 'Editar veículo' : 'Novo veículo';
  }

  protected get subtitle(): string {
    return this.isEditMode
      ? 'Ajuste cadastro, status e parâmetros operacionais sem desperdiçar espaço de tela.'
      : 'Cadastro enxuto com dados operacionais, aquisição, observações e pré-visualização de fotos.';
  }

  protected get previewPlate(): string {
    return this.form.controls.plate.value?.trim() || 'ABC1D23';
  }

  protected get previewBrandModel(): string {
    const brand = this.form.controls.brand.value?.trim();
    const model = this.form.controls.model.value?.trim();

    return [brand, model].filter(Boolean).join(' ') || 'Marca e modelo';
  }

  protected get persistedPhotoUrls(): string[] {
    return this.vehicle?.photos ?? [];
  }

  protected get canSave(): boolean {
    return !this.form.invalid && !this.isSaving && !this.isLoading;
  }

  cancel(): void {
    if (this.isEditMode && this.vehicleId) {
      void this.router.navigate(['/vehicles', this.vehicleId]);
      return;
    }

    void this.router.navigate(['/vehicles']);
  }

  save(): void {
    this.submit(false);
  }

  saveAndCreateNew(): void {
    this.submit(true);
  }

  handlePhotoFilesChange(files: PoUploadFile[] | null | undefined): void {
    this.photoUploadFiles = files ?? [];
    this.revokePhotoPreviewUrls();
    this.localPhotoPreviewUrls = this.photoUploadFiles.map((file) =>
      URL.createObjectURL(file.rawFile),
    );
  }

  getControlErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Campo obrigatório.'];
    }

    if (control.hasError('invalidPlate')) {
      return ['Use placa válida no padrão antigo ou Mercosul.'];
    }

    if (control.hasError('min')) {
      return ['Valor abaixo do mínimo permitido.'];
    }

    if (control.hasError('max')) {
      return ['Valor acima do máximo permitido.'];
    }

    if (control.hasError('invalidUrl')) {
      return ['Informe uma URL http(s) válida.'];
    }

    return ['Corrija o valor informado.'];
  }

  protected get yearModelError(): string | null {
    if (!this.form.hasError('yearModelInvalid') || !this.form.touched) {
      return null;
    }

    return 'Ano modelo não pode ser menor que o ano de fabricação.';
  }

  private get vehicleId(): string | null {
    return this.activatedRoute.snapshot.paramMap.get('id');
  }

  private loadVehicleIfNeeded(): void {
    if (!this.vehicleId) {
      return;
    }

    this.isLoading = true;

    this.vehiclesService
      .getById(this.vehicleId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.vehicle = vehicle;
          this.form.patchValue({
            plate: vehicle.plate,
            renavam: vehicle.renavam ?? '',
            chassis: vehicle.chassis ?? '',
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            yearModel: vehicle.yearModel,
            color: vehicle.color ?? '',
            fuelType: vehicle.fuelType,
            category: vehicle.category,
            status: vehicle.status,
            currentMileage: vehicle.currentMileage,
            expectedConsumption: vehicle.expectedConsumption,
            acquisitionDate: toIsoDateInputValue(vehicle.acquisitionDate),
            acquisitionValue: vehicle.acquisitionValue,
            notes: vehicle.notes ?? '',
            photoUrl1: vehicle.photos?.[0] ?? '',
            photoUrl2: vehicle.photos?.[1] ?? '',
            photoUrl3: vehicle.photos?.[2] ?? '',
            photoUrl4: vehicle.photos?.[3] ?? '',
          });
        },
      });
  }

  private submit(keepEditingNew: boolean): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.photoUploadFiles.length > 0) {
      this.notificationService.info(
        'As fotos enviadas ficam em pré-visualização local nesta etapa. Para persistir agora, use as URLs abaixo.',
      );
    }

    this.isSaving = true;

    const payload = this.buildPayload();
    const request$ = this.vehicleId
      ? this.vehiclesService.update(this.vehicleId, payload)
      : this.vehiclesService.create(payload);

    request$
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.notificationService.success(
            this.vehicleId ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.',
          );

          if (keepEditingNew && !this.vehicleId) {
            this.form.reset({
              plate: '',
              renavam: '',
              chassis: '',
              brand: '',
              model: '',
              year: CURRENT_YEAR,
              yearModel: CURRENT_YEAR,
              color: '',
              fuelType: FuelType.GASOLINE,
              category: VehicleCategory.LIGHT,
              status: VehicleStatus.ACTIVE,
              currentMileage: 0,
              expectedConsumption: null,
              acquisitionDate: null,
              acquisitionValue: null,
              notes: '',
              photoUrl1: '',
              photoUrl2: '',
              photoUrl3: '',
              photoUrl4: '',
            });
            this.handlePhotoFilesChange([]);
            return;
          }

          void this.router.navigate(['/vehicles', vehicle.id]);
        },
      });
  }

  private buildPayload(): VehicleFormPayload {
    const rawValue = this.form.getRawValue();
    const photos = [rawValue.photoUrl1, rawValue.photoUrl2, rawValue.photoUrl3, rawValue.photoUrl4]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    return {
      plate: rawValue.plate?.trim() ?? '',
      renavam: rawValue.renavam?.trim() || null,
      chassis: rawValue.chassis?.trim() || null,
      brand: rawValue.brand?.trim() ?? '',
      model: rawValue.model?.trim() ?? '',
      year: Number(rawValue.year),
      yearModel: Number(rawValue.yearModel),
      color: rawValue.color?.trim() || null,
      fuelType: rawValue.fuelType as FuelType,
      category: rawValue.category as VehicleCategory,
      status: rawValue.status as VehicleStatus,
      currentMileage: Number(rawValue.currentMileage),
      expectedConsumption:
        rawValue.expectedConsumption == null ? null : Number(rawValue.expectedConsumption),
      acquisitionDate: rawValue.acquisitionDate || null,
      acquisitionValue:
        rawValue.acquisitionValue == null ? null : Number(rawValue.acquisitionValue),
      photos,
      notes: rawValue.notes?.trim() || null,
    };
  }

  private revokePhotoPreviewUrls(): void {
    this.localPhotoPreviewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.localPhotoPreviewUrls = [];
  }
}
