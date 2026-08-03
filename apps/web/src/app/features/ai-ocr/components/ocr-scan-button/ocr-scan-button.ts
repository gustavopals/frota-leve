import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { PoButtonModule } from '@po-ui/ng-components';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { AiOcrService } from '../../ai-ocr.service';
import type { OcrFuelData, OcrInvoiceData, OcrResponse } from '../../ai-ocr.types';

export type OcrScanKind = 'fuel' | 'invoice';

/**
 * Botão "Escanear" para cupom de abastecimento ou nota fiscal (TASK 3.6.5/3.6.6).
 *
 * O input file usa `capture="environment"`: no celular abre a câmera traseira,
 * no desktop cai no seletor de arquivos — sem precisar de dois fluxos.
 */
@Component({
  selector: 'app-ocr-scan-button',
  templateUrl: './ocr-scan-button.html',
  styleUrl: './ocr-scan-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoButtonModule],
})
export class OcrScanButton {
  private readonly service = inject(AiOcrService);
  private readonly notification = inject(NotificationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly kind = input<OcrScanKind>('fuel');
  readonly label = input('Escanear cupom');

  readonly scanned = output<OcrFuelData | OcrInvoiceData>();

  loading = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.loading = true;

    // Union explícita: os dois métodos devolvem envelopes de tipos diferentes.
    const request: Observable<OcrResponse<OcrFuelData | OcrInvoiceData>> =
      this.kind() === 'fuel' ? this.service.scanFuelReceipt(file) : this.service.scanInvoice(file);

    request
      .pipe(
        finalize(() => {
          this.loading = false;
          // Limpa para permitir reenviar o mesmo arquivo depois de corrigir a foto.
          input.value = '';
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          const data = response.data.data;

          if (!data) {
            this.notification.warning(
              'Não foi possível ler o documento. Preencha os campos manualmente.',
            );
            return;
          }

          if (response.data.confidence < 0.5) {
            this.notification.warning('Leitura com baixa confiança. Confira todos os campos.');
          } else {
            this.notification.success('Documento lido. Confira os campos destacados.');
          }

          this.scanned.emit(data);
        },
        error: () => this.notification.error('Falha ao processar a imagem.'),
      });
  }
}
