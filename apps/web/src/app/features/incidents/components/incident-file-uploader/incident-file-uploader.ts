import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { PoButtonModule, PoTagModule, PoTagType } from '@po-ui/ng-components';
import { buildPendingFile, formatFileSize, isImageFile } from '../../incidents.utils';
import type { PendingFile } from '../../incidents.types';

@Component({
  selector: 'app-incident-file-uploader',
  imports: [PoButtonModule, PoTagModule],
  templateUrl: './incident-file-uploader.html',
  styleUrl: './incident-file-uploader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentFileUploader {
  readonly label = input<string>('Arquivos');
  readonly accept = input<string>('image/*,application/pdf,.doc,.docx');
  readonly helpText = input<string>('');
  readonly maxFiles = input<number>(20);
  readonly disabled = input<boolean>(false);

  readonly filesChanged = output<PendingFile[]>();
  readonly fileRemoved = output<number>();

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly cdr = inject(ChangeDetectorRef);

  pendingFiles: PendingFile[] = [];
  isDragOver = false;

  protected get tagType(): PoTagType {
    return PoTagType.Neutral;
  }

  protected get canAddMore(): boolean {
    return !this.disabled() && this.pendingFiles.length < this.maxFiles();
  }

  triggerPick(): void {
    if (!this.canAddMore) return;
    this.fileInput().nativeElement.click();
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.addFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (!this.canAddMore) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  removeFile(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
    this.fileRemoved.emit(index);
    this.filesChanged.emit(this.pendingFiles);
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.pendingFiles = [];
    this.filesChanged.emit([]);
    this.cdr.markForCheck();
  }

  private addFiles(files: File[]): void {
    const remaining = this.maxFiles() - this.pendingFiles.length;
    const toAdd = files.slice(0, remaining);

    const newPending = toAdd.map(buildPendingFile);
    this.pendingFiles = [...this.pendingFiles, ...newPending];

    // Gera preview assíncrono para imagens
    newPending.forEach((p, i) => {
      const globalIndex = this.pendingFiles.length - newPending.length + i;
      if (p.isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          this.pendingFiles[globalIndex] = {
            ...this.pendingFiles[globalIndex],
            preview: reader.result as string,
          };
          this.cdr.markForCheck();
        };
        reader.readAsDataURL(p.file);
      }
    });

    this.filesChanged.emit(this.pendingFiles);
    this.cdr.markForCheck();
  }

  // exposto para uso externo
  readonly formatFileSize = formatFileSize;
  readonly isImageFile = isImageFile;
}
