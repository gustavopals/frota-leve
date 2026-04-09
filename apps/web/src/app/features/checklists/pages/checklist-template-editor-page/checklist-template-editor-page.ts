import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import type { PoBreadcrumb, PoComboOption, PoPageAction } from '@po-ui/ng-components';
import { PoButtonModule, PoFieldModule, PoLoadingModule, PoPageModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import {
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_CATEGORY_OPTIONS,
} from '../../../vehicles/vehicles.constants';
import { ChecklistsService } from '../../checklists.service';
import type {
  ChecklistTemplateFilters,
  ChecklistTemplatePayload,
  ChecklistTemplateRecord,
} from '../../checklists.types';

type ChecklistEditorMode = 'new' | 'editing';

type ChecklistTemplateListItem = ChecklistTemplateRecord & {
  categoryLabel: string;
  updatedAtLabel: string;
};

type ChecklistSummaryMetric = {
  label: string;
  value: string;
  detail: string;
};

function reorderFormArray(formArray: FormArray, fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) {
    return;
  }

  const control = formArray.at(fromIndex);
  formArray.removeAt(fromIndex, { emitEvent: false });
  formArray.insert(toIndex, control, { emitEvent: false });
}

@Component({
  selector: 'app-checklist-template-editor-page',
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    PoPageModule,
    PoFieldModule,
    PoButtonModule,
    PoLoadingModule,
  ],
  templateUrl: './checklist-template-editor-page.html',
  styleUrl: './checklist-template-editor-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistTemplateEditorPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly checklistsService = inject(ChecklistsService);

  readonly breadcrumb: PoBreadcrumb = {
    items: [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Checklists', link: '/checklists' },
    ],
  };
  readonly filterCategoryOptions: PoComboOption[] = [
    { label: 'Todas as categorias', value: '' },
    ...VEHICLE_CATEGORY_OPTIONS,
  ];
  readonly editorCategoryOptions: PoComboOption[] = [
    { label: 'Sem restrição de categoria', value: '' },
    ...VEHICLE_CATEGORY_OPTIONS,
  ];

  readonly filtersForm = this.formBuilder.group({
    search: [''],
    vehicleCategory: ['' as VehicleCategory | ''],
  });

  readonly editorForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    vehicleCategory: ['' as VehicleCategory | ''],
    items: this.formBuilder.array([]),
  });

  templates: ChecklistTemplateListItem[] = [];
  selectedTemplateId: string | null = null;
  editorMode: ChecklistEditorMode = 'new';
  isLoadingList = false;
  isSaving = false;
  hasLoadedOnce = false;
  hasLoadError = false;

  constructor() {
    this.startNewTemplate(false);
    this.loadTemplates();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Novo template',
        action: () => this.startNewTemplate(),
      },
      {
        label: 'Histórico',
        action: () => {
          void this.router.navigate(['/checklists/history']);
        },
      },
      {
        label: this.isLoadingList ? 'Atualizando...' : 'Atualizar lista',
        disabled: this.isLoadingList,
        action: () => this.loadTemplates(),
      },
    ];
  }

  protected get canSave(): boolean {
    return !this.editorForm.invalid && !this.isSaving && !this.isLoadingList;
  }

  protected get canDelete(): boolean {
    return !!this.selectedTemplateId && !this.isSaving;
  }

  protected get itemControls(): AbstractControl[] {
    return this.itemsArray.controls;
  }

  protected get headerTitle(): string {
    return this.editorMode === 'editing' ? 'Editar template ativo' : 'Novo template de checklist';
  }

  protected get headerDescription(): string {
    return this.editorMode === 'editing'
      ? 'Reordene os itens, ajuste obrigatoriedade e defina evidência fotográfica sem perder a sequência operacional.'
      : 'Monte o template na ordem em que o motorista deve inspecionar o veículo.';
  }

  protected get summaryMetrics(): ChecklistSummaryMetric[] {
    const items = this.itemsArray.controls;
    const totalItems = items.length;
    const requiredItems = items.filter((control) => control.get('required')?.value === true).length;
    const photoRequiredItems = items.filter(
      (control) => control.get('photoRequired')?.value === true,
    ).length;

    return [
      {
        label: 'Itens no template',
        value: String(totalItems),
        detail: totalItems === 1 ? '1 etapa em edição' : `${totalItems} etapas em edição`,
      },
      {
        label: 'Obrigatórios',
        value: String(requiredItems),
        detail: 'Itens que definem a checagem mínima',
      },
      {
        label: 'Com foto',
        value: String(photoRequiredItems),
        detail: 'Evidências que exigem registro visual',
      },
    ];
  }

  protected get activeTemplateLabel(): string {
    if (this.editorMode === 'new') {
      return 'Template em branco';
    }

    const selected = this.templates.find((template) => template.id === this.selectedTemplateId);
    return selected?.name ?? 'Template selecionado';
  }

  protected get editorDirty(): boolean {
    return this.editorForm.dirty;
  }

  protected trackTemplate(_: number, template: ChecklistTemplateListItem): string {
    return template.id;
  }

  protected trackItemControl(_: number, control: AbstractControl): AbstractControl {
    return control;
  }

  protected applyFilters(): void {
    if (!this.confirmDiscardIfNeeded()) {
      return;
    }

    this.loadTemplates();
  }

  protected clearFilters(): void {
    if (!this.confirmDiscardIfNeeded()) {
      return;
    }

    this.filtersForm.reset({
      search: '',
      vehicleCategory: '',
    });

    this.loadTemplates();
  }

  protected selectTemplate(template: ChecklistTemplateListItem): void {
    if (template.id === this.selectedTemplateId) {
      return;
    }

    if (!this.confirmDiscardIfNeeded()) {
      return;
    }

    this.selectedTemplateId = template.id;
    this.editorMode = 'editing';
    this.patchEditorForm(template);
  }

  protected startNewTemplate(shouldConfirm = true): void {
    if (shouldConfirm && !this.confirmDiscardIfNeeded()) {
      return;
    }

    this.editorMode = 'new';
    this.selectedTemplateId = null;
    this.editorForm.reset(
      {
        name: '',
        vehicleCategory: '',
      },
      { emitEvent: false },
    );
    this.itemsArray.clear({ emitEvent: false });
    this.addItem(false);
    this.editorForm.markAsPristine();
    this.cdr.markForCheck();
  }

  protected addItem(markDirty = true): void {
    this.itemsArray.push(this.createItemGroup(), { emitEvent: false });

    if (markDirty) {
      this.itemsArray.markAsDirty();
      this.editorForm.markAsDirty();
    }

    this.cdr.markForCheck();
  }

  protected removeItem(index: number): void {
    if (this.itemsArray.length === 1) {
      this.notificationService.warning('O template precisa manter ao menos um item.');
      return;
    }

    this.itemsArray.removeAt(index);
    this.itemsArray.markAsDirty();
    this.editorForm.markAsDirty();
    this.cdr.markForCheck();
  }

  protected duplicateItem(index: number): void {
    const source = this.itemsArray.at(index);

    this.itemsArray.insert(
      index + 1,
      this.createItemGroup({
        label: source.get('label')?.value ?? '',
        required: source.get('required')?.value ?? true,
        photoRequired: source.get('photoRequired')?.value ?? false,
      }),
      { emitEvent: false },
    );
    this.itemsArray.markAsDirty();
    this.editorForm.markAsDirty();
    this.cdr.markForCheck();
  }

  protected dropItem(event: CdkDragDrop<AbstractControl[]>): void {
    reorderFormArray(this.itemsArray, event.previousIndex, event.currentIndex);
    this.itemsArray.markAsDirty();
    this.editorForm.markAsDirty();
    this.cdr.markForCheck();
  }

  protected resetEditor(): void {
    if (this.editorMode === 'editing') {
      const selected = this.templates.find((template) => template.id === this.selectedTemplateId);

      if (selected) {
        this.patchEditorForm(selected);
        return;
      }
    }

    this.startNewTemplate(false);
  }

  protected saveTemplate(): void {
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      this.notificationService.warning('Revise os campos obrigatórios do template.');
      return;
    }

    const payload = this.toPayload();

    this.isSaving = true;
    this.cdr.markForCheck();

    const request$ =
      this.editorMode === 'editing' && this.selectedTemplateId
        ? this.checklistsService.replaceTemplate(this.selectedTemplateId, payload)
        : this.checklistsService.createTemplate(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (template) => {
          this.notificationService.success(
            this.editorMode === 'editing'
              ? 'Template atualizado com sucesso.'
              : 'Template criado com sucesso.',
          );
          this.editorMode = 'editing';
          this.selectedTemplateId = template.id;
          this.loadTemplates(template.id);
        },
      });
  }

  protected deleteTemplate(): void {
    if (!this.selectedTemplateId) {
      return;
    }

    const selected = this.templates.find((template) => template.id === this.selectedTemplateId);
    const confirmed = globalThis.confirm(
      `Excluir o template "${selected?.name ?? 'selecionado'}"? Essa ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    this.checklistsService
      .deleteTemplate(this.selectedTemplateId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Template removido com sucesso.');
          this.startNewTemplate(false);
          this.loadTemplates();
        },
      });
  }

  protected getTemplateCategoryLabel(value: VehicleCategory | null): string {
    if (!value) {
      return 'Todas as categorias';
    }

    return VEHICLE_CATEGORY_LABELS[value];
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private get itemsArray(): FormArray {
    return this.editorForm.controls.items as FormArray;
  }

  private createItemGroup(value?: { label?: string; required?: boolean; photoRequired?: boolean }) {
    return this.formBuilder.group({
      label: [value?.label ?? '', [Validators.required, Validators.maxLength(200)]],
      required: [value?.required ?? true],
      photoRequired: [value?.photoRequired ?? false],
    });
  }

  private loadTemplates(preselectTemplateId?: string): void {
    this.isLoadingList = true;
    this.hasLoadError = false;
    this.cdr.markForCheck();

    this.checklistsService
      .listTemplates(this.getFilters())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingList = false;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.templates = response.items.map((template) => ({
            ...template,
            categoryLabel: this.getTemplateCategoryLabel(template.vehicleCategory),
            updatedAtLabel: this.formatDateTime(template.updatedAt),
          }));
          this.hasLoadError = false;
          this.resolveSelection(preselectTemplateId);
          this.cdr.markForCheck();
        },
        error: () => {
          this.templates = [];
          this.hasLoadError = true;
          this.cdr.markForCheck();
        },
      });
  }

  private resolveSelection(preselectTemplateId?: string): void {
    const desiredTemplateId = preselectTemplateId ?? this.selectedTemplateId;

    if (desiredTemplateId) {
      const selected = this.templates.find((template) => template.id === desiredTemplateId);

      if (selected) {
        this.selectedTemplateId = selected.id;
        this.editorMode = 'editing';
        this.patchEditorForm(selected);
        return;
      }
    }

    if (this.editorMode === 'new') {
      this.cdr.markForCheck();
      return;
    }

    const firstTemplate = this.templates[0];

    if (firstTemplate) {
      this.selectedTemplateId = firstTemplate.id;
      this.editorMode = 'editing';
      this.patchEditorForm(firstTemplate);
      return;
    }

    this.startNewTemplate(false);
  }

  private patchEditorForm(template: ChecklistTemplateRecord): void {
    this.editorForm.reset(
      {
        name: template.name,
        vehicleCategory: template.vehicleCategory ?? '',
      },
      { emitEvent: false },
    );
    this.itemsArray.clear({ emitEvent: false });

    template.items
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .forEach((item) => {
        this.itemsArray.push(
          this.createItemGroup({
            label: item.label,
            required: item.required,
            photoRequired: item.photoRequired,
          }),
          { emitEvent: false },
        );
      });

    if (this.itemsArray.length === 0) {
      this.addItem(false);
    }

    this.editorForm.markAsPristine();
    this.cdr.markForCheck();
  }

  private getFilters(): ChecklistTemplateFilters {
    const filtersValue = this.filtersForm.getRawValue();

    return {
      search: filtersValue.search?.trim() || undefined,
      vehicleCategory: filtersValue.vehicleCategory || '',
    };
  }

  private toPayload(): ChecklistTemplatePayload {
    const rawValue = this.editorForm.getRawValue();
    const itemValues = this.itemsArray.getRawValue() as Array<{
      label?: string | null;
      required?: boolean | null;
      photoRequired?: boolean | null;
    }>;

    return {
      name: String(rawValue.name ?? '').trim(),
      vehicleCategory: rawValue.vehicleCategory || null,
      items: itemValues.map((item) => ({
        label: String(item.label ?? '').trim(),
        required: item.required ?? true,
        photoRequired: item.photoRequired ?? false,
      })),
    };
  }

  private confirmDiscardIfNeeded(): boolean {
    if (!this.editorDirty) {
      return true;
    }

    return globalThis.confirm(
      'Existem alterações não salvas no editor. Deseja descartar e continuar?',
    );
  }
}
