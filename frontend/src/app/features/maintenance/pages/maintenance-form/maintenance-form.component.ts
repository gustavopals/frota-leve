import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { ApiService } from '../../../../core/services/api';

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './maintenance-form.component.html',
  styleUrls: ['./maintenance-form.component.scss']
})
export class MaintenanceFormComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  isEdit = false;
  maintenanceId?: string;
  vehicles = signal<any[]>([]);
  plans = signal<any[]>([]);

  constructor(
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      vehicleId: ['', Validators.required],
      maintenancePlanId: [''],
      date: ['', Validators.required],
      serviceType: ['', Validators.required],
      description: [''],
      odometer: [null],
      cost: [0, [Validators.required, Validators.min(0)]],
      provider: [''],
      notes: ['']
    });
  }

  ngOnInit() {
    this.loadVehicles();
    this.loadPlans();

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEdit = true;
        this.maintenanceId = params['id'];
        this.loadMaintenance(params['id']);
      }
    });
  }

  loadVehicles() {
    this.apiService.get('/vehicles').subscribe({
      next: (data: any) => this.vehicles.set(data),
      error: (error) => console.error('Erro ao carregar veículos:', error)
    });
  }

  loadPlans() {
    this.maintenanceService.getPlans().subscribe({
      next: (data) => this.plans.set(data),
      error: (error) => console.error('Erro ao carregar planos:', error)
    });
  }

  loadMaintenance(id: string) {
    this.loading.set(true);
    this.maintenanceService.getOne(id).subscribe({
      next: (data) => {
        this.form.patchValue({
          vehicleId: data.vehicleId,
          maintenancePlanId: data.maintenancePlanId || '',
          date: data.date.split('T')[0],
          serviceType: data.serviceType,
          description: data.description || '',
          odometer: data.odometer,
          cost: data.cost,
          provider: data.provider || '',
          notes: data.notes || ''
        });
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erro ao carregar manutenção:', error);
        this.loading.set(false);
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    const formData = { ...this.form.value };

    // Converter data para ISO string
    formData.date = new Date(formData.date).toISOString();

    // Remover maintenancePlanId se vazio
    if (!formData.maintenancePlanId) {
      delete formData.maintenancePlanId;
    }

    const request = this.isEdit && this.maintenanceId
      ? this.maintenanceService.update(this.maintenanceId, formData)
      : this.maintenanceService.create(formData);

    request.subscribe({
      next: () => {
        this.router.navigate(['/dashboard/maintenance']);
      },
      error: (error) => {
        console.error('Erro ao salvar manutenção:', error);
        this.loading.set(false);
      }
    });
  }

  cancel() {
    this.router.navigate(['/dashboard/maintenance']);
  }
}
