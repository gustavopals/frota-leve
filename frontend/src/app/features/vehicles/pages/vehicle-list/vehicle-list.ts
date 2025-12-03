import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { CardComponent, CardContentComponent } from '../../../../shared/components/card/card';

@Component({
  selector: 'app-vehicle-list',
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-list.html',
  styleUrls: ['./vehicle-list.scss']
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  loading = true;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadVehicles();
  }

  loadVehicles() {
    this.loading = true;
    this.apiService.get<Vehicle[]>('/vehicles').subscribe({
      next: (data) => {
        this.vehicles = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
        this.loading = false;
      }
    });
  }
}
