import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { FuelService } from '../../../../core/services/fuel';
import { ApiService } from '../../../../core/services/api';
import { Vehicle } from '../../../../core/models/vehicle.model';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-fuel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './fuel-form.component.html',
})
export class FuelFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private fuelService = inject(FuelService);
  private apiService = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form: FormGroup;
  vehicles = signal<Vehicle[]>([]);
  drivers = signal<User[]>([]);
  loading = signal(false);
  isEditMode = signal(false);
  fuelLogId: string | null = null;

  constructor() {
    this.form = this.fb.group({
      vehicleId: ['', Validators.required],
      driverId: [''],
      date: ['', Validators.required],
      station: ['', Validators.required],
      liters: [0, [Validators.required, Validators.min(0)]],
      totalValue: [0, [Validators.required, Validators.min(0)]],
      odometer: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
    });
  }

  ngOnInit() {
    this.loadVehicles();
    this.loadDrivers();

    this.fuelLogId = this.route.snapshot.paramMap.get('id');
    if (this.fuelLogId) {
      this.isEditMode.set(true);
      this.loadFuelLog(this.fuelLogId);
    } else {
      // Set default date to today
      const today = new Date().toISOString().split('T')[0];
      this.form.patchValue({ date: today });
    }
  }

  loadVehicles() {
    this.apiService.get<Vehicle[]>('/vehicles').subscribe({
      next: (data) => {
        this.vehicles.set(data);
      },
      error: (err) => {
        console.error('Erro ao carregar veículos:', err);
      }
    });
  }

  loadDrivers() {
    this.apiService.get<User[]>('/users').subscribe({
      next: (data) => {
        // Filtrar apenas motoristas
        const drivers = data.filter(u => u.role === 'MOTORISTA');
        this.drivers.set(drivers);
      },
      error: (err) => {
        console.error('Erro ao carregar motoristas:', err);
      }
    });
  }

  loadFuelLog(id: string) {
    this.fuelService.findOne(id).subscribe({
      next: (data) => {
        this.form.patchValue({
          vehicleId: data.vehicleId,
          driverId: data.driverId || '',
          date: data.date.split('T')[0],
          station: data.station,
          liters: data.liters,
          totalValue: data.totalValue,
          odometer: data.odometer,
          notes: data.notes || '',
        });
      },
      error: (err) => {
        console.error('Erro ao carregar abastecimento:', err);
        alert('Erro ao carregar abastecimento');
        this.router.navigate(['/fuel']);
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);

    const formData = {
      ...this.form.value,
      date: new Date(this.form.value.date).toISOString(),
      driverId: this.form.value.driverId || undefined,
    };

    const request = this.isEditMode() && this.fuelLogId
      ? this.fuelService.update(this.fuelLogId, formData)
      : this.fuelService.create(formData);

    request.subscribe({
      next: () => {
        this.router.navigate(['/fuel']);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Erro ao salvar abastecimento:', err);
        alert('Erro ao salvar abastecimento');
      }
    });
  }

  cancel() {
    this.router.navigate(['/fuel']);
  }

  calculatePricePerLiter(): number {
    const liters = this.form.value.liters;
    const totalValue = this.form.value.totalValue;
    return liters > 0 ? totalValue / liters : 0;
  }
}
