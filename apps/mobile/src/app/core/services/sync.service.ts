import { effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { ContextStoreService } from './context-store.service';
import { MobileApiService } from './mobile-api.service';
import {
  OfflineQueueService,
  type QueuedOperation,
  type StoredUpload,
} from './offline-queue.service';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível sincronizar agora';
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly connectivity = inject(ConnectivityService);
  private readonly queue = inject(OfflineQueueService);
  private readonly api = inject(MobileApiService);
  private readonly contextStore = inject(ContextStoreService);
  private readonly syncingState = signal(false);
  private readonly lastSyncState = signal<string | null>(null);

  readonly syncing = this.syncingState.asReadonly();
  readonly lastSyncAt = this.lastSyncState.asReadonly();
  readonly pendingCount = this.queue.pendingCount;
  readonly failedCount = this.queue.failedCount;

  constructor() {
    void this.queue.refreshCount();
    effect(() => {
      if (this.connectivity.online()) void this.syncNow();
    });
  }

  async syncNow(): Promise<void> {
    if (!this.connectivity.online() || this.syncingState()) return;

    this.syncingState.set(true);
    try {
      // Só as operações dentro do limite de tentativas: as que esgotaram ficam
      // guardadas e saem daqui até o motorista mandar tentar de novo.
      const operations = await this.queue.listSyncable();
      for (const operation of operations) {
        try {
          await this.process(operation);
          await this.queue.remove(operation.id);
        } catch (error) {
          await this.queue.recordFailure(operation, errorMessage(error));
        }
      }

      this.lastSyncState.set(new Date().toISOString());
      this.contextStore.refresh(true).subscribe();
    } finally {
      this.syncingState.set(false);
    }
  }

  refreshPending(): Promise<void> {
    return this.queue.refreshCount();
  }

  /** Envios que esgotaram as tentativas, para revisão do motorista. */
  listFailed(): Promise<QueuedOperation[]> {
    return this.queue.listFailed();
  }

  /** Recoloca um envio esgotado na fila automática. */
  async retryFailed(id: string): Promise<void> {
    await this.queue.resetAttempts(id);
    await this.syncNow();
  }

  /** Descarta definitivamente um envio que o motorista optou por não reenviar. */
  discardFailed(id: string): Promise<void> {
    return this.queue.remove(id);
  }

  private async upload(file: StoredUpload): Promise<string> {
    const response = await firstValueFrom(this.api.upload(file.blob, file.fileName));
    return response.data.url;
  }

  private async process(operation: QueuedOperation): Promise<void> {
    switch (operation.type) {
      case 'checklist': {
        const photos = new Map<string, string>();
        for (const item of operation.itemPhotos) {
          photos.set(item.checklistItemId, await this.upload(item.file));
        }
        const signatureUrl = operation.signature ? await this.upload(operation.signature) : null;
        await firstValueFrom(
          this.api.submitChecklist({
            ...operation.payload,
            signatureUrl,
            items: operation.payload.items.map((item) => ({
              ...item,
              photoUrl: photos.get(item.checklistItemId) ?? item.photoUrl ?? null,
            })),
          }),
        );
        return;
      }
      case 'fuel': {
        const receiptUrl = operation.receipt ? await this.upload(operation.receipt) : null;
        await firstValueFrom(this.api.submitFuel({ ...operation.payload, receiptUrl }));
        return;
      }
      case 'problem': {
        const photos: string[] = [];
        for (const photo of operation.photos) photos.push(await this.upload(photo));
        await firstValueFrom(this.api.submitProblem({ ...operation.payload, photos }));
        return;
      }
      case 'term': {
        const signatureUrl = await this.upload(operation.signature);
        await firstValueFrom(this.api.signTerm(operation.termId, signatureUrl, operation.location));
        return;
      }
    }
  }
}
