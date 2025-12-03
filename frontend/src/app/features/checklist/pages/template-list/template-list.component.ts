import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChecklistService } from '../../../../core/services/checklist';
import { ChecklistTemplate } from '../../../../core/models/checklist.model';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './template-list.component.html',
})
export class TemplateListComponent implements OnInit {
  private checklistService = inject(ChecklistService);

  templates = signal<ChecklistTemplate[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading.set(true);
    this.error.set(null);

    this.checklistService.findAllTemplates().subscribe({
      next: (data) => {
        this.templates.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erro ao carregar templates');
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  deleteTemplate(id: string) {
    if (!confirm('Deseja realmente excluir este template?')) {
      return;
    }

    this.checklistService.removeTemplate(id).subscribe({
      next: () => {
        this.loadTemplates();
      },
      error: (err) => {
        alert('Erro ao excluir template');
        console.error(err);
      },
    });
  }

  toggleActive(template: ChecklistTemplate) {
    this.checklistService
      .updateTemplate(template.id, { isActive: !template.isActive })
      .subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: (err) => {
          alert('Erro ao atualizar template');
          console.error(err);
        },
      });
  }
}
