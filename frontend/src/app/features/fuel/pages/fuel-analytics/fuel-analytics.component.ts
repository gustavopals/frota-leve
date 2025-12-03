import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FuelService } from '../../../../core/services/fuel';
import { ApiService } from '../../../../core/services/api';
import { FuelAnalytics } from '../../../../core/models/fuel.model';
import { Vehicle } from '../../../../core/models/vehicle.model';

@Component({
  selector: 'app-fuel-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fuel-analytics.component.html',
})
export class FuelAnalyticsComponent implements OnInit {
  private fuelService = inject(FuelService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  vehicles = signal<Vehicle[]>([]);
  selectedVehicleId = signal<string>('');
  analytics = signal<FuelAnalytics | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadVehicles();
  }

  loadVehicles() {
    this.apiService.get<Vehicle[]>('/vehicles').subscribe({
      next: (data) => {
        this.vehicles.set(data);
        if (data.length > 0) {
          this.onVehicleChange(data[0].id);
        }
      },
      error: (err) => {
        console.error('Erro ao carregar veículos:', err);
        this.error.set('Erro ao carregar veículos');
      }
    });
  }

  onVehicleChange(vehicleId: string) {
    if (!vehicleId) return;

    this.selectedVehicleId.set(vehicleId);
    this.loading.set(true);
    this.error.set(null);

    this.fuelService.getAnalytics(vehicleId).subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar análises:', err);
        this.error.set('Erro ao carregar análises');
        this.loading.set(false);
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatNumber(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  goBack() {
    this.router.navigate(['/fuel']);
  }

  getSelectedVehicle(): Vehicle | undefined {
    return this.vehicles().find(v => v.id === this.selectedVehicleId());
  }
}
