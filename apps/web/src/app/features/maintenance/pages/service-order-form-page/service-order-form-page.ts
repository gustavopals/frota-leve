import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import {
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
import { ServiceOrderStatus } from '@frota-leve/shared/src/enums/os-status.enum';
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
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import {
  MAINTENANCE_TYPE_OPTIONS,
  SERVICE_ORDER_WORKFLOW_ROLES,
} from '../../maintenance.constants';
import { MaintenanceService } from '../../maintenance.service';
import type {
  MaintenancePlanOption,
  MaintenanceType as MaintenanceTypeValue,
  ServiceOrderFormPayload,
  ServiceOrderRecord,
} from '../../maintenance.types';
import {
  formatMaintenanceCurrency,
  formatMaintenanceType,
  formatServiceOrderStatus,
} from '../../maintenance.utils';

type ServiceOrderPhotoAttachment = {
  url: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  source: 'uploaded' | 'persisted';
};

type ServiceOrderInvoiceMeta = {
  name: string;
  size: number | null;
  mimeType: string | null;
  source: 'uploaded' | 'persisted';
};

type ServiceOrderItemFormValue = {
  description?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  partNumber?: string | null;
};

function parseMaintenanceTypeParam(value: string | null): MaintenanceType | null {
  if (!value) {
    return null;
  }

  return Object.values(MaintenanceType).includes(value as MaintenanceType)
    ? (value as MaintenanceType)
    : null;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

@Component({
  selector: 'app-service-order-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoDividerModule,
    PoWidgetModule,
  ],
  templateUrl: './service-order-form-page.html',
  styleUrl: './service-order-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceOrderFormPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly notificationService = inject(NotificationService);

  private readonly defaultVehicleId = this.activatedRoute.snapshot.queryParamMap.get('vehicleId');
  private readonly defaultPlanId = this.activatedRoute.snapshot.queryParamMap.get('planId');
  private readonly defaultType =
    parseMaintenanceTypeParam(this.activatedRoute.snapshot.queryParamMap.get('type')) ??
    MaintenanceType.CORRECTIVE;

  readonly typeOptions = MAINTENANCE_TYPE_OPTIONS;
  readonly photoRestrictions: PoUploadFileRestrictions = {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxFiles: 10,
    maxFileSize: 5 * 1024 * 1024,
  };
  readonly invoiceRestrictions: PoUploadFileRestrictions = {
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    maxFiles: 1,
    maxFileSize: 5 * 1024 * 1024,
  };

  readonly form = this.formBuilder.group({
    vehicleId: [this.defaultVehicleId ?? '', [Validators.required]],
    driverId: [''],
    planId: [this.defaultPlanId ?? ''],
    type: [this.defaultType as MaintenanceType, [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    workshop: ['', [Validators.maxLength(120)]],
    laborCost: [0 as number | null, [Validators.min(0)]],
    invoiceUrl: [''],
    notes: ['', [Validators.maxLength(4000)]],
    items: this.formBuilder.array([]),
  });

  vehicleOptions: PoComboOption[] = [];
  driverOptions: PoComboOption[] = [];
  planOptions: MaintenancePlanOption[] = [];
  order: ServiceOrderRecord | null = null;
  photoUploadFiles: PoUploadFile[] = [];
  invoiceUploadFiles: PoUploadFile[] = [];
  photoAttachments: ServiceOrderPhotoAttachment[] = [];
  initialPhotoAttachments: ServiceOrderPhotoAttachment[] = [];
  invoiceMeta: ServiceOrderInvoiceMeta | null = null;
  initialInvoiceUrl = '';
  isLoading = false;
  isLoadingOptions = false;
  isSaving = false;
  isReadingPhotos = false;
  isReadingInvoice = false;

  constructor() {
    this.addItem();
    this.bindFormReactions();
    this.loadFormContext();
  }

  protected get isEditMode(): boolean {
    return !!this.orderId;
  }

  protected get breadcrumb(): PoBreadcrumb {
    return {
      items: [
        { label: 'Dashboard', link: '/dashboard' },
        { label: 'Manutenção', link: '/maintenance' },
        {
          label: this.isEditMode ? 'Editar OS' : 'Nova OS',
          link: this.isEditMode
            ? `/maintenance/service-orders/${this.orderId}/edit`
            : '/maintenance/service-orders/new',
        },
      ],
    };
  }

  protected get title(): string {
    return this.isEditMode ? 'Editar ordem de serviço' : 'Nova ordem de serviço';
  }

  protected get subtitle(): string {
    return this.isEditMode
      ? 'Ajuste peças, anexos, mão de obra e contexto operacional sem quebrar o workflow atual.'
      : 'Abra a OS com itens dinâmicos, fotos, nota fiscal e custo consolidado da intervenção.';
  }

  protected get canManageServiceOrders(): boolean {
    return this.authService.hasAnyRole(SERVICE_ORDER_WORKFLOW_ROLES);
  }

  protected get canSave(): boolean {
    return (
      this.canManageServiceOrders &&
      !this.form.invalid &&
      !this.isLoading &&
      !this.isLoadingOptions &&
      !this.isSaving &&
      !this.isReadingPhotos &&
      !this.isReadingInvoice
    );
  }

  protected get itemControls(): AbstractControl[] {
    return this.itemsArray.controls;
  }

  protected get filteredPlanOptions(): PoComboOption[] {
    const selectedPlanId = this.form.controls.planId.value?.trim();
    const selectedVehicleId = this.form.controls.vehicleId.value?.trim();

    return this.planOptions
      .filter((plan) => {
        const matchesVehicle = !selectedVehicleId || plan.vehicleId === selectedVehicleId;
        return matchesVehicle && (plan.isActive || plan.id === selectedPlanId);
      })
      .map((plan) => ({
        label: plan.isActive ? plan.label : `${plan.label} (inativo)`,
        value: plan.id,
      }));
  }

  protected get selectedPlan(): MaintenancePlanOption | null {
    const planId = this.form.controls.planId.value?.trim();

    if (!planId) {
      return null;
    }

    return this.planOptions.find((plan) => plan.id === planId) ?? null;
  }

  protected get isTypeLockedByPlan(): boolean {
    return !!this.selectedPlan;
  }

  protected get hasPhotos(): boolean {
    return this.photoAttachments.length > 0;
  }

  protected get hasInvoice(): boolean {
    return Boolean(this.currentInvoiceUrl);
  }

  protected get currentInvoiceUrl(): string {
    return this.form.controls.invoiceUrl.value?.trim() ?? '';
  }

  protected get showInvoiceImagePreview(): boolean {
    return (
      this.resolveAttachmentKind(this.currentInvoiceUrl, this.invoiceMeta?.mimeType ?? null) ===
      'image'
    );
  }

  protected get previewVehicleLabel(): string {
    return (
      this.findOptionLabel(this.vehicleOptions, this.form.controls.vehicleId.value) ?? 'Sem veículo'
    );
  }

  protected get previewDriverLabel(): string {
    return (
      this.findOptionLabel(this.driverOptions, this.form.controls.driverId.value) ?? 'Sem motorista'
    );
  }

  protected get previewPlanLabel(): string {
    return this.selectedPlan?.label ?? 'Sem plano vinculado';
  }

  protected get currentTypeLabel(): string {
    return formatMaintenanceType(this.form.controls.type.value as MaintenanceTypeValue);
  }

  protected get currentStatusLabel(): string {
    return formatServiceOrderStatus(this.order?.status ?? ServiceOrderStatus.OPEN);
  }

  protected get totalItems(): number {
    return this.itemsArray.length;
  }

  protected get totalPhotos(): number {
    return this.photoAttachments.length;
  }

  protected get partsCostLabel(): string {
    return formatMaintenanceCurrency(this.partsCostValue);
  }

  protected get laborCostLabel(): string {
    return formatMaintenanceCurrency(this.laborCostValue);
  }

  protected get totalCostLabel(): string {
    return formatMaintenanceCurrency(this.totalCostValue);
  }

  protected get invoiceAttachmentName(): string {
    if (this.invoiceMeta) {
      return this.invoiceMeta.name;
    }

    return this.resolveAttachmentName(this.currentInvoiceUrl);
  }

  protected get invoiceAttachmentHelper(): string {
    if (!this.currentInvoiceUrl) {
      return 'Nenhuma nota fiscal anexada';
    }

    const source = this.invoiceMeta?.source === 'uploaded' ? 'Upload local' : 'Anexo persistido';

    if (this.invoiceMeta?.size != null) {
      return `${source} • ${this.formatFileSize(this.invoiceMeta.size)}`;
    }

    return source;
  }

  protected get canRestoreInvoice(): boolean {
    return !!this.initialInvoiceUrl && this.currentInvoiceUrl !== this.initialInvoiceUrl;
  }

  protected get canRestorePhotos(): boolean {
    if (this.initialPhotoAttachments.length !== this.photoAttachments.length) {
      return this.initialPhotoAttachments.length > 0;
    }

    return this.initialPhotoAttachments.some(
      (attachment, index) => attachment.url !== this.photoAttachments[index]?.url,
    );
  }

  cancel(): void {
    void this.router.navigate(['/maintenance']);
  }

  save(): void {
    this.submit(false);
  }

  saveAndCreateNew(): void {
    this.submit(true);
  }

  addItem(value?: ServiceOrderItemFormValue): void {
    this.itemsArray.push(this.createItemGroup(value));
  }

  removeItem(index: number): void {
    if (this.itemsArray.length === 1) {
      this.itemsArray.at(index).reset({
        description: '',
        quantity: 1,
        unitCost: 0,
        partNumber: '',
      });
      return;
    }

    this.itemsArray.removeAt(index);
  }

  async handlePhotoFilesChange(files: PoUploadFile[] | null | undefined): Promise<void> {
    this.photoUploadFiles = files ?? [];
    const selectedFiles = this.photoUploadFiles
      .map((file) => file.rawFile)
      .filter((file): file is File => !!file);

    if (selectedFiles.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, 10 - this.photoAttachments.length);
    const acceptedFiles = selectedFiles.slice(0, availableSlots);

    if (acceptedFiles.length === 0) {
      this.notificationService.warning('A OS já atingiu o limite de 10 fotos anexadas.');
      this.photoUploadFiles = [];
      return;
    }

    if (acceptedFiles.length < selectedFiles.length) {
      this.notificationService.warning(
        'Algumas fotos foram ignoradas para respeitar o limite de 10 anexos.',
      );
    }

    this.isReadingPhotos = true;

    try {
      const attachments = await Promise.all(
        acceptedFiles.map(async (file) => ({
          url: await this.readFileAsDataUrl(file),
          name: file.name,
          size: file.size,
          mimeType: file.type || null,
          source: 'uploaded' as const,
        })),
      );

      this.photoAttachments = [...this.photoAttachments, ...attachments];
      this.photoUploadFiles = [];
    } catch {
      this.notificationService.error('Não foi possível processar as fotos selecionadas.');
      this.photoUploadFiles = [];
    } finally {
      this.isReadingPhotos = false;
    }
  }

  removePhoto(index: number): void {
    this.photoAttachments = this.photoAttachments.filter(
      (_, currentIndex) => currentIndex !== index,
    );
  }

  restoreInitialPhotos(): void {
    this.photoAttachments = this.initialPhotoAttachments.map((attachment) => ({ ...attachment }));
    this.photoUploadFiles = [];
  }

  openPhoto(url: string): void {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
  }

  async handleInvoiceFilesChange(files: PoUploadFile[] | null | undefined): Promise<void> {
    this.invoiceUploadFiles = files ?? [];
    const selectedFile = this.invoiceUploadFiles[0]?.rawFile;

    if (!selectedFile) {
      return;
    }

    this.isReadingInvoice = true;

    try {
      const dataUrl = await this.readFileAsDataUrl(selectedFile);
      this.form.controls.invoiceUrl.setValue(dataUrl);
      this.form.controls.invoiceUrl.markAsDirty();
      this.form.controls.invoiceUrl.markAsTouched();
      this.invoiceMeta = {
        name: selectedFile.name,
        size: selectedFile.size,
        mimeType: selectedFile.type || null,
        source: 'uploaded',
      };
      this.invoiceUploadFiles = [];
    } catch {
      this.notificationService.error('Não foi possível processar a nota fiscal selecionada.');
      this.invoiceUploadFiles = [];
    } finally {
      this.isReadingInvoice = false;
    }
  }

  openInvoice(): void {
    if (!this.currentInvoiceUrl) {
      return;
    }

    globalThis.open(this.currentInvoiceUrl, '_blank', 'noopener,noreferrer');
  }

  clearInvoice(): void {
    this.invoiceUploadFiles = [];
    this.invoiceMeta = null;
    this.form.controls.invoiceUrl.setValue('');
    this.form.controls.invoiceUrl.markAsDirty();
    this.form.controls.invoiceUrl.markAsTouched();
  }

  restoreInitialInvoice(): void {
    if (!this.initialInvoiceUrl) {
      return;
    }

    this.invoiceUploadFiles = [];
    this.form.controls.invoiceUrl.setValue(this.initialInvoiceUrl);
    this.invoiceMeta = this.buildPersistedInvoiceMeta(this.initialInvoiceUrl);
  }

  getControlErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Campo obrigatório.'];
    }

    if (control.hasError('maxlength')) {
      return ['Texto acima do limite permitido.'];
    }

    if (control.hasError('min')) {
      return ['Valor abaixo do mínimo permitido.'];
    }

    return ['Corrija o valor informado.'];
  }

  getItemControlErrors(
    index: number,
    controlName: 'description' | 'quantity' | 'unitCost',
  ): string[] {
    const control = this.itemsArray.at(index)?.get(controlName);

    if (!control?.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Campo obrigatório.'];
    }

    if (control.hasError('maxlength')) {
      return ['Texto acima do limite permitido.'];
    }

    if (control.hasError('min')) {
      return ['Valor abaixo do mínimo permitido.'];
    }

    return ['Corrija o valor informado.'];
  }

  getItemTotalLabel(index: number): string {
    return formatMaintenanceCurrency(this.getItemTotalValue(index));
  }

  private get orderId(): string | null {
    return this.activatedRoute.snapshot.paramMap.get('id');
  }

  private get itemsArray(): FormArray {
    return this.form.controls.items as FormArray;
  }

  private get partsCostValue(): number {
    return roundToTwoDecimals(
      this.itemsArray.controls.reduce(
        (total, _, index) => total + this.getItemTotalValue(index),
        0,
      ),
    );
  }

  private get laborCostValue(): number {
    return roundToTwoDecimals(Number(this.form.controls.laborCost.value ?? 0));
  }

  private get totalCostValue(): number {
    return roundToTwoDecimals(this.partsCostValue + this.laborCostValue);
  }

  private bindFormReactions(): void {
    this.form.controls.planId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((planId) => {
        const selectedPlan = this.planOptions.find(
          (plan) => plan.id === String(planId ?? '').trim(),
        );

        if (!selectedPlan) {
          return;
        }

        this.form.patchValue(
          {
            vehicleId: selectedPlan.vehicleId,
            type: selectedPlan.type,
          },
          { emitEvent: false },
        );
      });

    this.form.controls.vehicleId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vehicleId) => {
        const selectedPlan = this.selectedPlan;

        if (selectedPlan && selectedPlan.vehicleId !== String(vehicleId ?? '').trim()) {
          this.form.controls.planId.setValue('');
        }
      });
  }

  private createItemGroup(value?: ServiceOrderItemFormValue) {
    return this.formBuilder.group({
      description: [value?.description ?? '', [Validators.required, Validators.maxLength(200)]],
      quantity: [value?.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
      unitCost: [value?.unitCost ?? 0, [Validators.required, Validators.min(0)]],
      partNumber: [value?.partNumber ?? ''],
    });
  }

  private loadFormContext(): void {
    this.isLoading = this.isEditMode;
    this.isLoadingOptions = true;

    forkJoin({
      vehicles: this.maintenanceService.listVehicleOptions(),
      drivers: this.maintenanceService.listDriverOptions(),
      plans: this.maintenanceService.listPlanOptions(),
      order: this.orderId ? this.maintenanceService.getServiceOrderById(this.orderId) : of(null),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.isLoadingOptions = false;
        }),
      )
      .subscribe({
        next: ({ vehicles, drivers, plans, order }) => {
          this.vehicleOptions = vehicles
            .map((vehicle) => ({
              label: `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`,
              value: vehicle.id,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
          this.driverOptions = drivers.map((driver) => ({
            label: driver.label,
            value: driver.id,
          }));
          this.planOptions = plans;

          if (order) {
            this.applyOrder(order);
            return;
          }

          if (this.defaultPlanId) {
            const defaultPlan = this.planOptions.find((plan) => plan.id === this.defaultPlanId);

            if (defaultPlan) {
              this.form.patchValue({
                vehicleId: defaultPlan.vehicleId,
                planId: defaultPlan.id,
                type: defaultPlan.type,
              });
            }
          }
        },
        error: () => {
          this.notificationService.error(
            'Não foi possível carregar o formulário da ordem de serviço.',
          );
        },
      });
  }

  private applyOrder(order: ServiceOrderRecord): void {
    this.order = order;
    this.initialInvoiceUrl = order.invoiceUrl ?? '';
    this.invoiceMeta = order.invoiceUrl ? this.buildPersistedInvoiceMeta(order.invoiceUrl) : null;
    this.initialPhotoAttachments = order.photos.map((photoUrl) =>
      this.buildPersistedPhotoAttachment(photoUrl),
    );
    this.photoAttachments = this.initialPhotoAttachments.map((attachment) => ({ ...attachment }));

    this.itemsArray.clear();

    if (order.items.length > 0) {
      order.items.forEach((item) => {
        this.addItem({
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          partNumber: item.partNumber,
        });
      });
    } else {
      this.addItem();
    }

    this.form.patchValue({
      vehicleId: order.vehicleId,
      driverId: order.driverId ?? '',
      planId: order.planId ?? '',
      type: order.type,
      description: order.description,
      workshop: order.workshop ?? '',
      laborCost: order.laborCost ?? 0,
      invoiceUrl: order.invoiceUrl ?? '',
      notes: order.notes ?? '',
    });
  }

  private submit(createAnother: boolean): void {
    if (!this.canManageServiceOrders) {
      this.notificationService.warning('Somente perfis gestores podem salvar ordens de serviço.');
      return;
    }

    if (this.form.invalid || this.isSaving || this.isReadingPhotos || this.isReadingInvoice) {
      this.form.markAllAsTouched();
      this.itemsArray.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const request$ =
      this.isEditMode && this.orderId
        ? this.maintenanceService.updateServiceOrder(this.orderId, payload)
        : this.maintenanceService.createServiceOrder(payload);

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
            this.isEditMode
              ? 'Ordem de serviço atualizada com sucesso.'
              : 'Ordem de serviço criada com sucesso.',
          );

          if (createAnother) {
            this.resetForNewRecord();
            return;
          }

          void this.router.navigate(['/maintenance']);
        },
        error: () => {
          this.notificationService.error('Não foi possível salvar a ordem de serviço.');
        },
      });
  }

  private resetForNewRecord(): void {
    this.order = null;
    this.initialInvoiceUrl = '';
    this.invoiceMeta = null;
    this.invoiceUploadFiles = [];
    this.initialPhotoAttachments = [];
    this.photoAttachments = [];
    this.photoUploadFiles = [];
    this.form.reset({
      vehicleId: this.defaultVehicleId ?? '',
      driverId: '',
      planId: this.defaultPlanId ?? '',
      type: this.defaultType,
      description: '',
      workshop: '',
      laborCost: 0,
      invoiceUrl: '',
      notes: '',
    });
    this.itemsArray.clear();
    this.addItem();

    if (this.isEditMode) {
      void this.router.navigate(['/maintenance/service-orders/new'], {
        queryParams: this.buildDefaultQueryParams(),
      });
    }
  }

  private buildPayload(): ServiceOrderFormPayload {
    const raw = this.form.getRawValue();

    return {
      vehicleId: raw.vehicleId?.trim() ?? '',
      driverId: raw.driverId?.trim() || null,
      planId: raw.planId?.trim() || null,
      type: raw.type as MaintenanceTypeValue,
      status: this.order?.status ?? ServiceOrderStatus.OPEN,
      description: raw.description?.trim() ?? '',
      workshop: raw.workshop?.trim() || null,
      laborCost: this.laborCostValue,
      partsCost: this.partsCostValue,
      totalCost: this.totalCostValue,
      notes: raw.notes?.trim() || null,
      photos: this.photoAttachments.map((photo) => photo.url),
      invoiceUrl: raw.invoiceUrl?.trim() || null,
      items: this.itemsArray.controls.map((control) => ({
        description: String(control.get('description')?.value ?? '').trim(),
        quantity: Number(control.get('quantity')?.value ?? 0),
        unitCost: Number(control.get('unitCost')?.value ?? 0),
        totalCost: roundToTwoDecimals(
          Number(control.get('quantity')?.value ?? 0) * Number(control.get('unitCost')?.value ?? 0),
        ),
        partNumber: String(control.get('partNumber')?.value ?? '').trim() || null,
      })),
    };
  }

  private buildDefaultQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};

    if (this.defaultVehicleId) {
      params['vehicleId'] = this.defaultVehicleId;
    }

    if (this.defaultPlanId) {
      params['planId'] = this.defaultPlanId;
    }

    if (this.defaultType) {
      params['type'] = this.defaultType;
    }

    return params;
  }

  private getItemTotalValue(index: number): number {
    const control = this.itemsArray.at(index);
    const quantity = Number(control.get('quantity')?.value ?? 0);
    const unitCost = Number(control.get('unitCost')?.value ?? 0);
    return roundToTwoDecimals(quantity * unitCost);
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

  private buildPersistedPhotoAttachment(photoUrl: string): ServiceOrderPhotoAttachment {
    return {
      url: photoUrl,
      name: this.resolveAttachmentName(photoUrl),
      size: null,
      mimeType: this.resolveMimeTypeFromUrl(photoUrl),
      source: 'persisted',
    };
  }

  private buildPersistedInvoiceMeta(invoiceUrl: string): ServiceOrderInvoiceMeta {
    return {
      name: this.resolveAttachmentName(invoiceUrl),
      size: null,
      mimeType: this.resolveMimeTypeFromUrl(invoiceUrl),
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

    if (normalizedMimeType === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(fileUrl)) {
      return 'pdf';
    }

    return 'file';
  }

  private resolveAttachmentName(fileUrl: string): string {
    if (!fileUrl) {
      return 'arquivo';
    }

    if (fileUrl.startsWith('data:')) {
      const mimeType = this.resolveMimeTypeFromUrl(fileUrl);

      if (mimeType === 'application/pdf') {
        return 'anexo.pdf';
      }

      if (mimeType?.startsWith('image/')) {
        const extension = mimeType.split('/')[1] ?? 'arquivo';
        return `anexo.${extension}`;
      }

      return 'anexo-local';
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
