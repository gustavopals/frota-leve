import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ChecklistItemStatus,
  ChecklistSubmission,
  ChecklistTemplate,
} from '../../core/models/mobile.models';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { MobileApiService } from '../../core/services/mobile-api.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { ContextStoreService } from '../../core/services/context-store.service';
import { SignaturePad } from '../../shared/signature-pad/signature-pad';

interface ChecklistAnswer {
  status: ChecklistItemStatus | null;
  notes: string;
  photo: File | null;
  photoPreview: string | null;
}

@Component({
  selector: 'app-checklist-page',
  imports: [SignaturePad],
  templateUrl: './checklist-page.html',
  styleUrl: './checklist-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistPage {
  private readonly signature = viewChild(SignaturePad);
  private readonly api = inject(MobileApiService);
  private readonly queue = inject(OfflineQueueService);
  private readonly geolocation = inject(GeolocationService);
  readonly connectivity = inject(ConnectivityService);
  readonly contextStore = inject(ContextStoreService);

  readonly templates = signal<ChecklistTemplate[]>([]);
  readonly selectedTemplateId = signal<string | null>(null);
  readonly answers = signal<Record<string, ChecklistAnswer>>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedTemplate = computed(
    () => this.templates().find((item) => item.id === this.selectedTemplateId()) ?? null,
  );
  readonly completedItems = computed(
    () => Object.values(this.answers()).filter((answer) => answer.status !== null).length,
  );

  constructor() {
    this.api.getChecklistTemplates().subscribe({
      next: ({ data }) => {
        this.templates.set(data);
        if (data[0]) this.selectTemplate(data[0].id);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar os modelos de checklist.');
        this.loading.set(false);
      },
    });
  }

  selectTemplate(id: string): void {
    this.selectedTemplateId.set(id);
    const template = this.templates().find((item) => item.id === id);
    const answers: Record<string, ChecklistAnswer> = {};
    for (const item of template?.items ?? []) {
      answers[item.id] = { status: null, notes: '', photo: null, photoPreview: null };
    }
    this.answers.set(answers);
    this.message.set(null);
    this.error.set(null);
    this.signature()?.clear();
  }

  templateChanged(event: Event): void {
    this.selectTemplate((event.target as HTMLSelectElement).value);
  }

  setStatus(itemId: string, status: ChecklistItemStatus): void {
    this.updateAnswer(itemId, { status });
    navigator.vibrate?.(18);
  }

  setNotes(itemId: string, event: Event): void {
    this.updateAnswer(itemId, { notes: (event.target as HTMLInputElement).value });
  }

  selectPhoto(itemId: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    this.updateAnswer(itemId, { photo: file, photoPreview: URL.createObjectURL(file) });
  }

  statusOf(itemId: string): ChecklistItemStatus | null {
    return this.answers()[itemId]?.status ?? null;
  }

  answerOf(itemId: string): ChecklistAnswer | null {
    return this.answers()[itemId] ?? null;
  }

  async submit(): Promise<void> {
    const template = this.selectedTemplate();
    const signatureBlob = await this.signature()?.toBlob();
    if (!template) return;

    const missing = template.items.filter((item) => !this.answers()[item.id]?.status);
    const missingPhotos = template.items.filter(
      (item) => item.photoRequired && !this.answers()[item.id]?.photo,
    );
    if (missing.length) {
      this.error.set(
        `Responda todos os itens (${missing.length} pendente${missing.length > 1 ? 's' : ''}).`,
      );
      return;
    }
    if (missingPhotos.length) {
      this.error.set(
        `Adicione as fotos obrigatórias (${missingPhotos.length} pendente${missingPhotos.length > 1 ? 's' : ''}).`,
      );
      return;
    }
    if (!signatureBlob) {
      this.error.set('Assine o checklist antes de enviar.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    const location = await this.geolocation.current();
    const payload: ChecklistSubmission = {
      templateId: template.id,
      executedAt: new Date().toISOString(),
      location: location?.label ?? null,
      notes: null,
      items: template.items.map((item) => ({
        checklistItemId: item.id,
        status: this.answers()[item.id]?.status as ChecklistItemStatus,
        notes: this.answers()[item.id]?.notes || null,
      })),
    };

    const itemPhotos = template.items.flatMap((item) => {
      const photo = this.answers()[item.id]?.photo;
      return photo
        ? [{ checklistItemId: item.id, file: { blob: photo, fileName: photo.name } }]
        : [];
    });
    const signature = { blob: signatureBlob, fileName: `assinatura-${Date.now()}.png` };

    try {
      if (!this.connectivity.online()) {
        await this.queue.enqueue({ type: 'checklist', payload, itemPhotos, signature });
        this.message.set('Checklist salvo no aparelho. Ele será enviado quando a conexão voltar.');
      } else {
        const photoUrls = new Map<string, string>();
        for (const item of itemPhotos) {
          const response = await firstValueFrom(
            this.api.upload(item.file.blob, item.file.fileName),
          );
          photoUrls.set(item.checklistItemId, response.data.url);
        }
        const signatureResponse = await firstValueFrom(
          this.api.upload(signature.blob, signature.fileName),
        );
        await firstValueFrom(
          this.api.submitChecklist({
            ...payload,
            signatureUrl: signatureResponse.data.url,
            items: payload.items.map((item) => ({
              ...item,
              photoUrl: photoUrls.get(item.checklistItemId) ?? null,
            })),
          }),
        );
        this.message.set('Checklist enviado com sucesso. Boa rota!');
        this.contextStore.refresh(true).subscribe();
      }
      navigator.vibrate?.([40, 30, 40]);
      this.selectTemplate(template.id);
    } catch {
      await this.queue.enqueue({ type: 'checklist', payload, itemPhotos, signature });
      this.message.set('A conexão oscilou. O checklist ficou salvo para sincronização.');
    } finally {
      this.saving.set(false);
    }
  }

  private updateAnswer(itemId: string, patch: Partial<ChecklistAnswer>): void {
    const current = this.answers()[itemId];
    if (!current) return;
    this.answers.update((answers) => ({
      ...answers,
      [itemId]: { ...current, ...patch },
    }));
  }
}
