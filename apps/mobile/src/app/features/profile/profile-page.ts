import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ContextStoreService } from '../../core/services/context-store.service';
import type { QueuedOperation } from '../../core/services/offline-queue.service';
import { SyncService } from '../../core/services/sync.service';

const OPERATION_LABELS: Record<QueuedOperation['type'], string> = {
  checklist: 'Checklist',
  fuel: 'Abastecimento',
  problem: 'Problema reportado',
  term: 'Termo de responsabilidade',
};

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  readonly store = inject(ContextStoreService);
  readonly sync = inject(SyncService);
  readonly context = this.store.context;
  readonly scoreAngle = computed(
    () => `${Math.max(0, Math.min(this.context()?.score.score ?? 0, 100)) * 3.6}deg`,
  );
  readonly failed = signal<QueuedOperation[]>([]);

  constructor() {
    // Recarrega a lista sempre que o contador de falhas muda — inclusive quando
    // uma tentativa de sync esgota o limite com a tela aberta.
    effect(() => {
      this.sync.failedCount();
      void this.sync.listFailed().then((operations) => this.failed.set(operations));
    });
  }

  operationLabel(type: QueuedOperation['type']): string {
    return OPERATION_LABELS[type];
  }

  async retryFailed(id: string): Promise<void> {
    await this.sync.retryFailed(id);
  }

  async discardFailed(id: string): Promise<void> {
    await this.sync.discardFailed(id);
  }

  logout(): void {
    this.store.clear();
    this.auth.logout();
  }

  dateLabel(value: string | null): string {
    if (!value) return 'Não informada';
    return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
  }
}
