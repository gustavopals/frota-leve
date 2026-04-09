import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import type {
  PoChartOptions,
  PoChartSerie,
  PoModalAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoChartModule,
  PoChartType,
  PoLoadingModule,
  PoModalComponent,
  PoModalModule,
  PoTableModule,
  PoTagModule,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { TiresService } from '../../tires.service';
import type { TireInspectionRecord, TireRecord } from '../../tires.types';
import { formatGrooveDepth, formatInspectionDate, formatTireLabel } from '../../tires.utils';

type InspectionRow = {
  dateLabel: string;
  grooveDepth: string;
  position: string;
  inspector: string;
  vehicle: string;
  notes: string;
};

@Component({
  selector: 'app-tire-inspection-history-modal',
  imports: [PoModalModule, PoChartModule, PoTableModule, PoTagModule, PoLoadingModule],
  templateUrl: './tire-inspection-history-modal.html',
  styleUrl: './tire-inspection-history-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TireInspectionHistoryModal {
  private readonly modal = viewChild.required<PoModalComponent>('historyModal');
  private readonly tiresService = inject(TiresService);
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  tire: TireRecord | null = null;
  inspections: TireInspectionRecord[] = [];
  isLoading = false;
  hasLoaded = false;

  readonly lineChartType = PoChartType.Line;
  readonly chartOptions: PoChartOptions = {
    legend: true,
    descriptionChart: 'Evolução do sulco do pneu ao longo das inspeções (mm).',
    rendererOption: 'svg',
  };

  readonly columns: PoTableColumn[] = [
    { property: 'dateLabel', label: 'Data', width: '15%' },
    { property: 'position', label: 'Posição', width: '12%' },
    { property: 'grooveDepth', label: 'Sulco', width: '12%' },
    { property: 'vehicle', label: 'Veículo', width: '22%' },
    { property: 'inspector', label: 'Inspetor', width: '22%' },
    { property: 'notes', label: 'Notas', width: '17%' },
  ];

  chartSeries: PoChartSerie[] = [];
  chartCategories: string[] = [];
  tableRows: InspectionRow[] = [];

  protected get tireLabel(): string {
    return this.tire ? formatTireLabel(this.tire) : '';
  }

  protected get closeAction(): PoModalAction {
    return { label: 'Fechar', action: () => this.close() };
  }

  open(tire: TireRecord): void {
    this.tire = tire;
    this.inspections = [];
    this.hasLoaded = false;
    this.chartSeries = [];
    this.chartCategories = [];
    this.tableRows = [];
    this.modal().open();
    this.load(tire.id);
  }

  close(): void {
    this.modal().close();
  }

  private load(tireId: string): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.tiresService
      .listInspections(tireId, 1, 100)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.inspections = response.items;
          this.tableRows = this.toTableRows(response.items);
          this.buildChart(response.items);
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar o histórico de inspeções.');
        },
      });
  }

  private toTableRows(items: TireInspectionRecord[]): InspectionRow[] {
    return items.map((i) => ({
      dateLabel: formatInspectionDate(i.date),
      grooveDepth: formatGrooveDepth(i.grooveDepth),
      position: i.position,
      inspector: i.inspectedByUser.name,
      vehicle: `${i.vehicle.plate} — ${i.vehicle.brand} ${i.vehicle.model}`,
      notes: i.notes ?? '—',
    }));
  }

  private buildChart(items: TireInspectionRecord[]): void {
    if (items.length === 0) {
      this.chartCategories = [];
      this.chartSeries = [];
      return;
    }

    this.chartCategories = items.map((i) => formatInspectionDate(i.date));

    // Série de sulco medido
    const grooveSerie: PoChartSerie = {
      label: 'Sulco (mm)',
      data: items.map((i) => Math.round(i.grooveDepth * 10) / 10),
      color: '#2dce89',
    };

    const series: PoChartSerie[] = [grooveSerie];

    // Linha de referência mínima (3mm) se houver dados suficientes
    if (items.length >= 2 && this.tire) {
      series.push({
        label: 'Limite mínimo (3mm)',
        data: items.map(() => 3),
        color: '#f5365c',
      });
    }

    this.chartSeries = series;
  }
}
