import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { MaintenancePlan } from '../../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './maintenance-plans.component.html',
  styleUrls: ['./maintenance-plans.component.scss']
})
export class MaintenancePlansComponent implements OnInit {
  plans = signal<MaintenancePlan[]>([]);
  loading = signal(false);
  showForm = signal(false);
  editingPlanId = signal<string | null>(null);
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private router: Router
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      triggerType: ['BOTH', Validators.required],
      intervalKm: [null],
      intervalDays: [null],
      estimatedCost: [null]
    });
  }

  ngOnInit() {
    this.loadPlans();
  }

  loadPlans() {
    this.loading.set(true);
    this.maintenanceService.getPlans().subscribe({
      next: (data) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erro ao carregar planos:', error);
        this.loading.set(false);
      }
    });
  }

  openForm(plan?: MaintenancePlan) {
    if (plan) {
      this.editingPlanId.set(plan.id);
      this.form.patchValue({
        name: plan.name,
        description: plan.description || '',
        triggerType: plan.triggerType,
        intervalKm: plan.intervalKm,
        intervalDays: plan.intervalDays,
        estimatedCost: plan.estimatedCost
      });
    } else {
      this.editingPlanId.set(null);
      this.form.reset({ triggerType: 'BOTH' });
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingPlanId.set(null);
    this.form.reset({ triggerType: 'BOTH' });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    const formData = { ...this.form.value };

    const request = this.editingPlanId()
      ? this.maintenanceService.updatePlan(this.editingPlanId()!, formData)
      : this.maintenanceService.createPlan(formData);

    request.subscribe({
      next: () => {
        this.closeForm();
        this.loadPlans();
      },
      error: (error) => {
        console.error('Erro ao salvar plano:', error);
        this.loading.set(false);
      }
    });
  }

  deletePlan(id: string) {
    if (!confirm('Deseja realmente excluir este plano de manutenção?')) return;

    this.maintenanceService.deletePlan(id).subscribe({
      next: () => {
        this.loadPlans();
      },
      error: (error) => {
        console.error('Erro ao excluir plano:', error);
      }
    });
  }

  formatCurrency(value?: number): string {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  getTriggerTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'KM': 'Quilometragem',
      'TIME': 'Tempo',
      'BOTH': 'Ambos'
    };
    return labels[type] || type;
  }
}
