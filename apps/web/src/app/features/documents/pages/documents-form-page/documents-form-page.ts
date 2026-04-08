import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';
import type {
  PoBreadcrumb,
  PoComboOption,
  PoUploadFile,
  PoUploadFileRestrictions,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoDividerModule,
  PoFieldModule,
  PoPageModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize, forkJoin, of } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { DOCUMENT_ALERT_PRESET_DAYS, DOCUMENT_TYPE_OPTIONS } from '../../documents.constants';
import { DocumentsService } from '../../documents.service';
import type {
  DocumentDetail,
  DocumentFormPayload,
  DocumentType as DocumentTypeValue,
} from '../../documents.types';
import {
  formatDocumentDate,
  getDocumentTypeLabel,
  toIsoDateInputValue,
} from '../../documents.utils';

type DocumentFormValue = {
  vehicleId: string;
  driverId: string;
  type: DocumentType;
  description: string;
  expirationDate: string | null;
  alertDaysBefore: number;
  cost: number | null;
  fileUrl: string;
  notes: string;
};

type AttachmentMeta = {
  name: string;
  size: number | null;
  mimeType: string | null;
  source: 'uploaded' | 'persisted';
};

function createDefaultFormValue(defaults: {
  vehicleId?: string | null;
  driverId?: string | null;
  type?: DocumentType | null;
}): DocumentFormValue {
  return {
    vehicleId: defaults.vehicleId ?? '',
    driverId: defaults.driverId ?? '',
    type: defaults.type ?? DocumentType.IPVA,
    description: '',
    expirationDate: null,
    alertDaysBefore: 30,
    cost: null,
    fileUrl: '',
    notes: '',
  };
}

function parseDocumentTypeParam(value: string | null): DocumentType | null {
  if (!value) {
    return null;
  }

  return Object.values(DocumentType).includes(value as DocumentType)
    ? (value as DocumentType)
    : null;
}

function fileUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:', 'data:'].includes(url.protocol) ? null : { invalidFileUrl: true };
  } catch {
    return {
      invalidFileUrl: true,
    };
  }
}

function documentLinkValidator(control: AbstractControl): ValidationErrors | null {
  const vehicleId = String(control.get('vehicleId')?.value ?? '').trim();
  const driverId = String(control.get('driverId')?.value ?? '').trim();
  const type = control.get('type')?.value as DocumentType | null;

  if (!vehicleId && !driverId) {
    return {
      targetRequired: true,
    };
  }

  if (type === DocumentType.CNH && !driverId) {
    return {
      driverRequiredForCnh: true,
    };
  }

  return null;
}

