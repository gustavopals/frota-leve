import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChecklistService } from '../../../../core/services/checklist';
import { ApiService } from '../../../../core/services/api';
import { ChecklistTemplate } from '../../../../core/models/checklist.model';
import { Vehicle } from '../../../../core/models/vehicle.model';

@Component({
  selector: 'app-submission-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './submission-form.component.html',
})
export class SubmissionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private checklistService = inject(ChecklistService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  form: FormGroup;
  templates = signal<ChecklistTemplate[]>([]);
  vehicles = signal<Vehicle[]>([]);
  selectedTemplate = signal<ChecklistTemplate | null>(null);
  loading = signal(false);

  constructor() {
    this.form = this.fb.group({
      templateId: ['', Validators.required],
      vehicleId: ['', Validators.required],
      overallStatus: ['OK'],
      answers: this.fb.array([]),
    });
  }

  ngOnInit() {
    this.loadTemplates();
    this.loadVehicles();
  }

  get answers(): FormArray {
    return this.form.get('answers') as FormArray;
  }

  loadTemplates() {
    this.checklistService.findAllTemplates().subscribe({
      next: (data) => {
        // Filtrar apenas templates ativos
        this.templates.set(data.filter((t) => t.isActive));
      },
      error: (err) => {
        console.error('Erro ao carregar templates:', err);
      },
    });
  }

  loadVehicles() {
    this.apiService.get<Vehicle[]>('/vehicles').subscribe({
      next: (data) => {
        this.vehicles.set(data);
      },
      error: (err) => {
        console.error('Erro ao carregar veículos:', err);
      },
    });
  }

  onTemplateChange() {
    const templateId = this.form.value.templateId;
    if (!templateId) {
      this.selectedTemplate.set(null);
      this.answers.clear();
      return;
    }

    const template = this.templates().find((t) => t.id === templateId);
    if (template) {
      this.selectedTemplate.set(template);
      this.buildAnswersForm(template);
    }
  }

  buildAnswersForm(template: ChecklistTemplate) {
    this.answers.clear();
    template.items.forEach((item) => {
      this.answers.push(
        this.fb.group({
          templateItemId: [item.id],
          value: ['', Validators.required],
        })
      );
    });
  }

  getItemForAnswer(index: number) {
    const template = this.selectedTemplate();
    return template?.items[index];
  }

  onSubmit() {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((key) => {
        this.form.get(key)?.markAsTouched();
      });
      this.answers.controls.forEach((control) => {
        Object.keys((control as FormGroup).controls).forEach((key) => {
          control.get(key)?.markAsTouched();
        });
      });
      return;
    }

    this.loading.set(true);

    this.checklistService.createSubmission(this.form.value).subscribe({
      next: () => {
        this.router.navigate(['/checklist']);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Erro ao salvar checklist:', err);
        alert('Erro ao salvar checklist');
      },
    });
  }

  cancel() {
    this.router.navigate(['/checklist']);
  }

  updateOverallStatus() {
    // Lógica simples: se alguma resposta for "não" ou negativa, muda o status
    const hasIssues = this.answers.controls.some((control, index) => {
      const item = this.getItemForAnswer(index);
      const value = control.get('value')?.value;
      
      if (item?.type === 'BOOLEAN') {
        return value === 'false' || value === false;
      }
      return false;
    });

    this.form.patchValue({
      overallStatus: hasIssues ? 'ALERT' : 'OK',
    });
  }
}
