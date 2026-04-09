import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PoComboOption, PoPageAction } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoButtonType,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTagModule,
} from '@po-ui/ng-components';
import { finalize, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../../core/services/api';
import { NotificationService } from '../../../../core/services/notification';
import { IncidentFileUploader } from '../../components/incident-file-uploader/incident-file-uploader';
import { INCIDENT_STATUS_OPTIONS, INCIDENT_TYPE_OPTIONS } from '../../incidents.constants';
import { IncidentsService } from '../../incidents.service';
import type {
  IncidentFormPayload,
  IncidentRecord,
  IncidentStatus,
  PendingFile,
} from '../../incidents.types';

type VehicleOption = { id: string; plate: string; brand: string; model: string; year: number };
type DriverOption = { id: string; name: string; cpf: string };

const OPTIONS_PAGE_SIZE = 100;

@Component({
  selector: 'app-incident-form-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoTagModule,
    PoLoadingModule,
    IncidentFileUploader,
  ],
  templateUrl: './incident-form-page.html',
  styleUrl: './incident-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentFormPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly incidentsService = inject(IncidentsService);
  private readonly apiService = inject(ApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly typeOptions: PoComboOption[] = INCIDENT_TYPE_OPTIONS;
  readonly statusOptions: PoComboOption[] = INCIDENT_STATUS_OPTIONS.filter((o) => o.value !== '');
  protected readonly poButtonType = PoButtonType;

  vehicleOptions: PoComboOption[] = [];
  driverOptions: PoComboOption[] = [];

  incidentId: string | null = null;
  existing: IncidentRecord | null = null;
  isEditing = false;
  isLoading = false;
  isSaving = false;
  isUploadingPhotos = false;
  isUploadingDocs = false;

  pendingPhotos: PendingFile[] = [];
  pendingDocs: PendingFile[] = [];

  // URLs já persistidas (ao editar)
  existingPhotoUrls: string[] = [];
  existingDocUrls: string[] = [];

  readonly form = this.formBuilder.group({
    vehicleId: ['', Validators.required],
    driverId: [''],
    date: ['', Validators.required],
    location: ['', [Validators.required, Validators.maxLength(200)]],
    type: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    thirdPartyInvolved: [false],
    policeReport: [false],
    insurerNotified: [false],
    insuranceClaimNumber: [''],
    estimatedCost: [null as number | null],
    actualCost: [null as number | null],
    downtime: [null as number | null],
    status: ['REGISTERED' as IncidentStatus],
    notes: [''],
  });

  constructor() {
    this.incidentId = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!this.incidentId;
    this.loadOptions();
    if (this.isEditing && this.incidentId) {
      this.loadExisting(this.incidentId);
    }
  }

  protected get pageTitle(): string {
    return this.isEditing ? 'Editar sinistro' : 'Registrar sinistro';
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Cancelar',
        action: () => this.cancel(),
      },
    ];
  }

  protected get isBusy(): boolean {
    return this.isSaving || this.isUploadingPhotos || this.isUploadingDocs;
  }

  protected get saveLabel(): string {
    if (this.isUploadingPhotos || this.isUploadingDocs) return 'Enviando arquivos...';
    if (this.isSaving) return 'Salvando...';
    return this.isEditing ? 'Salvar alterações' : 'Registrar sinistro';
  }

  protected onPhotosChanged(files: PendingFile[]): void {
    this.pendingPhotos = files;
  }

  protected onDocsChanged(files: PendingFile[]): void {
    this.pendingDocs = files;
  }

  protected cancel(): void {
    void this.router.navigate(['/incidents']);
  }

  protected removeExistingPhoto(index: number): void {
    this.existingPhotoUrls = this.existingPhotoUrls.filter((_, i) => i !== index);
  }

  protected removeExistingDoc(index: number): void {
    this.existingDocUrls = this.existingDocUrls.filter((_, i) => i !== index);
  }

  protected submit(): void {
    if (this.form.invalid || this.isBusy) return;

    const photoFiles = this.pendingPhotos.map((p) => p.file);
    const docFiles = this.pendingDocs.map((p) => p.file);

    const photoUpload$ =
      photoFiles.length > 0
        ? this.incidentsService.uploadFiles(photoFiles).pipe(map((r) => r.urls))
        : of([] as string[]);
    const docUpload$ =
      docFiles.length > 0
        ? this.incidentsService.uploadFiles(docFiles).pipe(map((r) => r.urls))
        : of([] as string[]);

    if (photoFiles.length > 0) this.isUploadingPhotos = true;
    if (docFiles.length > 0) this.isUploadingDocs = true;
    this.cdr.markForCheck();

    forkJoin([photoUpload$, docUpload$])
      .pipe(
        finalize(() => {
          this.isUploadingPhotos = false;
          this.isUploadingDocs = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ([newPhotoUrls, newDocUrls]) => {
          const allPhotos = [...this.existingPhotoUrls, ...newPhotoUrls];
          const allDocs = [...this.existingDocUrls, ...newDocUrls];
          this.saveIncident(allPhotos, allDocs);
        },
        error: () => {
          this.notificationService.error('Falha ao enviar arquivos. Tente novamente.');
        },
      });
  }

  private saveIncident(photos: string[], documents: string[]): void {
    const v = this.form.getRawValue();

    if (!v.vehicleId || !v.date || !v.location || !v.type || !v.description) {
      this.notificationService.error('Preencha os campos obrigatórios antes de salvar o sinistro.');
      return;
    }

    const payload: IncidentFormPayload & { status: IncidentStatus } = {
      vehicleId: v.vehicleId,
      driverId: v.driverId || null,
      date: new Date(v.date),
      location: v.location,
      type: v.type as never,
      description: v.description,
      thirdPartyInvolved: v.thirdPartyInvolved ?? false,
      policeReport: v.policeReport ?? false,
      insurerNotified: v.insurerNotified ?? false,
      insuranceClaimNumber: v.insuranceClaimNumber || null,
      estimatedCost: v.estimatedCost ?? null,
      actualCost: v.actualCost ?? null,
      downtime: v.downtime ?? null,
      status: (v.status ?? 'REGISTERED') as IncidentStatus,
      photos,
      documents,
      notes: v.notes || null,
    };

    this.isSaving = true;
    this.cdr.markForCheck();

    const save$ =
      this.isEditing && this.incidentId
        ? this.incidentsService.update(this.incidentId, payload)
        : this.incidentsService.create(payload);

    save$
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          const msg = this.isEditing
            ? 'Sinistro atualizado com sucesso.'
            : 'Sinistro registrado com sucesso.';
          this.notificationService.success(msg);
          void this.router.navigate(['/incidents']);
        },
        error: () => {
          this.notificationService.error(
            'Não foi possível salvar o sinistro. Verifique os dados e tente novamente.',
          );
        },
      });
  }

  private loadOptions(): void {
    this.apiService
      .get<{ items: VehicleOption[] }>('vehicles', {
        params: { page: 1, pageSize: OPTIONS_PAGE_SIZE },
      })
      .subscribe({
        next: (r) => {
          this.vehicleOptions = r.items.map((v) => ({
            label: `${v.plate} — ${v.brand} ${v.model} (${v.year})`,
            value: v.id,
          }));
          this.cdr.markForCheck();
        },
      });

    this.apiService
      .get<{ items: DriverOption[] }>('drivers', {
        params: { page: 1, pageSize: OPTIONS_PAGE_SIZE },
      })
      .subscribe({
        next: (r) => {
          this.driverOptions = r.items.map((d) => ({
            label: `${d.name} — CPF ${d.cpf}`,
            value: d.id,
          }));
          this.cdr.markForCheck();
        },
      });
  }

  private loadExisting(id: string): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.incidentsService
      .getById(id)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (incident) => {
          this.existing = incident;
          this.existingPhotoUrls = [...(incident.photos ?? [])];
          this.existingDocUrls = [...(incident.documents ?? [])];

          const dateStr = incident.date ? incident.date.slice(0, 10) : '';
          this.form.patchValue({
            vehicleId: incident.vehicleId,
            driverId: incident.driverId ?? '',
            date: dateStr,
            location: incident.location,
            type: incident.type,
            description: incident.description,
            thirdPartyInvolved: incident.thirdPartyInvolved,
            policeReport: incident.policeReport,
            insurerNotified: incident.insurerNotified,
            insuranceClaimNumber: incident.insuranceClaimNumber ?? '',
            estimatedCost: incident.estimatedCost,
            actualCost: incident.actualCost,
            downtime: incident.downtime,
            status: incident.status,
            notes: incident.notes ?? '',
          });
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Sinistro não encontrado.');
          void this.router.navigate(['/incidents']);
        },
      });
  }

  protected fileBaseName(url: string): string {
    return url.split('/').pop() ?? url;
  }

  protected isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  }
}
