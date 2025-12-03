import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FuelService } from '../../../../core/services/fuel';
import { FuelLog } from '../../../../core/models/fuel.model';

@Component({
  selector: 'app-fuel-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './fuel-list.component.html',
})
export class FuelListComponent implements OnInit {
  private fuelService = inject(FuelService);
  
  fuelLogs = signal<FuelLog[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadFuelLogs();
  }

  loadFuelLogs() {
    this.loading.set(true);
    this.error.set(null);
    
    this.fuelService.findAll().subscribe({
      next: (data) => {
        this.fuelLogs.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erro ao carregar abastecimentos');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  deleteFuelLog(id: string) {
    if (!confirm('Deseja realmente excluir este abastecimento?')) {
      return;
    }

    this.fuelService.remove(id).subscribe({
      next: () => {
        this.loadFuelLogs();
      },
      error: (err) => {
        alert('Erro ao excluir abastecimento');
        console.error(err);
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }
}
