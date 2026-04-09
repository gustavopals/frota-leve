import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  PoChartOptions,
  PoChartSerie,
  PoPageAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTableModule,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { FinesService } from '../../fines.service';
import type {
  FineStatsByDriver,
  FineStatsByPeriod,
  FineStatsBySeverity,
  FineStatsFilters,
  FineStatsResponse,
} from '../../fines.types';
import { formatFineAmount, formatFinePoints, formatFineSeverity } from '../../fines.utils';

type DriverRankingRow = {
  position: string;
  driverName: string;
  count: number;
  amount: string;
  points: string;
};

type SeverityRow = {
  severityLabel: string;
  count: number;
  amount: string;
  points: string;
};

type PeriodRow = {
  label: string;
  count: number;
  amount: string;
};

const GRANULARITY_OPTIONS = [
  { label: 'Mensal', value: 'month' },
  { label: 'Diário', value: 'day' },
];

@Component({
  selector: 'app-fines-dashboard-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoWidgetModule,
    PoChartModule,
    PoTableModule,
    PoFieldModule,
    PoButtonModule,
    PoTagModule,
    PoLoadingModule,
  ],
  templateUrl: './fines-dashboard-page.html',
  styleUrl: './fines-dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinesDashboardPage {
  private readonly finesService = inject(FinesService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly granularityOptions = GRANULARITY_OPTIONS;
  readonly columnChartType = PoChartType.Column;
  readonly columnChartOptions: PoChartOptions = {
    legend: true,
    descriptionChart: 'Custo e quantidade de multas por período.',
    rendererOption: 'svg',
  };

  readonly driverColumns: PoTableColumn[] = [
    { property: 'position', label: '#', width: '5%' },
    { property: 'driverName', label: 'Motorista', width: '40%' },
    { property: 'count', label: 'Multas', width: '15%' },
    { property: 'points', label: 'Pontos', width: '15%' },
    { property: 'amount', label: 'Custo total', width: '25%' },
  ];

  readonly severityColumns: PoTableColumn[] = [
    { property: 'severityLabel', label: 'Gravidade', width: '35%' },
    { property: 'count', label: 'Qtd.', width: '20%' },
    { property: 'points', label: 'Pontos', width: '20%' },
    { property: 'amount', label: 'Valor', width: '25%' },
  ];

  readonly periodColumns: PoTableColumn[] = [
    { property: 'label', label: 'Período', width: '35%' },
    { property: 'count', label: 'Multas', width: '25%' },
    { property: 'amount', label: 'Custo', width: '40%' },
  ];

  readonly filtersForm = this.formBuilder.group({
    dateFrom: [''],
    dateTo: [''],
    granularity: ['month'],
  });

  stats: FineStatsResponse | null = null;
  isLoading = false;
  hasLoadedOnce = false;

  driverRows: DriverRankingRow[] = [];
  severityRows: SeverityRow[] = [];
  periodRows: PeriodRow[] = [];
  periodChartSeries: PoChartSerie[] = [];
  periodChartCategories: string[] = [];

  constructor() {
    this.load();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: 'Listagem',
        icon: 'an an-list-bullets',
        action: () => void this.router.navigate(['/fines']),
      },
      {
        label: this.isLoading ? 'Carregando...' : 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => this.load(),
      },
    ];
  }

  protected get totalLabel(): string {
    return this.stats ? String(this.stats.summary.total) : '—';
  }

  protected get totalAmountLabel(): string {
    return this.stats ? formatFineAmount(this.stats.summary.totalAmount) : '—';
  }

  protected get netAmountLabel(): string {
    return this.stats ? formatFineAmount(this.stats.summary.netAmount) : '—';
  }

  protected get totalPointsLabel(): string {
    return this.stats ? formatFinePoints(this.stats.summary.totalPoints) : '—';
  }

  protected applyFilters(): void {
    this.load();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({ dateFrom: '', dateTo: '', granularity: 'month' });
    this.load();
  }

  private load(): void {
    if (this.isLoading) return;

    const { dateFrom, dateTo, granularity } = this.filtersForm.value;
    const filters: FineStatsFilters = {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      granularity: (granularity as 'day' | 'month') ?? 'month',
    };

    this.isLoading = true;
    this.cdr.markForCheck();

    this.finesService
      .getStats(filters)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.stats = response;
          this.driverRows = this.toDriverRows(response.byDriver);
          this.severityRows = this.toSeverityRows(response.bySeverity);
          this.periodRows = this.toPeriodRows(response.byPeriod);
          this.buildPeriodChart(response.byPeriod);
          this.cdr.markForCheck();
        },
      });
  }

  private toDriverRows(drivers: FineStatsByDriver[]): DriverRankingRow[] {
    return drivers.slice(0, 10).map((d, i) => ({
      position: `${i + 1}º`,
      driverName: d.driverName ?? 'Não identificado',
      count: d.count,
      amount: formatFineAmount(d.amount),
      points: formatFinePoints(d.points),
    }));
  }

  private toSeverityRows(severities: FineStatsBySeverity[]): SeverityRow[] {
    return severities.map((s) => ({
      severityLabel: formatFineSeverity(s.severity as never),
      count: s.count,
      amount: formatFineAmount(s.amount),
      points: formatFinePoints(s.points),
    }));
  }

  private toPeriodRows(periods: FineStatsByPeriod[]): PeriodRow[] {
    return periods.map((p) => ({
      label: p.label,
      count: p.count,
      amount: formatFineAmount(p.amount),
    }));
  }

  private buildPeriodChart(periods: FineStatsByPeriod[]): void {
    if (periods.length === 0) {
      this.periodChartCategories = [];
      this.periodChartSeries = [];
      return;
    }

    this.periodChartCategories = periods.map((p) => p.label);
    this.periodChartSeries = [
      {
        label: 'Valor (R$)',
        data: periods.map((p) => Math.round(p.amount * 100) / 100),
        color: '#c9302c',
      },
    ];
  }
}
