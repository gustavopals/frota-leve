import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { MobileNotification } from '../../core/models/mobile.models';
import { ContextStoreService } from '../../core/services/context-store.service';
import { MobileApiService } from '../../core/services/mobile-api.service';

@Component({
  selector: 'app-alerts-page',
  templateUrl: './alerts-page.html',
  styleUrl: './alerts-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage {
  private readonly api = inject(MobileApiService);
  private readonly contextStore = inject(ContextStoreService);
  readonly notifications = signal<MobileNotification[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listNotifications().subscribe({
      next: (response) => {
        this.notifications.set(response.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível atualizar os alertas.');
        this.loading.set(false);
      },
    });
  }

  markRead(notification: MobileNotification): void {
    if (notification.isRead) return;
    this.api.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
        );
        this.contextStore.refresh(true).subscribe();
      },
    });
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update((items) => items.map((item) => ({ ...item, isRead: true })));
        this.contextStore.refresh(true).subscribe();
      },
    });
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Hoje, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
  }

  icon(entityType: string): string {
    const normalized = entityType.toUpperCase();
    if (normalized.includes('MAINTENANCE')) return '⚙';
    if (normalized.includes('DOCUMENT') || normalized.includes('DRIVER')) return '▤';
    if (normalized.includes('FINE')) return '!';
    return '•';
  }
}
