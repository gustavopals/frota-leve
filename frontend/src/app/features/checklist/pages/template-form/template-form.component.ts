import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ChecklistService } from '../../../../core/services/checklist';

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './template-form.component.html',
})
export class TemplateFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private checklistService = inject(ChecklistService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form: FormGroup;
  loading = signal(false);
  isEditMode = signal(false);
  templateId: string | null = null;

  fieldTypes = [
    { value: 'BOOLEAN', label: 'Sim/Não' },
    { value: 'TEXT', label: 'Texto' },
    { value: 'NUMBER', label: 'Número' },
    { value: 'SELECT', label: 'Seleção' },
  ];

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      vehicleType: [''],
      isActive: [true],
      items: this.fb.array([]),
    });
  }

  ngOnInit() {
    this.templateId = this.route.snapshot.paramMap.get('id');
    if (this.templateId) {
      this.isEditMode.set(true);
      this.loadTemplate(this.templateId);
    } else {
      // Add one default item
      this.addItem();
    }
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  createItem(data?: any): FormGroup {
    return this.fb.group({
      label: [data?.label || '', Validators.required],
      type: [data?.type || 'BOOLEAN', Validators.required],
      config: [data?.config || null],
      sortOrder: [data?.sortOrder || 0],
    });
  }

  addItem() {
    this.items.push(this.createItem({ sortOrder: this.items.length }));
  }

  removeItem(index: number) {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  moveItemUp(index: number) {
    if (index > 0) {
      const item = this.items.at(index);
      this.items.removeAt(index);
      this.items.insert(index - 1, item);
      this.updateSortOrders();
    }
  }

  moveItemDown(index: number) {
    if (index < this.items.length - 1) {
      const item = this.items.at(index);
      this.items.removeAt(index);
      this.items.insert(index + 1, item);
      this.updateSortOrders();
    }
  }

  updateSortOrders() {
    this.items.controls.forEach((control, index) => {
      control.patchValue({ sortOrder: index });
    });
  }

  loadTemplate(id: string) {
    this.checklistService.findOneTemplate(id).subscribe({
      next: (data) => {
        this.form.patchValue({
          name: data.name,
          vehicleType: data.vehicleType || '',
          isActive: data.isActive,
        });

        // Clear and add items
        this.items.clear();
        data.items.forEach((item) => {
          this.items.push(this.createItem(item));
        });
      },
      error: (err) => {
        console.error('Erro ao carregar template:', err);
        alert('Erro ao carregar template');
        this.router.navigate(['/checklist/templates']);
      },
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((key) => {
        this.form.get(key)?.markAsTouched();
      });
      this.items.controls.forEach((control) => {
        Object.keys((control as FormGroup).controls).forEach((key) => {
          control.get(key)?.markAsTouched();
        });
      });
      return;
    }

    this.loading.set(true);
    this.updateSortOrders();

    const request = this.isEditMode() && this.templateId
      ? this.checklistService.updateTemplate(this.templateId, this.form.value)
      : this.checklistService.createTemplate(this.form.value);

    request.subscribe({
      next: () => {
        this.router.navigate(['/checklist/templates']);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Erro ao salvar template:', err);
        alert('Erro ao salvar template');
      },
    });
  }

  cancel() {
    this.router.navigate(['/checklist/templates']);
  }
}
