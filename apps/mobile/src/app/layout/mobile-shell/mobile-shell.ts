import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { ContextStoreService } from '../../core/services/context-store.service';
import { SyncService } from '../../core/services/sync.service';

@Component({
  selector: 'app-mobile-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './mobile-shell.html',
  styleUrl: './mobile-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileShell {
  readonly connectivity = inject(ConnectivityService);
  readonly contextStore = inject(ContextStoreService);
  readonly sync = inject(SyncService);

  readonly unread = computed(() => this.contextStore.context()?.unreadNotifications ?? 0);

  constructor() {
    void this.sync.refreshPending();
    this.contextStore.refresh().subscribe();
  }

  syncNow(): void {
    void this.sync.syncNow();
  }
}
