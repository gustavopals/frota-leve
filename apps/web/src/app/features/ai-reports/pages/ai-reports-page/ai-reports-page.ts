import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PoButtonModule,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import { AiMarkdownPipe } from '../../../ai-assistant/ai-markdown.pipe';
import { AiReportsService } from '../../ai-reports.service';
import type { ReportDetail, ReportListItem } from '../../ai-reports.types';

const ON_DEMAND_ROLES = ['OWNER', 'ADMIN'];

@Component({
  selector: 'app-ai-reports-page',
  templateUrl: './ai-reports-page.html',
  styleUrl: './ai-reports-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AiMarkdownPipe,
    PoButtonModule,
    PoFieldModule,
    PoLoadingModule,
    PoPageModule,
    PoWidgetModule,
  ],
})
export class AiReportsPage {
  private readonly service = inject(AiReportsService);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);

  reports: ReportListItem[] = [];
  selected: ReportDetail | null = null;
  loading = false;
  generating = false;

  readonly onDemandForm = this.formBuilder.group({
    period: ['', [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
  });

  constructor() {
    this.loadReports();
  }

  get canGenerate(): boolean {
    return this.auth.hasAnyRole(ON_DEMAND_ROLES);
  }

  select(report: ReportListItem): void {
    this.loading = true;

    this.service
      .getById(report.id)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.selected = response.data;
        },
        error: () => this.notification.error('Não foi possível abrir o relatório.'),
      });
  }

  generate(): void {
    if (this.onDemandForm.invalid) {
      this.notification.warning('Informe o período no formato AAAA-MM.');
      return;
    }

    this.generating = true;

    this.service
      .generateOnDemand(this.onDemandForm.getRawValue().period as string)
      .pipe(
        finalize(() => {
          this.generating = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.notification.success('Relatório gerado.');
          this.loadReports();
        },
        error: () => this.notification.error('Não foi possível gerar o relatório.'),
      });
  }

  downloadPdf(report: ReportListItem): void {
    this.service.downloadPdf(report.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-frota-${report.period}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.notification.error('Não foi possível baixar o PDF.'),
    });
  }

  private loadReports(): void {
    this.loading = true;

    this.service
      .list()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.reports = response.data;
        },
        error: () => this.notification.error('Não foi possível carregar os relatórios.'),
      });
  }
}
