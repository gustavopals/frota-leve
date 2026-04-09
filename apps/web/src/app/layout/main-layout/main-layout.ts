import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PoMenuModule, PoToolbarModule } from '@po-ui/ng-components';
import type { PoMenuItem, PoToolbarAction, PoToolbarProfile } from '@po-ui/ng-components';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth';
import { NotificationService as ToastNotificationService } from '../../core/services/notification';
import type { NotificationRecord } from '../../features/notifications/notifications.types';
import { NotificationsService } from '../../features/notifications/notifications.service';
import { resolveNotificationTarget } from '../../features/notifications/notifications.utils';

const NOTIFICATIONS_PREVIEW_LIMIT = 6;

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, PoToolbarModule, PoMenuModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastNotificationService = inject(ToastNotificationService);
  private readonly notificationsService = inject(NotificationsService);

  protected readonly appName = environment.appName;
  protected readonly appVersion = environment.version;
  protected unreadNotificationsCount = 0;
  protected unreadNotifications: NotificationRecord[] = [];
  protected isLoadingNotifications = false;
  protected isUpdatingNotifications = false;
  protected readonly menus: PoMenuItem[] = [
    { icon: 'an an-house-line', label: 'Dashboard', link: '/dashboard', shortLabel: 'Dash' },
    { icon: 'an an-car-profile', label: 'Veiculos', link: '/vehicles', shortLabel: 'Veic' },
    { icon: 'an an-users-three', label: 'Motoristas', link: '/drivers', shortLabel: 'Moto' },
    { icon: 'an an-gas-pump', label: 'Combustivel', link: '/fuel', shortLabel: 'Comb' },
    { icon: 'an an-wrench', label: 'Manutencao', link: '/maintenance', shortLabel: 'Manu' },
    { icon: 'an an-clipboard-text', label: 'Checklists', link: '/checklists', shortLabel: 'Chek' },
    { icon: 'an an-circle-half-tilt', label: 'Pneus', link: '/tires', shortLabel: 'Pneu' },
    { icon: 'an an-warning-circle', label: 'Multas', link: '/fines', shortLabel: 'Mult' },
    { icon: 'an an-file-text', label: 'Documentos', link: '/documents', shortLabel: 'Docs' },
    { icon: 'an an-shield-warning', label: 'Sinistros', link: '/incidents', shortLabel: 'Sini' },
    { icon: 'an an-coins', label: 'Financeiro', link: '/financial', shortLabel: 'Fina' },
    { icon: 'an an-chart-line-up', label: 'Relatorios', link: '/reports', shortLabel: 'Rela' },
    { icon: 'an an-sparkle', label: 'IA', link: '/ai-assistant', shortLabel: 'IA' },
    { icon: 'an an-gear-six', label: 'Configuracoes', link: '/settings', shortLabel: 'Conf' },
  ];

  constructor() {
    this.loadUnreadNotifications();
  }

  protected get profileActions(): PoToolbarAction[] {
    return [
      {
        label: 'Sair',
        action: () => this.authService.logout(),
      },
    ];
  }

  protected get notificationActions(): PoToolbarAction[] {
    if (this.isLoadingNotifications) {
      return [
        {
          label: 'Atualizando notificações...',
          disabled: true,
        },
      ];
    }

    if (this.unreadNotificationsCount === 0) {
      return [
        {
          label: 'Nenhuma notificação não lida',
          disabled: true,
        },
      ];
    }

    const actions: PoToolbarAction[] = [
      {
        label:
          this.unreadNotificationsCount === 1
            ? '1 notificação não lida'
            : `${this.unreadNotificationsCount} notificações não lidas`,
        disabled: true,
      },
      {
        label: 'Clique em uma linha para marcar como lida',
        disabled: true,
      },
      ...this.unreadNotifications.map((notification) => ({
        label: this.formatNotificationActionLabel(notification),
        action: () => this.openNotification(notification),
      })),
    ];

    if (this.unreadNotificationsCount > this.unreadNotifications.length) {
      actions.push({
        label: `Exibindo as ${this.unreadNotifications.length} notificações mais recentes`,
        disabled: true,
        separator: true,
      });
    }

    actions.push({
      label: 'Marcar todas como lidas',
      separator: true,
      disabled: this.isUpdatingNotifications || this.unreadNotificationsCount === 0,
      action: () => this.markAllNotificationsAsRead(),
    });

    return actions;
  }

  protected get toolbarProfile(): PoToolbarProfile | undefined {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return undefined;
    }

    return {
      title: user.name,
      subtitle: user.email,
      avatar: user.avatarUrl ?? undefined,
    };
  }

  protected get currentTenantName(): string {
    return this.authService.getCurrentTenant()?.name ?? 'Operacao principal';
  }

  private loadUnreadNotifications(): void {
    this.isLoadingNotifications = true;

    this.notificationsService
      .list({ isRead: false }, 1, NOTIFICATIONS_PREVIEW_LIMIT)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() =>
          of({
            items: [],
            hasNext: false,
            meta: {
              page: 1,
              pageSize: NOTIFICATIONS_PREVIEW_LIMIT,
              total: 0,
              totalPages: 1,
            },
          }),
        ),
      )
      .subscribe((response) => {
        this.unreadNotifications = response.items;
        this.unreadNotificationsCount = response.meta.total;
        this.isLoadingNotifications = false;
      });
  }

  private markNotificationAsRead(notificationId: string): void {
    if (this.isUpdatingNotifications) {
      return;
    }

    this.isUpdatingNotifications = true;

    this.notificationsService
      .markAsRead(notificationId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.isUpdatingNotifications = false;
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (!updated) {
          return;
        }

        this.isUpdatingNotifications = false;
        this.loadUnreadNotifications();
      });
  }

  private openNotification(notification: NotificationRecord): void {
    const target = resolveNotificationTarget(notification);

    if (!target) {
      this.toastNotificationService.warning(
        'Esta notificação ainda não possui navegação direta configurada.',
      );
      this.markNotificationAsRead(notification.id);
      return;
    }

    this.markNotificationAsRead(notification.id);
    void this.router.navigate(target.commands, target.extras);
  }

  private markAllNotificationsAsRead(): void {
    if (this.isUpdatingNotifications || this.unreadNotificationsCount === 0) {
      return;
    }

    this.isUpdatingNotifications = true;

    this.notificationsService
      .markAllAsRead()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.isUpdatingNotifications = false;
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        this.unreadNotifications = [];
        this.unreadNotificationsCount = 0;
        this.isUpdatingNotifications = false;
      });
  }

  private formatNotificationActionLabel(notification: NotificationRecord): string {
    const tone =
      notification.type === 'CRITICAL'
        ? 'Crítico'
        : notification.type === 'WARNING'
          ? 'Atenção'
          : 'Info';
    const timestamp = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(notification.createdAt));

    return `${tone}: ${notification.title} • ${timestamp}`;
  }
}