@Component({
  selector: 'app-documents-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoDividerModule,
    PoWidgetModule,
  ],
  templateUrl: './documents-form-page.html',
  styleUrl: './documents-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsFormPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentsService = inject(DocumentsService);
  private readonly notificationService = inject(NotificationService);

  private readonly defaultVehicleId = this.activatedRoute.snapshot.queryParamMap.get('vehicleId');
  private readonly defaultDriverId = this.activatedRoute.snapshot.queryParamMap.get('driverId');
  private readonly defaultType =
    parseDocumentTypeParam(this.activatedRoute.snapshot.queryParamMap.get('type')) ??
    DocumentType.IPVA;

  readonly typeOptions = DOCUMENT_TYPE_OPTIONS;
  readonly alertPresetDays = DOCUMENT_ALERT_PRESET_DAYS;
  readonly attachmentRestrictions: PoUploadFileRestrictions = {
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    maxFiles: 1,
    maxFileSize: 4 * 1024 * 1024,
  };

  readonly form = this.formBuilder.group(
    {
      vehicleId: [this.defaultVehicleId ?? ''],
      driverId: [this.defaultDriverId ?? ''],
      type: [this.defaultType as DocumentType, [Validators.required]],
      description: ['', [Validators.required, Validators.maxLength(240)]],
      expirationDate: [null as string | null, [Validators.required]],
      alertDaysBefore: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
      cost: [null as number | null, [Validators.min(0)]],
      fileUrl: ['', [Validators.required, fileUrlValidator]],
      notes: [''],
    },
    {
      validators: [documentLinkValidator],
    },
  );

  vehicleOptions: PoComboOption[] = [];
  driverOptions: PoComboOption[] = [];
  document: DocumentDetail | null = null;
  attachmentUploadFiles: PoUploadFile[] = [];
  attachmentMeta: AttachmentMeta | null = null;
  initialFileUrl = '';
  isLoading = false;
  isLoadingOptions = false;
  isSaving = false;
  isReadingAttachment = false;

  constructor() {
    this.loadFormContext();
  }

  protected get isEditMode(): boolean {
    return !!this.documentId;
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Documentos', link: '/documents' },
        {
          label: this.isEditMode ? 'Editar' : 'Novo documento',
          link: this.isEditMode ? `/documents/${this.documentId}/edit` : '/documents/new',
        },
      ],
    };
  }

  protected get title(): string {
    return this.isEditMode ? 'Editar documento' : 'Novo documento';
  }

  protected get subtitle(): string {
    return this.isEditMode
      ? 'Atualize vencimento, vínculo operacional, anexo e antecedência do alerta.'
      : 'Cadastre o documento com anexo, janela de alerta e vínculo com veículo ou motorista.';
  }

  protected get canSave(): boolean {
    return (
      !this.form.invalid &&
      !this.isSaving &&
      !this.isLoading &&
      !this.isLoadingOptions &&
      !this.isReadingAttachment
    );
  }

  protected get relationError(): string | null {
    if (!this.form.touched) {
      return null;
    }

    if (this.form.hasError('targetRequired')) {
      return 'Vincule o documento a um veículo ou motorista.';
    }

    if (this.form.hasError('driverRequiredForCnh')) {
      return 'Documentos do tipo CNH exigem um motorista vinculado.';
    }

    return null;
  }

  protected get selectedTypeLabel(): string {
    return getDocumentTypeLabel(this.form.controls.type.value as DocumentTypeValue);
  }

  protected get targetSummary(): string {
    const vehicleLabel = this.findOptionLabel(
      this.vehicleOptions,
      this.form.controls.vehicleId.value,
    );
    const driverLabel = this.findOptionLabel(this.driverOptions, this.form.controls.driverId.value);

    return [vehicleLabel, driverLabel].filter(Boolean).join(' / ') || 'Sem vínculo operacional';
  }

  protected get alertSummary(): string {
    return this.formatAlertLeadTime(this.form.controls.alertDaysBefore.value ?? 0);
  }

  protected get expirationSummary(): string {
    return formatDocumentDate(this.form.controls.expirationDate.value);
  }

  protected get currentAttachmentUrl(): string {
    return String(this.form.controls.fileUrl.value ?? '').trim();
  }

  protected get hasAttachment(): boolean {
    return !!this.currentAttachmentUrl;
  }

  protected get showFileUrlField(): boolean {
    return !this.currentAttachmentUrl || !this.isInlineAttachmentUrl(this.currentAttachmentUrl);
  }

  protected get attachmentName(): string {
    return this.attachmentMeta?.name ?? this.resolveAttachmentName(this.currentAttachmentUrl);
  }

  protected get attachmentHelper(): string {
    if (!this.hasAttachment) {
      return 'Envie um arquivo ou informe uma URL válida.';
    }

    const originLabel =
      this.attachmentMeta?.source === 'uploaded' ||
      this.isInlineAttachmentUrl(this.currentAttachmentUrl)
        ? 'Anexo embutido no cadastro'
        : 'Referência externa';

    if (this.attachmentMeta?.size != null) {
      return `${originLabel} • ${this.formatFileSize(this.attachmentMeta.size)}`;
    }

    return originLabel;
  }

  protected get canRestoreAttachment(): boolean {
    return !!this.initialFileUrl && this.currentAttachmentUrl !== this.initialFileUrl;
  }

  protected get canSwitchToExternalUrlMode(): boolean {
    return this.isInlineAttachmentUrl(this.currentAttachmentUrl);
  }

  protected get showImagePreview(): boolean {
    return (
      this.resolveAttachmentKind(
        this.currentAttachmentUrl,
        this.attachmentMeta?.mimeType ?? null,
      ) === 'image'
    );
  }

  protected get fileUrlHelpText(): string {
    return 'Aceita https:// ou um data URL gerado pelo upload local.';
  }

  cancel(): void {
    void this.router.navigate(['/documents']);
  }

  save(): void {
    this.submit(false);
  }

  saveAndCreateNew(): void {
    this.submit(true);
  }

  applyAlertPreset(days: number): void {
    this.form.controls.alertDaysBefore.setValue(days);
    this.form.controls.alertDaysBefore.markAsDirty();
    this.form.controls.alertDaysBefore.markAsTouched();
  }

  async handleAttachmentFilesChange(files: PoUploadFile[] | null | undefined): Promise<void> {
    this.attachmentUploadFiles = files ?? [];
    const selectedFile = this.attachmentUploadFiles[0]?.rawFile;

    if (!selectedFile) {
      return;
    }

    this.isReadingAttachment = true;

    try {
      const dataUrl = await this.readFileAsDataUrl(selectedFile);
      this.form.controls.fileUrl.setValue(dataUrl);
      this.form.controls.fileUrl.markAsDirty();
      this.form.controls.fileUrl.markAsTouched();
      this.attachmentMeta = {
        name: selectedFile.name,
        size: selectedFile.size,
        mimeType: selectedFile.type || null,
        source: 'uploaded',
      };
    } catch {
      this.notificationService.error('Não foi possível processar o arquivo selecionado.');
      this.attachmentUploadFiles = [];
    } finally {
      this.isReadingAttachment = false;
    }
  }

  restoreInitialAttachment(): void {
    if (!this.initialFileUrl) {
      return;
    }

    this.attachmentUploadFiles = [];
    this.form.controls.fileUrl.setValue(this.initialFileUrl);
    this.attachmentMeta = this.buildPersistedAttachmentMeta(this.initialFileUrl);
  }

  switchToExternalUrlMode(): void {
    this.attachmentUploadFiles = [];
    this.form.controls.fileUrl.setValue('');
    this.form.controls.fileUrl.markAsDirty();
    this.form.controls.fileUrl.markAsTouched();
    this.attachmentMeta = null;
  }

  openAttachment(): void {
    if (!this.currentAttachmentUrl) {
      return;
    }

    globalThis.open(this.currentAttachmentUrl, '_blank', 'noopener,noreferrer');
  }

  getControlErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Campo obrigatório.'];
    }

    if (control.hasError('min')) {
      return ['Valor abaixo do mínimo permitido.'];
    }

    if (control.hasError('max')) {
      return ['Valor acima do máximo permitido.'];
    }

    if (control.hasError('maxlength')) {
      return ['Texto acima do limite permitido.'];
    }

    if (control.hasError('invalidFileUrl')) {
      return ['Informe uma URL válida em https:// ou use o upload local do arquivo.'];
    }

    return ['Corrija o valor informado.'];
  }

  protected isAlertPresetActive(days: number): boolean {
    return this.form.controls.alertDaysBefore.value === days;
  }

  private get documentId(): string | null {
    return this.activatedRoute.snapshot.paramMap.get('id');
  }

  private loadFormContext(): void {
    this.isLoading = this.isEditMode;
    this.isLoadingOptions = true;

    forkJoin({
      vehicles: this.documentsService.listVehicleOptions(),
      drivers: this.documentsService.listDriverOptions(),
      document: this.documentId ? this.documentsService.getById(this.documentId) : of(null),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.isLoadingOptions = false;
        }),
      )
      .subscribe({
        next: ({ vehicles, drivers, document }) => {
          this.vehicleOptions = vehicles.map((vehicle) => ({
            label: vehicle.label,
            value: vehicle.id,
          }));
          this.driverOptions = drivers.map((driver) => ({
            label: driver.label,
            value: driver.id,
          }));

          if (!document) {
            return;
          }

          this.document = document;
          this.initialFileUrl = document.fileUrl;
          this.attachmentMeta = this.buildPersistedAttachmentMeta(document.fileUrl);
          this.form.patchValue({
            vehicleId: document.vehicleId ?? '',
            driverId: document.driverId ?? '',
            type: document.type,
            description: document.description,
            expirationDate: toIsoDateInputValue(document.expirationDate),
            alertDaysBefore: document.alertDaysBefore,
            cost: document.cost,
            fileUrl: document.fileUrl,
            notes: document.notes ?? '',
          });
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar o formulário de documentos.');
        },
      });
  }

  private submit(createAnother: boolean): void {
    if (this.form.invalid || this.isSaving || this.isReadingAttachment) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const request$ =
      this.isEditMode && this.documentId
        ? this.documentsService.update(this.documentId, payload)
        : this.documentsService.create(payload);

    this.isSaving = true;

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success(
            this.isEditMode ? 'Documento atualizado com sucesso.' : 'Documento criado com sucesso.',
          );

          if (createAnother) {
            this.document = null;
            this.initialFileUrl = '';
            this.attachmentMeta = null;
            this.attachmentUploadFiles = [];
            this.form.reset(
              createDefaultFormValue({
                vehicleId: this.defaultVehicleId,
                driverId: this.defaultDriverId,
                type: this.defaultType,
              }),
            );

            if (this.isEditMode) {
              void this.router.navigate(['/documents/new'], {
                queryParams: this.buildDefaultQueryParams(),
              });
            }

            return;
          }

          void this.router.navigate(['/documents']);
        },
        error: () => {
          this.notificationService.error('Não foi possível salvar o documento.');
        },
      });
  }

  private buildPayload(): DocumentFormPayload {
    const raw = this.form.getRawValue();

    return {
      vehicleId: raw.vehicleId?.trim() || null,
      driverId: raw.driverId?.trim() || null,
      type: raw.type as DocumentType,
      description: raw.description?.trim() ?? '',
      expirationDate: raw.expirationDate ?? '',
      alertDaysBefore: Number(raw.alertDaysBefore ?? 0),
      cost: raw.cost == null ? null : Number(raw.cost),
      fileUrl: raw.fileUrl?.trim() ?? '',
      notes: raw.notes?.trim() || null,
    };
  }

  private buildDefaultQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};

    if (this.defaultVehicleId) {
      params['vehicleId'] = this.defaultVehicleId;
    }

    if (this.defaultDriverId) {
      params['driverId'] = this.defaultDriverId;
    }

    if (this.defaultType) {
      params['type'] = this.defaultType;
    }

    return params;
  }

  private formatAlertLeadTime(days: number): string {
    if (days <= 0) {
      return 'Alerta apenas no vencimento';
    }

    if (days === 1) {
      return 'Alerta 1 dia antes';
    }

    return `Alerta ${days} dias antes`;
  }

  private findOptionLabel(
    options: PoComboOption[],
    value: string | null | undefined,
  ): string | null {
    const selectedValue = String(value ?? '').trim();

    if (!selectedValue) {
      return null;
    }

    const option = options.find((item) => item.value === selectedValue);
    return option?.label ?? selectedValue;
  }

  private buildPersistedAttachmentMeta(fileUrl: string): AttachmentMeta {
    return {
      name: this.resolveAttachmentName(fileUrl),
      size: null,
      mimeType: this.resolveMimeTypeFromUrl(fileUrl),
      source: 'persisted',
    };
  }

  private resolveAttachmentKind(
    fileUrl: string,
    mimeType: string | null,
  ): 'image' | 'pdf' | 'file' {
    if (!fileUrl) {
      return 'file';
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? this.resolveMimeTypeFromUrl(fileUrl);

    if (normalizedMimeType?.startsWith('image/')) {
      return 'image';
    }

    if (normalizedMimeType === 'application/pdf') {
      return 'pdf';
    }

    if (/\.pdf(?:$|[?#])/i.test(fileUrl)) {
      return 'pdf';
    }

    if (/\.(png|jpe?g|webp)(?:$|[?#])/i.test(fileUrl)) {
      return 'image';
    }

    return 'file';
  }

  private resolveAttachmentName(fileUrl: string): string {
    if (!fileUrl) {
      return 'Nenhum anexo';
    }

    if (this.isInlineAttachmentUrl(fileUrl)) {
      const mimeType = this.resolveMimeTypeFromUrl(fileUrl);

      if (mimeType === 'application/pdf') {
        return 'documento.pdf';
      }

      if (mimeType?.startsWith('image/')) {
        const extension = mimeType.split('/')[1] ?? 'arquivo';
        return `documento.${extension}`;
      }

      return 'documento-anexado';
    }

    try {
      const url = new URL(fileUrl);
      const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
      return fileName || 'arquivo-externo';
    } catch {
      return 'arquivo-externo';
    }
  }

  private resolveMimeTypeFromUrl(fileUrl: string): string | null {
    if (!fileUrl) {
      return null;
    }

    if (fileUrl.startsWith('data:')) {
      const [prefix] = fileUrl.split(';', 1);
      return prefix.replace('data:', '').toLowerCase();
    }

    if (/\.pdf(?:$|[?#])/i.test(fileUrl)) {
      return 'application/pdf';
    }

    if (/\.png(?:$|[?#])/i.test(fileUrl)) {
      return 'image/png';
    }

    if (/\.jpe?g(?:$|[?#])/i.test(fileUrl)) {
      return 'image/jpeg';
    }

    if (/\.webp(?:$|[?#])/i.test(fileUrl)) {
      return 'image/webp';
    }

    return null;
  }

  private isInlineAttachmentUrl(fileUrl: string): boolean {
    return fileUrl.startsWith('data:');
  }

  private formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== 'string') {
          reject(new Error('Resultado inválido do arquivo'));
          return;
        }

        resolve(result);
      };

      reader.onerror = () => {
        reject(reader.error ?? new Error('Falha ao ler arquivo'));
      };

      reader.readAsDataURL(file);
    });
  }
}
