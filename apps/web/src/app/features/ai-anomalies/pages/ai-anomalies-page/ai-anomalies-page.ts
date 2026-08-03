import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { PoTableAction, PoTableColumn } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  type PoTagType,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';
import { AiAnomaliesService } from '../../ai-anomalies.service';
import {
  ANOMALY_KIND_OPTIONS,
  ANOMALY_SEVERITY_OPTIONS,
  ANOMALY_STATUS_OPTIONS,
  ANOMALY_WORKFLOW_ROLES,
} from '../../ai-anomalies.constants';
import type { AnomalyListFilters, AnomalyRecord } from '../../ai-anomalies.types';
import {
  formatAnomalyKind,
  formatAnomalySeverity,
  formatAnomalyStatus,
  formatDetectedAt,
  getSeverityTagType,
  getStatusTagType,
} from '../../ai-anomalies.utils';

type AnomalyTableItem = AnomalyRecord & {
  _kindLabel: string;
  _severityLabel: string;
  _severityTagType: PoTagType;
  _statusLabel: string;
  _statusTagType: PoTagType;
  _detectedAtLabel: string;
};

const PAGE_SIZE = 20;

@Component({
  selector: 'app-ai-anomalies-page',
  templateUrl: './ai-anomalies-page.html',
  styleUrl: './ai-anomalies-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PoButtonModule,
    PoFieldModule,
    PoLoadingModule,
    PoPageModule,
    PoTableModule,
    PoTagModule,
  ],
})
export class AiAnomaliesPage {
  private readonly service = inject(AiAnomaliesService);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly kindOptions = ANOMALY_KIND_OPTIONS;
  readonly severityOptions = ANOMALY_SEVERITY_OPTIONS;
  readonly statusOptions = ANOMALY_STATUS_OPTIONS;

  readonly filtersForm = this.formBuilder.group({
    status: ['OPEN'],
    kind: [''],
    severity: [''],
  });

  items: AnomalyTableItem[] = [];
  loading = false;
  page = 1;
  total = 0;
  hasNext = false;

  readonly columns: PoTableColumn[] = [
    { property: '_detectedAtLabel', label: 'Detectada em', width: '15%' },
    { property: '_kindLabel', label: 'Tipo', width: '18%' },
    {
      property: '_severityLabel',
      label: 'Severidade',
      type: 'label',
      width: '12%',
      labels: [
        { value: 'Alta', color: 'color-07', label: 'Alta' },
        { value: 'Média', color: 'color-08', label: 'Média' },
        { value: 'Baixa', color: 'color-01', label: 'Baixa' },
      ],
    },
    { property: 'message', label: 'Diagnóstico' },
    {
      property: '_statusLabel',
      label: 'Situação',
      type: 'label',
      width: '12%',
      labels: [
        { value: 'Aberta', color: 'color-08', label: 'Aberta' },
        { value: 'Reconhecida', color: 'color-11', label: 'Reconhecida' },
        { value: 'Descartada', color: 'color-09', label: 'Descartada' },
      ],
    },
  ];

  readonly tableActions: PoTableAction[] = [
    {
      label: 'Reconhecer',
      action: (item: AnomalyTableItem) => this.acknowledge(item),
      disabled: (item: AnomalyTableItem) => !this.canManage || item.status !== 'OPEN',
    },
    {
      label: 'Descartar',
      action: (item: AnomalyTableItem) => this.dismiss(item),
      disabled: (item: AnomalyTableItem) => !this.canManage || item.status !== 'OPEN',
    },
  ];

  constructor() {
    this.load();
  }

  get canManage(): boolean {
    return this.auth.hasAnyRole(ANOMALY_WORKFLOW_ROLES);
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  loadMore(): void {
    this.page += 1;
    this.load(true);
  }

  private buildFilters(): AnomalyListFilters {
    const raw = this.filtersForm.getRawValue();

    return {
      status: (raw.status || undefined) as AnomalyListFilters['status'],
      kind: (raw.kind || undefined) as AnomalyListFilters['kind'],
      severity: (raw.severity || undefined) as AnomalyListFilters['severity'],
      page: this.page,
      limit: PAGE_SIZE,
    };
  }

  private load(append = false): void {
    this.loading = true;

    this.service
      .list(this.buildFilters())
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          const mapped = response.data.map((item) => this.toTableItem(item));
          this.items = append ? [...this.items, ...mapped] : mapped;
          this.total = response.meta.total;
          this.hasNext = response.meta.page < response.meta.totalPages;
        },
        error: () => {
          this.notification.error('Não foi possível carregar as anomalias.');
        },
      });
  }

  private acknowledge(item: AnomalyTableItem): void {
    this.service.acknowledge(item.id).subscribe({
      next: () => {
        this.notification.success('Anomalia reconhecida.');
        this.applyFilters();
      },
      error: () => this.notification.error('Não foi possível reconhecer a anomalia.'),
    });
  }

  private dismiss(item: AnomalyTableItem): void {
    this.service.dismiss(item.id).subscribe({
      next: () => {
        this.notification.success('Anomalia descartada.');
        this.applyFilters();
      },
      error: () => this.notification.error('Não foi possível descartar a anomalia.'),
    });
  }

  private toTableItem(record: AnomalyRecord): AnomalyTableItem {
    return {
      ...record,
      _kindLabel: formatAnomalyKind(record.kind),
      _severityLabel: formatAnomalySeverity(record.severity),
      _severityTagType: getSeverityTagType(record.severity),
      _statusLabel: formatAnomalyStatus(record.status),
      _statusTagType: getStatusTagType(record.status),
      _detectedAtLabel: formatDetectedAt(record.detectedAt),
    };
  }
}
