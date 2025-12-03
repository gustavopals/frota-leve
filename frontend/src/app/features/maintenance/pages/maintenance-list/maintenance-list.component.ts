import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { Maintenance } from '../../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './maintenance-list.component.html',
  styleUrls: ['./maintenance-list.component.scss']
})
export class MaintenanceListComponent implements OnInit {
  maintenances = signal<Maintenance[]>([]);
  loading = signal(false);

  constructor(
    private maintenanceService: MaintenanceService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadMaintenances();
  }

  loadMaintenances() {
    this.loading.set(true);
    this.maintenanceService.getAll().subscribe({
      next: (data) => {
        this.maintenances.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erro ao carregar manutenções:', error);
        this.loading.set(false);
      }
    });
  }

  deleteMaintenance(id: string) {
    if (!confirm('Deseja realmente excluir esta manutenção?')) return;

    this.maintenanceService.delete(id).subscribe({
      next: () => {
        this.loadMaintenances();
      },
      error: (error) => {
        console.error('Erro ao excluir manutenção:', error);
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
