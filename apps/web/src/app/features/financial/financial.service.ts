import { Injectable, inject } from '@angular/core';
import { formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import type { Observable } from 'rxjs';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentRecord } from '../documents/documents.types';
import { FinesService } from '../fines/fines.service';
import type { FineRecord } from '../fines/fines.types';
import { FuelService } from '../fuel/fuel.service';
import type { FuelRecord } from '../fuel/fuel.types';
import { MaintenanceService } from '../maintenance/maintenance.service';
import type { ServiceOrderRecord } from '../maintenance/maintenance.types';
import { TiresService } from '../tires/tires.service';
import type { TireRecord } from '../tires/tires.types';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { VehicleListResponse, VehicleRecord } from '../vehicles/vehicles.types';
import { ApiService } from '../../core/services/api';
import type {
  FinancialComparisonResponse,
  FinancialCategoryKey,
  FinancialOverviewFilters,
  FinancialOverviewResponse,
  FinancialTcoResponse,
  FinancialVehicleInfo,
  FinancialVehicleOption,
  FinancialVehicleCostBreakdown,
  FinancialVehicleCostItem,
} from './financial.types';

type FuelListResponse = {
  items: FuelRecord[];
  meta: {
    totalPages: number;
  };
};

type FineListResponse = {
  items: FineRecord[];
  meta: {
    totalPages: number;
  };
};

type TirePagedResponse = {
  items: TireRecord[];
  meta: {
    totalPages: number;
  };
};

type DateRangeFilters = Pick<FinancialOverviewFilters, 'dateFrom' | 'dateTo'>;

const PAGE_SIZE = 100;

@Injectable({
  providedIn: 'root',
})
export class FinancialService {
  private readonly apiService = inject(ApiService);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly fuelService = inject(FuelService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly finesService = inject(FinesService);
  private readonly documentsService = inject(DocumentsService);
  private readonly tiresService = inject(TiresService);

  getOverview(filters: FinancialOverviewFilters = {}): Observable<FinancialOverviewResponse> {
    return this.apiService.get<FinancialOverviewResponse>('financial/overview', {
      params: {
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.monthlyBudget != null ? { monthlyBudget: filters.monthlyBudget } : {}),
      },
    });
  }

  getVehicleTco(
    vehicleId: string,
    currentMarketValue?: number | null,
  ): Observable<FinancialTcoResponse> {
    return this.apiService.get<FinancialTcoResponse>(`financial/tco/${vehicleId}`, {
      params: {
        ...(currentMarketValue != null ? { currentMarketValue } : {}),
      },
    });
  }

  getComparison(vehicleId: string, limit = 4): Observable<FinancialComparisonResponse> {
    return this.apiService.get<FinancialComparisonResponse>('financial/comparison', {
      params: {
        vehicleId,
        limit,
      },
    });
  }

