import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContextStoreService } from '../../core/services/context-store.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly store = inject(ContextStoreService);
  readonly context = this.store.context;
  readonly firstName = computed(() => this.context()?.driver.name.split(' ')[0] ?? 'Motorista');

  refresh(): void {
    this.store.refresh(true).subscribe();
  }

  formatMileage(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  dueLabel(date: string | null, mileage: number | null): string {
    if (date) return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
    if (mileage != null) return `${this.formatMileage(mileage)} km`;
    return 'Sem prazo definido';
  }

  statusLabel(status: string): string {
    return { OVERDUE: 'Vencida', UPCOMING: 'Próxima', OK: 'Em dia' }[status] ?? status;
  }
}
