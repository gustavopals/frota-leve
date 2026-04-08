import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PoBreadcrumb } from '@po-ui/ng-components';
import { PoDividerModule, PoFieldModule, PoPageModule, PoWidgetModule } from '@po-ui/ng-components';
import type { CnhCategory } from '@frota-leve/shared/src/dtos/driver.dto';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import {
  DRIVER_CNH_CATEGORY_OPTIONS,
  DRIVER_STATUS_FORM_OPTIONS,
  type DriverActivityOptionValue,
} from '../../drivers.constants';
import { DriversService } from '../../drivers.service';
import type { DriverDetail, DriverFormPayload } from '../../drivers.types';
import {
  formatDriverCpf,
  getDriverCnhMeta,
  maskCpfInput,
  maskPhoneInput,
  toIsoDateInputValue,
  validateDriverCpf,
  validateDriverPhone,
} from '../../drivers.utils';

type DriverFormValue = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string | null;
  cnhNumber: string;
  cnhCategory: CnhCategory | null;
  cnhExpiration: string | null;
  cnhPoints: number | null;
  emergencyContact: string;
  emergencyPhone: string;
  department: string;
  status: DriverActivityOptionValue;
  photoUrl: string;
  hireDate: string | null;
  score: number | null;
  notes: string;
};

function createDefaultFormValue(): DriverFormValue {
  return {
    name: '',
    cpf: '',
    phone: '',
    email: '',
    birthDate: null,
    cnhNumber: '',
    cnhCategory: null,
    cnhExpiration: null,
    cnhPoints: 0,
    emergencyContact: '',
    emergencyPhone: '',
    department: '',
    status: 'active',
    photoUrl: '',
    hireDate: null,
    score: 100,
    notes: '',
  };
}

function cpfValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  return validateDriverCpf(value)
    ? null
    : {
        invalidCpf: true,
      };
}

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  return validateDriverPhone(value)
    ? null
    : {
        invalidPhone: true,
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

@Component({
  selector: 'app-driver-form-page',
  imports: [ReactiveFormsModule, PoPageModule, PoFieldModule, PoDividerModule, PoWidgetModule],
  templateUrl: './driver-form-page.html',
  styleUrl: './driver-form-page.scss',
})
export class DriverFormPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly driversService = inject(DriversService);
  private readonly notificationService = inject(NotificationService);

  readonly cnhCategoryOptions = DRIVER_CNH_CATEGORY_OPTIONS;
  readonly statusOptions = DRIVER_STATUS_FORM_OPTIONS;
  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    cpf: ['', [Validators.required, cpfValidator]],
    phone: ['', [phoneValidator]],
    email: ['', [Validators.email]],
    birthDate: [null as string | null],
    cnhNumber: [''],
    cnhCategory: [null as CnhCategory | null],
    cnhExpiration: [null as string | null],
    cnhPoints: [0, [Validators.min(0), Validators.max(40)]],
    emergencyContact: [''],
    emergencyPhone: ['', [phoneValidator]],
    department: [''],
    status: ['active' as DriverActivityOptionValue, [Validators.required]],
    photoUrl: ['', [urlValidator]],
    hireDate: [null as string | null],
    score: [100, [Validators.min(0), Validators.max(100)]],
    notes: [''],
  });

  driver: DriverDetail | null = null;
  isLoading = false;
  isSaving = false;

  constructor() {
    this.form.controls.cpf.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const masked = maskCpfInput(value ?? '');

        if (masked !== value) {
          this.form.controls.cpf.setValue(masked, {
            emitEvent: false,
          });
        }
      });

    [this.form.controls.phone, this.form.controls.emergencyPhone].forEach((control) => {
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
        const masked = maskPhoneInput(value ?? '');

        if (masked !== value) {
          control.setValue(masked, {
            emitEvent: false,
          });
        }
      });
    });

    this.loadDriverIfNeeded();
  }

  protected get isEditMode(): boolean {
    return !!this.driverId;
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Motoristas', link: '/drivers' },
        {
          label: this.isEditMode ? 'Editar' : 'Novo motorista',
          link: this.isEditMode ? `/drivers/${this.driverId}/edit` : '/drivers/new',
        },
      ],
    };
  }

  protected get title(): string {
    return this.isEditMode ? 'Editar motorista' : 'Novo motorista';
  }

  protected get subtitle(): string {
    return this.isEditMode
      ? 'Atualize cadastro, score, CNH e contexto operacional do condutor.'
      : 'Cadastro compacto com foco em documentos do condutor, contato e contexto operacional.';
  }

  protected get canSave(): boolean {
    return !this.form.invalid && !this.isSaving && !this.isLoading;
  }

  protected get previewName(): string {
    return this.form.controls.name.value?.trim() || 'Nome do motorista';
  }

  protected get previewCpf(): string {
    return this.form.controls.cpf.value?.trim()
      ? formatDriverCpf(this.form.controls.cpf.value)
      : 'CPF não informado';
  }

  protected get previewDepartment(): string {
    return this.form.controls.department.value?.trim() || 'Sem departamento';
  }

  protected get previewCnhMeta() {
    return getDriverCnhMeta(this.form.controls.cnhExpiration.value);
  }

  protected get previewPhotoUrl(): string | null {
    const value = this.form.controls.photoUrl.value?.trim();

    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? value : null;
    } catch {
      return null;
    }
  }

  cancel(): void {
    if (this.isEditMode && this.driverId) {
      void this.router.navigate(['/drivers', this.driverId]);
      return;
    }

    void this.router.navigate(['/drivers']);
  }

  save(): void {
    this.submit(false);
  }

  saveAndCreateNew(): void {
    this.submit(true);
  }

  getControlErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Campo obrigatório.'];
    }

    if (control.hasError('minlength')) {
      return ['Use pelo menos 2 caracteres.'];
    }

    if (control.hasError('email')) {
      return ['Use um e-mail válido.'];
    }

    if (control.hasError('invalidCpf')) {
      return ['Informe um CPF válido.'];
    }

    if (control.hasError('invalidPhone')) {
      return ['Use telefone com DDD e 10 ou 11 dígitos.'];
    }

    if (control.hasError('invalidUrl')) {
      return ['Informe uma URL http(s) válida.'];
    }

    if (control.hasError('min')) {
      return ['Valor abaixo do mínimo permitido.'];
    }

    if (control.hasError('max')) {
      return ['Valor acima do máximo permitido.'];
    }

    return ['Corrija o valor informado.'];
  }

  private get driverId(): string | null {
    return this.activatedRoute.snapshot.paramMap.get('id');
  }

  private loadDriverIfNeeded(): void {
    if (!this.driverId) {
      this.form.reset(createDefaultFormValue());
      return;
    }

    this.isLoading = true;

    this.driversService
      .getById(this.driverId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (driver) => {
          this.driver = driver;
          this.form.patchValue({
            name: driver.name,
            cpf: maskCpfInput(driver.cpf),
            phone: maskPhoneInput(driver.phone ?? ''),
            email: driver.email ?? '',
            birthDate: toIsoDateInputValue(driver.birthDate),
            cnhNumber: driver.cnhNumber ?? '',
            cnhCategory: driver.cnhCategory,
            cnhExpiration: toIsoDateInputValue(driver.cnhExpiration),
            cnhPoints: driver.cnhPoints ?? 0,
            emergencyContact: driver.emergencyContact ?? '',
            emergencyPhone: maskPhoneInput(driver.emergencyPhone ?? ''),
            department: driver.department ?? '',
            status: driver.isActive ? 'active' : 'inactive',
            photoUrl: driver.photoUrl ?? '',
            hireDate: toIsoDateInputValue(driver.hireDate),
            score: driver.score ?? 100,
            notes: driver.notes ?? '',
          });
        },
      });
  }

  private submit(createAnother: boolean): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const request$ =
      this.isEditMode && this.driverId
        ? this.driversService.update(this.driverId, payload)
        : this.driversService.create(payload);

    this.isSaving = true;

    request$
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: (driver) => {
          this.notificationService.success(
            this.isEditMode ? 'Motorista atualizado com sucesso.' : 'Motorista criado com sucesso.',
          );

          if (createAnother) {
            this.driver = null;
            this.form.reset(createDefaultFormValue());
            if (this.isEditMode) {
              void this.router.navigate(['/drivers/new']);
            }
            return;
          }

          void this.router.navigate(['/drivers', driver.id]);
        },
      });
  }

  private buildPayload(): DriverFormPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name ?? '',
      cpf: raw.cpf ?? '',
      phone: raw.phone,
      email: raw.email,
      birthDate: raw.birthDate,
      cnhNumber: raw.cnhNumber,
      cnhCategory: raw.cnhCategory,
      cnhExpiration: raw.cnhExpiration,
      cnhPoints: raw.cnhPoints,
      emergencyContact: raw.emergencyContact,
      emergencyPhone: raw.emergencyPhone,
      department: raw.department,
      isActive: raw.status === 'active',
      photoUrl: raw.photoUrl,
      hireDate: raw.hireDate,
      score: raw.score,
      notes: raw.notes,
    };
  }
}
