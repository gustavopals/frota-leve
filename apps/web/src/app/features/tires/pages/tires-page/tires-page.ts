import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type {
  PoComboOption,
  PoPageAction,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoComboModule,
  PoFieldModule,
  PoLoadingModule,
  PoPageModule,
  PoTableModule,
  PoTabsModule,
  PoTagModule,
  PoTagType,
} from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { VehicleTireMap } from '../../components/vehicle-tire-map/vehicle-tire-map';
import { TireInspectionHistoryModal } from '../../components/tire-inspection-history-modal/tire-inspection-history-modal';
import { TIRE_STATUS_OPTIONS } from '../../tires.constants';
import { TiresService } from '../../tires.service';
import type { TireListFilters, TireRecord, TireStatus } from '../../tires.types';
import {
  TIRE_HEALTH_COLOR,
  formatGrooveDepth,
  formatTireStatus,
  formatVehicleLabel,
  getTireHealthLevel,
  getWearPercentage,
} from '../../tires.utils';
import type { TireSlotEvent } from '../../components/vehicle-tire-map/vehicle-tire-map';

type TireTableRow = TireRecord & {
  _statusLabel: string;
  _statusTagType: PoTagType;
  _vehicleLabel: string;
  _grooveLabel: string;
  _wearPct: string;
  _healthColor: string;
};

type VehicleOption = { label: string; value: string };

const PAGE_SIZE = 20;