  listVehicleOptions(): Observable<FinancialVehicleOption[]> {
    return this.listAllVehicles().pipe(
      map((vehicles) =>
        vehicles
          .map((vehicle) => ({
            ...this.toVehicleInfo(vehicle),
            label: `${formatPlate(vehicle.plate)} • ${vehicle.brand} ${vehicle.model} (${vehicle.year})`,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
      ),
    );
  }

  getDashboardData(
    filters: FinancialOverviewFilters = {},
    rankingLimit = 5,
  ): Observable<{
    overview: FinancialOverviewResponse;
    ranking: FinancialVehicleCostItem[];
  }> {
    return forkJoin({
      overview: this.getOverview(filters),
      ranking: this.getVehicleCostRanking(filters, rankingLimit),
    });
  }

  getVehicleCostRanking(
    filters: FinancialOverviewFilters = {},
    limit = 5,
  ): Observable<FinancialVehicleCostItem[]> {
    return forkJoin({
      vehicles: this.listAllVehicles(),
      fuelRecords: this.listAllFuelRecords(),
      serviceOrders: this.maintenanceService.listServiceOrdersAll({}),
      fines: this.listAllFines(),
      documents: this.documentsService.listAll(),
      tires: this.listAllTires(),
    }).pipe(
      map(({ vehicles, fuelRecords, serviceOrders, fines, documents, tires }) =>
        this.buildVehicleRanking(
          vehicles,
          fuelRecords,
          serviceOrders,
          fines,
          documents,
          tires,
          filters,
          limit,
        ),
      ),
    );
  }

  private listAllVehicles(): Observable<VehicleRecord[]> {
    return this.vehiclesService
      .list({}, 1, PAGE_SIZE)
      .pipe(
        switchMap((firstPage) =>
          this.collectPages<VehicleRecord, VehicleListResponse>(firstPage, (page) =>
            this.vehiclesService.list({}, page, PAGE_SIZE),
          ),
        ),
      );
  }

  private listAllFuelRecords(): Observable<FuelRecord[]> {
    return this.fuelService
      .list({}, 1, PAGE_SIZE)
      .pipe(
        switchMap((firstPage) =>
          this.collectPages<FuelRecord, FuelListResponse>(firstPage, (page) =>
            this.fuelService.list({}, page, PAGE_SIZE),
          ),
        ),
      );
  }

  private listAllFines(): Observable<FineRecord[]> {
    return this.finesService
      .list({}, 1, PAGE_SIZE)
      .pipe(
        switchMap((firstPage) =>
          this.collectPages<FineRecord, FineListResponse>(firstPage, (page) =>
            this.finesService.list({}, page, PAGE_SIZE),
          ),
        ),
      );
  }

  private listAllTires(): Observable<TireRecord[]> {
    return this.tiresService
      .list({}, 1, PAGE_SIZE)
      .pipe(
        switchMap((firstPage) =>
          this.collectPages<TireRecord, TirePagedResponse>(firstPage, (page) =>
            this.tiresService.list({}, page, PAGE_SIZE),
          ),
        ),
      );
  }

  private collectPages<TItem, TResponse extends { items: TItem[]; meta: { totalPages: number } }>(
    firstPage: TResponse,
    getPage: (page: number) => Observable<TResponse>,
  ): Observable<TItem[]> {
    if (firstPage.meta.totalPages <= 1) {
      return of(firstPage.items);
    }

    const remainingRequests = Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      getPage(index + 2),
    );

    return forkJoin(remainingRequests).pipe(
      map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
    );
  }

  private buildVehicleRanking(
    vehicles: VehicleRecord[],
    fuelRecords: FuelRecord[],
    serviceOrders: ServiceOrderRecord[],
    fines: FineRecord[],
    documents: DocumentRecord[],
    tires: TireRecord[],
    filters: DateRangeFilters,
    limit: number,
  ): FinancialVehicleCostItem[] {
    const costMap = new Map<string, FinancialVehicleCostItem>();

    vehicles.forEach((vehicle) => {
      costMap.set(vehicle.id, {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        label: `${vehicle.brand} ${vehicle.model}`,
        categoryLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        acquisitionValue: vehicle.acquisitionValue,
        currentMileage: vehicle.currentMileage,
        components: {
          fuel: 0,
          maintenance: 0,
          tires: 0,
          fines: 0,
          documents: 0,
        },
        total: 0,
        costPerKm: null,
      });
    });

    fuelRecords
      .filter((item) => this.isWithinRange(item.date, filters))
      .forEach((item) => {
        this.addVehicleCost(costMap, item.vehicleId, 'fuel', item.totalCost);
      });

    serviceOrders
      .filter((item) => item.status === 'COMPLETED')
      .filter((item) => this.isWithinRange(this.getMaintenanceReferenceDate(item), filters))
      .forEach((item) => {
        this.addVehicleCost(costMap, item.vehicleId, 'maintenance', item.totalCost);
      });

    fines
      .filter((item) => item.status === 'PAID')
      .filter((item) => this.isWithinRange(item.updatedAt, filters))
      .forEach((item) => {
        this.addVehicleCost(costMap, item.vehicleId, 'fines', item.amount);
      });

    documents
      .filter((item) => Boolean(item.vehicleId))
      .filter((item) => this.isWithinRange(item.createdAt, filters))
      .forEach((item) => {
        if (item.vehicleId) {
          this.addVehicleCost(costMap, item.vehicleId, 'documents', item.cost ?? 0);
        }
      });

    tires
      .filter((item) => Boolean(item.currentVehicleId))
      .filter((item) => this.isWithinRange(item.createdAt, filters))
      .forEach((item) => {
        if (item.currentVehicleId) {
          const totalInvestment = item.costNew + item.costRetreat * item.retreatCount;
          this.addVehicleCost(costMap, item.currentVehicleId, 'tires', totalInvestment);
        }
      });

    return [...costMap.values()]
      .map((item) => {
        const total = this.sumObjectValues(item.components);
        return {
          ...item,
          total,
          costPerKm: item.currentMileage > 0 ? this.roundToTwo(total / item.currentMileage) : null,
        };
      })
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total)
      .slice(0, limit);
  }

  private addVehicleCost(
    costMap: Map<string, FinancialVehicleCostItem>,
    vehicleId: string,
    key: FinancialCategoryKey,
    amount: number,
  ): void {
    const current = costMap.get(vehicleId);

    if (!current || amount <= 0) {
      return;
    }

    current.components[key] = this.roundToTwo(current.components[key] + amount);
  }

  private getMaintenanceReferenceDate(item: ServiceOrderRecord): string {
    return item.endDate ?? item.startDate ?? item.createdAt;
  }

  private toVehicleInfo(vehicle: VehicleRecord): FinancialVehicleInfo {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      currentMileage: vehicle.currentMileage,
      acquisitionValue: vehicle.acquisitionValue,
    };
  }

  private isWithinRange(value: string, filters: DateRangeFilters): boolean {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    if (filters.dateFrom) {
      const start = new Date(`${filters.dateFrom}T00:00:00`);
      if (date < start) {
        return false;
      }
    }

    if (filters.dateTo) {
      const end = new Date(`${filters.dateTo}T23:59:59.999`);
      if (date > end) {
        return false;
      }
    }

    return true;
  }

  private sumObjectValues(components: FinancialVehicleCostBreakdown): number {
    return this.roundToTwo(
      Object.values(components).reduce((total, current) => total + current, 0),
    );
  }

  private roundToTwo(value: number): number {
    return Number(value.toFixed(2));
  }
}
