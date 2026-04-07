import { Component, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import type {
  PoModalAction,
  PoTableColumn,
  PoUploadFile,
  PoUploadFileRestrictions,
} from '@po-ui/ng-components';
import { PoModalComponent } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { VEHICLE_IMPORT_TEMPLATE, VEHICLE_STATUS_TABLE_LABELS } from '../../vehicles.constants';
import { VehiclesService } from '../../vehicles.service';
import type { VehicleImportPreviewResponse } from '../../vehicles.types';
import { downloadBlob, formatVehicleKilometers } from '../../vehicles.utils';

type ImportErrorTableItem = {
  row: number;
  plate: string;
  message: string;
};

@Component({
  selector: 'app-vehicle-import-modal',
  standalone: false,
  templateUrl: './vehicle-import-modal.html',
  styleUrl: './vehicle-import-modal.scss',
})
export class VehicleImportModal {
  @Output() readonly completed = new EventEmitter<void>();
  @ViewChild('importModal', { static: true }) private readonly importModal?: PoModalComponent;

  private readonly vehiclesService = inject(VehiclesService);
  private readonly notificationService = inject(NotificationService);

  readonly fileRestrictions: PoUploadFileRestrictions = {
    allowedExtensions: ['.csv', '.xlsx'],
    maxFiles: 1,
    maxFileSize: 10 * 1024 * 1024,
  };

  readonly previewColumns: PoTableColumn[] = [
    { property: 'row', label: 'Linha', width: '80px' },
    { property: 'plate', label: 'Placa', width: '120px' },
    { property: 'brand', label: 'Marca', width: '150px' },
    { property: 'model', label: 'Modelo', width: '220px' },
    { property: 'yearModel', label: 'Ano', type: 'number', width: '90px' },
    {
      property: 'status',
      label: 'Status',
      type: 'label',
      labels: VEHICLE_STATUS_TABLE_LABELS,
      width: '140px',
    },
    { property: 'currentMileage', label: 'Km', type: 'columnTemplate', width: '130px' },
  ];

  readonly errorColumns: PoTableColumn[] = [
    { property: 'row', label: 'Linha', width: '80px' },
    { property: 'plate', label: 'Placa', width: '120px' },
    { property: 'message', label: 'Validação', width: '420px' },
  ];

  readonly mileageColumnProperty = 'currentMileage';

  uploadFiles: PoUploadFile[] = [];
  previewResult: VehicleImportPreviewResponse | null = null;
  isAnalyzing = false;
  isImporting = false;

  protected get primaryAction(): PoModalAction {
    const isReadyToImport = !!this.previewResult;

    return {
      label: this.getPrimaryActionLabel(isReadyToImport),
      disabled: this.getPrimaryActionDisabled(isReadyToImport),
      action: () => {
        if (isReadyToImport) {
          this.confirmImport();
          return;
        }

        this.analyzeFile();
      },
    };
  }

  protected get secondaryAction(): PoModalAction {
    return {
      label: 'Fechar',
      disabled: this.isAnalyzing || this.isImporting,
      action: () => {
        this.close();
      },
    };
  }

  protected get errorRows(): ImportErrorTableItem[] {
    if (!this.previewResult) {
      return [];
    }

    return this.previewResult.errors.map((error) => ({
      row: error.row,
      plate: error.plate ?? 'Sem placa',
      message: error.errors.join(' | '),
    }));
  }

  protected get selectedFileName(): string {
    return this.uploadFiles[0]?.name ?? 'Nenhum arquivo selecionado';
  }

  open(): void {
    this.resetState();
    this.importModal?.open();
  }

  close(): void {
    this.importModal?.close();
  }

  handleFilesChange(files: PoUploadFile[] | null | undefined): void {
    this.uploadFiles = files ?? [];
    this.previewResult = null;
  }

  formatMileage(value: number): string {
    return formatVehicleKilometers(value);
  }

  downloadTemplate(): void {
    const blob = new Blob([VEHICLE_IMPORT_TEMPLATE], {
      type: 'text/csv;charset=utf-8',
    });

    downloadBlob('template-veiculos.csv', blob);
  }

  private analyzeFile(): void {
    const file = this.uploadFiles[0]?.rawFile;

    if (!file || this.isAnalyzing) {
      this.notificationService.warning('Selecione um arquivo CSV ou XLSX antes de validar.');
      return;
    }

    this.isAnalyzing = true;

    this.vehiclesService
      .previewImport(file)
      .pipe(
        finalize(() => {
          this.isAnalyzing = false;
        }),
      )
      .subscribe({
        next: (preview) => {
          this.previewResult = preview;
          this.notificationService.info(
            'Pré-validação concluída. Revise os itens antes de importar.',
          );
        },
      });
  }

  private confirmImport(): void {
    const file = this.uploadFiles[0]?.rawFile;

    if (!file || this.isImporting) {
      return;
    }

    this.isImporting = true;

    this.vehiclesService
      .import(file)
      .pipe(
        finalize(() => {
          this.isImporting = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.notificationService.success(
            `${result.importedCount} veículo(s) importado(s) com sucesso.`,
          );
          this.completed.emit();
          this.close();
        },
      });
  }

  private getPrimaryActionDisabled(isReadyToImport: boolean): boolean {
    if (this.isAnalyzing || this.isImporting) {
      return true;
    }

    if (!isReadyToImport) {
      return this.uploadFiles.length === 0;
    }

    return (this.previewResult?.readyCount ?? 0) === 0;
  }

  private getPrimaryActionLabel(isReadyToImport: boolean): string {
    if (this.isAnalyzing) {
      return 'Validando...';
    }

    if (this.isImporting) {
      return 'Importando...';
    }

    return isReadyToImport ? 'Confirmar importação' : 'Validar arquivo';
  }

  private resetState(): void {
    this.uploadFiles = [];
    this.previewResult = null;
    this.isAnalyzing = false;
    this.isImporting = false;
  }
}