@Component({
  selector: 'app-tires-page',
  imports: [
    ReactiveFormsModule,
    PoPageModule,
    PoTabsModule,
    PoTableModule,
    PoFieldModule,
    PoButtonModule,
    PoComboModule,
    PoTagModule,
    PoLoadingModule,
    VehicleTireMap,
    TireInspectionHistoryModal,
  ],
  templateUrl: './tires-page.html',
  styleUrl: './tires-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiresPage {
  private readonly tiresService = inject(TiresService);
  private readonly notificationService = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly historyModal = viewChild.required<TireInspectionHistoryModal>('historyModal');

  readonly statusOptions: PoComboOption[] = TIRE_STATUS_OPTIONS;

  readonly filtersForm = this.formBuilder.group({
    search: [''],
    status: ['' as TireStatus | ''],
  });

  readonly mapVehicleForm = this.formBuilder.group({
    vehicleId: [''],
  });

  // ── Lista ──────────────────────────────────────────────────────────────────
  listItems: TireTableRow[] = [];
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  isLoading = false;
  hasLoadedOnce = false;

  // ── Mapa ───────────────────────────────────────────────────────────────────
  mapVehicleOptions: VehicleOption[] = [];
  mapTires: TireRecord[] = [];
  isLoadingMap = false;
  selectedVehicleId = '';
  selectedMapTire: TireRecord | null = null;

  readonly columns: PoTableColumn[] = [
    { property: '_healthColor', label: '', width: '3%', type: 'cellTemplate' },
    { property: 'brand', label: 'Marca', width: '12%' },
    { property: 'model', label: 'Modelo', width: '12%' },
    { property: 'size', label: 'Medida', width: '10%' },
    { property: 'serialNumber', label: 'Série', width: '13%' },
    { property: '_grooveLabel', label: 'Sulco atual', width: '10%' },
    { property: '_wearPct', label: 'Desgaste', width: '9%', type: 'cellTemplate' },
    { property: '_statusLabel', label: 'Status', width: '10%', type: 'cellTemplate' },
    { property: '_vehicleLabel', label: 'Veículo / Posição', width: '21%' },
  ];

  readonly tableActions: PoTableAction[] = [
    {
      label: 'Ver inspeções',
      action: (row: TireTableRow) => this.openHistory(row),
    },
  ];

  constructor() {
    this.loadList();
    this.loadVehicleOptions();
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: this.isLoading ? 'Carregando...' : 'Atualizar',
        icon: 'an an-arrows-clockwise',
        disabled: this.isLoading,
        action: () => this.reload(),
      },
    ];
  }

  protected get paginationLabel(): string {
    if (!this.hasLoadedOnce || this.totalItems === 0) return '';
    const start = (this.currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage * PAGE_SIZE, this.totalItems);
    return `${start}–${end} de ${this.totalItems} pneus`;
  }

  protected get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  protected applyFilters(): void {
    this.currentPage = 1;
    this.loadList();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '' });
    this.currentPage = 1;
    this.loadList();
  }

  protected reload(): void {
    this.loadList();
  }

  protected goToPreviousPage(): void {
    if (this.hasPreviousPage) {
      this.currentPage--;
      this.loadList();
    }
  }

  protected goToNextPage(): void {
    if (this.hasNext) {
      this.currentPage++;
      this.loadList();
    }
  }

  protected openHistory(tire: TireRecord): void {
    this.historyModal().open(tire);
  }

  protected onMapVehicleChange(vehicleId: string): void {
    this.selectedVehicleId = vehicleId;
    this.selectedMapTire = null;
    if (!vehicleId) {
      this.mapTires = [];
      return;
    }
    this.loadMapTires(vehicleId);
  }

  protected onMapSlotClick(event: TireSlotEvent): void {
    if (event.tire) {
      this.selectedMapTire = event.tire;
      this.cdr.markForCheck();
    }
  }

  protected openHistoryFromMap(): void {
    if (this.selectedMapTire) {
      this.historyModal().open(this.selectedMapTire);
    }
  }

  protected getStatusTagType(status: TireStatus): PoTagType {
    const map: Record<TireStatus, PoTagType> = {
      NEW: PoTagType.Info,
      IN_USE: PoTagType.Success,
      RETREADED: PoTagType.Warning,
      DISCARDED: PoTagType.Neutral,
    };
    return map[status] ?? PoTagType.Neutral;
  }

  private loadList(): void {
    if (this.isLoading) return;

    const { search, status } = this.filtersForm.value;
    const filters: TireListFilters = {
      ...(search?.trim() ? { search: search } : {}),
      ...(status ? { status: status as TireStatus } : {}),
    };

    this.isLoading = true;
    this.cdr.markForCheck();

    this.tiresService
      .list(filters, this.currentPage, PAGE_SIZE)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.listItems = response.items.map((t) => this.toTableRow(t));
          this.totalItems = response.meta.total;
          this.totalPages = response.meta.totalPages;
          this.hasNext = response.hasNext;
          this.hasLoadedOnce = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar os pneus.');
        },
      });
  }

  private loadVehicleOptions(): void {
    // Carrega opções de veículo para o mapa (usa a lista paginada de pneus EM USO para extrair veículos únicos)
    this.tiresService.list({ status: 'IN_USE' }, 1, 100).subscribe({
      next: (response) => {
        const seen = new Set<string>();
        const options: VehicleOption[] = [];
        for (const tire of response.items) {
          if (tire.currentVehicle && !seen.has(tire.currentVehicle.id)) {
            seen.add(tire.currentVehicle.id);
            const v = tire.currentVehicle;
            options.push({
              value: v.id,
              label: `${v.plate} — ${v.brand} ${v.model} (${v.year})`,
            });
          }
        }
        this.mapVehicleOptions = options;
        this.cdr.markForCheck();
      },
    });
  }

  private loadMapTires(vehicleId: string): void {
    this.isLoadingMap = true;
    this.cdr.markForCheck();

    this.tiresService
      .listByVehicle(vehicleId)
      .pipe(
        finalize(() => {
          this.isLoadingMap = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.mapTires = response.items;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Não foi possível carregar os pneus do veículo.');
        },
      });
  }

  private toTableRow(tire: TireRecord): TireTableRow {
    const level = getTireHealthLevel(tire);
    const vehicleLabel = tire.currentVehicle
      ? `${formatVehicleLabel(tire.currentVehicle)} — ${tire.position ?? '?'}`
      : '—';
    return {
      ...tire,
      _statusLabel: formatTireStatus(tire.status),
      _statusTagType: this.getStatusTagType(tire.status),
      _vehicleLabel: vehicleLabel,
      _grooveLabel: formatGrooveDepth(tire.currentGrooveDepth),
      _wearPct: `${Math.round(getWearPercentage(tire))}%`,
      _healthColor: TIRE_HEALTH_COLOR[level],
    };
  }
}
