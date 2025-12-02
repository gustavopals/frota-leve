import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { CardComponent, CardContentComponent } from '../../../../shared/components/card/card';

@Component({
  selector: 'app-vehicle-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-form.html',
  styleUrls: ['./vehicle-form.scss']
})
export class VehicleFormComponent implements OnInit {
  vehicleForm: FormGroup;
  loading = false;
  isEditMode = false;
  vehicleId: string | null = null;

  fuelTypes = ['GASOLINA', 'ETANOL', 'DIESEL', 'FLEX', 'GNV', 'ELETRICO'];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public router: Router,
    private route: ActivatedRoute
  ) {
    this.vehicleForm = this.fb.group({
      plate: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      year: ['', [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
      color: [''],
      chassisNumber: [''],
      renavam: [''],
      currentKm: [0, [Validators.required, Validators.min(0)]],
      fuelType: ['FLEX', Validators.required]
    });
  }

  ngOnInit() {
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.vehicleId;

    if (this.isEditMode && this.vehicleId) {
      this.loadVehicle(this.vehicleId);
    }
  }

  loadVehicle(id: string) {
    this.apiService.get(`/vehicles/${id}`).subscribe({
      next: (vehicle: any) => {
        this.vehicleForm.patchValue(vehicle);
      },
      error: (error) => {
        console.error('Error loading vehicle:', error);
      }
    });
  }

  onSubmit() {
    if (this.vehicleForm.valid && !this.loading) {
      this.loading = true;

      const request = this.isEditMode && this.vehicleId
        ? this.apiService.put(`/vehicles/${this.vehicleId}`, this.vehicleForm.value)
        : this.apiService.post('/vehicles', this.vehicleForm.value);

      request.subscribe({
        next: () => {
          this.router.navigate(['/vehicles']);
        },
        error: (error) => {
          console.error('Error saving vehicle:', error);
          this.loading = false;
        }
      });
    }
  }
}
