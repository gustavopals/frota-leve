import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { ContextStoreService } from '../../core/services/context-store.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { MobileApiService } from '../../core/services/mobile-api.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { SignaturePad } from '../../shared/signature-pad/signature-pad';

@Component({
  selector: 'app-responsibility-page',
  imports: [FormsModule, SignaturePad],
  templateUrl: './responsibility-page.html',
  styleUrl: './responsibility-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponsibilityPage {
  private readonly signature = viewChild(SignaturePad);
  private readonly api = inject(MobileApiService);
  private readonly queue = inject(OfflineQueueService);
  private readonly geolocation = inject(GeolocationService);
  readonly connectivity = inject(ConnectivityService);
  readonly store = inject(ContextStoreService);

  accepted = false;
  location = '';
  readonly saving = signal(false);
  readonly locating = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly term = computed(() => this.store.context()?.responsibilityTerm ?? null);
  readonly paragraphs = computed(() => this.term()?.content.split('\n\n') ?? []);

  async captureLocation(): Promise<void> {
    this.locating.set(true);
    const result = await this.geolocation.current();
    this.locating.set(false);
    if (result) this.location = result.label;
  }

  dateLabel(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  async sign(): Promise<void> {
    const term = this.term();
    const signatureBlob = await this.signature()?.toBlob();
    if (!term || term.status === 'SIGNED') return;
    if (!this.accepted) {
      this.error.set('Confirme que leu e aceita o termo.');
      return;
    }
    if (!signatureBlob) {
      this.error.set('Assine no campo indicado.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    if (!this.location) {
      const result = await this.geolocation.current();
      if (result) this.location = result.label;
    }
    const signature = {
      blob: signatureBlob,
      fileName: `termo-${term.id}-${Date.now()}.png`,
    };

    try {
      if (!this.connectivity.online()) {
        await this.queue.enqueue({
          type: 'term',
          termId: term.id,
          location: this.location || null,
          signature,
        });
        this.message.set('Assinatura salva no aparelho e pendente de sincronização.');
      } else {
        const signatureUrl = (
          await firstValueFrom(this.api.upload(signature.blob, signature.fileName))
        ).data.url;
        await firstValueFrom(this.api.signTerm(term.id, signatureUrl, this.location || null));
        this.message.set('Termo assinado e registrado com sucesso.');
        this.store.refresh(true).subscribe();
      }
      navigator.vibrate?.([50, 30, 50]);
    } catch {
      await this.queue.enqueue({
        type: 'term',
        termId: term.id,
        location: this.location || null,
        signature,
      });
      this.message.set('A conexão oscilou. A assinatura ficou salva para sincronização.');
    } finally {
      this.saving.set(false);
    }
  }
}
