import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChecklistService } from '../../../../core/services/checklist';
import { ChecklistSubmission } from '../../../../core/models/checklist.model';

@Component({
  selector: 'app-submission-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './submission-list.component.html',
})
export class SubmissionListComponent implements OnInit {
  private checklistService = inject(ChecklistService);

  submissions = signal<ChecklistSubmission[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadSubmissions();
  }

  loadSubmissions() {
    this.loading.set(true);
    this.error.set(null);

    this.checklistService.findAllSubmissions().subscribe({
      next: (data) => {
        this.submissions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erro ao carregar checklists');
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleString('pt-BR');
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800';
      case 'ALERT':
        return 'bg-yellow-100 text-yellow-800';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'OK':
        return 'OK';
      case 'ALERT':
        return 'Atenção';
      case 'CRITICAL':
        return 'Crítico';
      default:
        return status;
    }
  }
}
