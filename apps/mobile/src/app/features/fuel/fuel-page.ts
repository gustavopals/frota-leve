import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { FuelSubmission } from '../../core/models/mobile.models';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { ContextStoreService } from '../../core/services/context-store.service';
import { MobileApiService } from '../../core/services/mobile-api.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';

interface OcrFuelData {
  liters: number | null;
  totalCost: number | null;
  pricePerLiter: number | null;
  gasStation: string | null;
  fuelType: string | null;
  date: string | null;
  odometerKm: number | null;
  confidence: number;
  fieldsConfidence: Record<string, number>;
}

interface OcrPayload {
  data: OcrFuelData | null;
  confidence: number;
}

@Component({
  selector: 'app-fuel-page',
  imports: [FormsModule],
  templateUrl: './fuel-page.html',
  styleUrl: './fuel-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FuelPage {
  private readonly api = inject(MobileApiService);
  private readonly queue = inject(OfflineQueueService);
  readonly connectivity = inject(ConnectivityService);
  readonly contextStore = inject(ContextStoreService);

  mileage = this.contextStore.context()?.vehicle?.currentMileage ?? 0;
  liters: number | null = null;
  pricePerLiter: number | null = null;
  totalCost: number | null = null;
  fuelType = this.contextStore.context()?.vehicle?.fuelType ?? 'GASOLINE';
  gasStation = '';
  fullTank = true;
  notes = '';
  receipt: File | null = null;
  receiptPreview: string | null = null;

  readonly saving = signal(false);
  readonly scanning = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly confidence = signal<Record<string, number>>({});

  selectReceipt(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    this.receipt = file;
    this.receiptPreview = URL.createObjectURL(file);
    this.message.set(null);
    this.error.set(null);
  }

  recalculate(source: 'liters' | 'price' | 'total'): void {
    if (source !== 'total' && this.liters && this.pricePerLiter) {
      this.totalCost = Number((this.liters * this.pricePerLiter).toFixed(2));
    } else if (source === 'total' && this.liters && this.totalCost) {
      this.pricePerLiter = Number((this.totalCost / this.liters).toFixed(3));
    }
  }

  fieldClass(field: string): string {
    const value = this.confidence()[field];
    if (value == null) return '';
    if (value >= 0.8) return 'is-high-confidence';
    return value >= 0.5 ? 'is-review-confidence' : '';
  }

  async scanReceipt(): Promise<void> {
    if (!this.receipt || !this.connectivity.online()) {
      this.error.set('O OCR precisa de uma foto e conexão com a internet.');
      return;
    }

    this.scanning.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.api.extractFuelReceipt(this.receipt, this.receipt.name),
      );
      const payload = response.data as unknown as OcrPayload;
      const data = payload.data;
      if (!data) {
        this.error.set('Não foi possível ler o cupom. Preencha os campos manualmente.');
        return;
      }

      if (data.liters != null) this.liters = data.liters;
      if (data.totalCost != null) this.totalCost = data.totalCost;
      if (data.pricePerLiter != null) this.pricePerLiter = data.pricePerLiter;
      if (data.gasStation) this.gasStation = data.gasStation;
      if (data.odometerKm != null) this.mileage = Math.round(data.odometerKm);
      if (data.fuelType && data.fuelType !== 'FLEX') this.fuelType = data.fuelType;
      this.confidence.set(data.fieldsConfidence);
      this.message.set(
        data.confidence >= 0.8
          ? 'Cupom lido. Confira os dados antes de enviar.'
          : 'Leitura parcial. Revise os campos destacados.',
      );
    } catch (error) {
      this.error.set(this.apiError(error, 'OCR indisponível. Preencha os campos manualmente.'));
    } finally {
      this.scanning.set(false);
    }
  }

  async submit(): Promise<void> {
    if (!this.liters || !this.pricePerLiter || !this.totalCost || this.mileage < 0) {
      this.error.set('Preencha quilometragem, litros, preço e valor total.');
      return;
    }

    const currentMileage = this.contextStore.context()?.vehicle?.currentMileage ?? 0;
    if (this.mileage < currentMileage) {
      this.error.set(`A quilometragem deve ser igual ou maior que ${currentMileage} km.`);
      return;
    }

    const payload: FuelSubmission = {
      date: new Date().toISOString(),
      mileage: Math.round(this.mileage),
      liters: this.liters,
      pricePerLiter: this.pricePerLiter,
      totalCost: this.totalCost,
      fuelType: this.fuelType,
      fullTank: this.fullTank,
      gasStation: this.gasStation.trim() || null,
      notes: this.notes.trim() || null,
    };
    const receipt = this.receipt ? { blob: this.receipt, fileName: this.receipt.name } : null;

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      if (!this.connectivity.online()) {
        await this.queue.enqueue({ type: 'fuel', payload, receipt });
        this.message.set('Abastecimento salvo. Enviaremos quando a conexão voltar.');
      } else {
        const receiptUrl = receipt
          ? (await firstValueFrom(this.api.upload(receipt.blob, receipt.fileName))).data.url
          : null;
        await firstValueFrom(this.api.submitFuel({ ...payload, receiptUrl }));
        this.message.set('Abastecimento registrado com sucesso.');
        this.contextStore.refresh(true).subscribe();
      }
      this.reset();
      navigator.vibrate?.([40, 25, 40]);
    } catch (error) {
      if (receipt || !this.connectivity.online()) {
        await this.queue.enqueue({ type: 'fuel', payload, receipt });
        this.message.set('A conexão oscilou. O registro ficou pendente para sincronização.');
      } else {
        this.error.set(this.apiError(error, 'Não foi possível registrar o abastecimento.'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private reset(): void {
    this.liters = null;
    this.pricePerLiter = null;
    this.totalCost = null;
    this.gasStation = '';
    this.notes = '';
    this.receipt = null;
    this.receiptPreview = null;
    this.confidence.set({});
  }

  private apiError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    return (error.error as { error?: { message?: string } })?.error?.message ?? fallback;
  }
}
