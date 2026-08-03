import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { ProblemSubmission } from '../../core/models/mobile.models';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { MobileApiService } from '../../core/services/mobile-api.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';

@Component({
  selector: 'app-problem-page',
  imports: [FormsModule],
  templateUrl: './problem-page.html',
  styleUrl: './problem-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemPage {
  private readonly api = inject(MobileApiService);
  private readonly queue = inject(OfflineQueueService);
  private readonly geolocation = inject(GeolocationService);
  readonly connectivity = inject(ConnectivityService);

  type = 'OTHER';
  description = '';
  location = '';
  thirdPartyInvolved = false;
  policeReport = false;
  readonly photos = signal<File[]>([]);
  readonly previews = signal<string[]>([]);
  readonly locating = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  async captureLocation(): Promise<void> {
    this.locating.set(true);
    const result = await this.geolocation.current();
    this.locating.set(false);
    if (result) this.location = result.label;
    else this.error.set('Não foi possível obter o GPS. Informe o local manualmente.');
  }

  selectPhotos(event: Event): void {
    const selected = Array.from((event.target as HTMLInputElement).files ?? []);
    const next = [...this.photos(), ...selected].slice(0, 5);
    this.photos.set(next);
    this.previews.set(next.map((file) => URL.createObjectURL(file)));
  }

  removePhoto(index: number): void {
    const next = this.photos().filter((_, itemIndex) => itemIndex !== index);
    this.photos.set(next);
    this.previews.set(next.map((file) => URL.createObjectURL(file)));
  }

  async submit(): Promise<void> {
    if (this.description.trim().length < 3) {
      this.error.set('Descreva o problema encontrado.');
      return;
    }
    if (!this.location.trim()) {
      this.error.set('Capture ou informe a localização.');
      return;
    }

    const payload: ProblemSubmission = {
      date: new Date().toISOString(),
      type: this.type,
      description: this.description.trim(),
      location: this.location.trim(),
      thirdPartyInvolved: this.thirdPartyInvolved,
      policeReport: this.policeReport,
    };
    const photos = this.photos().map((photo) => ({ blob: photo, fileName: photo.name }));

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      if (!this.connectivity.online()) {
        await this.queue.enqueue({ type: 'problem', payload, photos });
        this.message.set(
          'Ocorrência salva. Ela será enviada automaticamente quando houver conexão.',
        );
      } else {
        const photoUrls: string[] = [];
        for (const photo of photos) {
          photoUrls.push(
            (await firstValueFrom(this.api.upload(photo.blob, photo.fileName))).data.url,
          );
        }
        await firstValueFrom(this.api.submitProblem({ ...payload, photos: photoUrls }));
        this.message.set('Problema reportado. O gestor já poderá acompanhar.');
      }
      this.reset();
      navigator.vibrate?.([50, 30, 50]);
    } catch {
      await this.queue.enqueue({ type: 'problem', payload, photos });
      this.message.set('A conexão oscilou. A ocorrência ficou salva para sincronização.');
      this.reset();
    } finally {
      this.saving.set(false);
    }
  }

  private reset(): void {
    this.type = 'OTHER';
    this.description = '';
    this.location = '';
    this.thirdPartyInvolved = false;
    this.policeReport = false;
    this.photos.set([]);
    this.previews.set([]);
  }
}
