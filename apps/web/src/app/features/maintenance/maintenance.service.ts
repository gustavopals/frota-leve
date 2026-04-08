import { Injectable, inject } from '@angular/core';
import type { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';
import type { Observable } from 'rxjs';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  MaintenanceDriverOption,
  MaintenancePlanActivityFilter,
  MaintenancePlanListFilters,
  MaintenancePlanListResponse,
  MaintenancePlanOption,
  MaintenanceStatsFilters,
  MaintenanceStatsResponse,
  MaintenanceVehicleOption,
  MaintenanceVehicleListResponse,
  ServiceOrderFormPayload,
  ServiceOrderListFilters,
  ServiceOrderListResponse,
  ServiceOrderRecord,
  ServiceOrderStatus,
} from './maintenance.types';

const MAINTENANCE_OPTIONS_PAGE_SIZE = 100;

type VehicleOptionsResponse = {
  items: MaintenanceVehicleOption[];
  meta: {
    totalPages: number;
  };
};

type DriverOptionsResponse = {
  items: Array<{
    id: string;
    name: string;
    cpf: string;
  }>;
  meta: {
    totalPages: number;
  };
};

type ServiceOrderWritePayload = {
  vehicleId: string;
  driverId?: string;
  planId?: string;
  type: ServiceOrderFormPayload['type'];
  status: ServiceOrderStatus;
  description: string;
  workshop?: string;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  notes?: string;
  photos: string[];
  invoiceUrl?: string;
  items: ServiceOrderFormPayload['items'];
};

@Injectable({
  providedIn: 'root',
})
export class MaintenanceService {
  private readonly apiService = inject(ApiService);

  listPlans(
    filters: MaintenancePlanListFilters,
    page = 1,
    pageSize = 10,
  ): Observable<MaintenancePlanListResponse> {
    return this.apiService.get<MaintenancePlanListResponse>('maintenance/plans', {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...this.toActivityParams(filters.activity),
        page,
        pageSize,
      },
    });
  }

  listServiceOrders(
    filters: ServiceOrderListFilters,
    page = 1,
    pageSize = 10,
  ): Observable<ServiceOrderListResponse> {
    return this.apiService.get<ServiceOrderListResponse>('maintenance/service-orders', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...this.toDateRangeParams(filters.dateFrom, filters.dateTo),
        page,
        pageSize,
      },
    });
  }

  getStats(filters: MaintenanceStatsFilters = {}): Observable<MaintenanceStatsResponse> {
    return this.apiService.get<MaintenanceStatsResponse>('maintenance/stats', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...this.toDateRangeParams(filters.dateFrom, filters.dateTo),
      },
    });
  }

  updateServiceOrderStatus(
    order: ServiceOrderRecord,
    status: ServiceOrderStatus,
  ): Observable<ServiceOrderRecord> {
    return this.apiService.put<ServiceOrderRecord, ServiceOrderWritePayload>(
      `maintenance/service-orders/${order.id}`,
      this.serializeServiceOrderPayload({
        vehicleId: order.vehicleId,
        driverId: order.driverId,
        planId: order.planId,
        type: order.type,
        status,
        description: order.description,
        workshop: order.workshop,
        laborCost: order.laborCost,
        partsCost: order.partsCost,
        totalCost: order.totalCost,
        notes: order.notes,
        photos: order.photos,
        invoiceUrl: order.invoiceUrl,
        items: order.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          partNumber: item.partNumber,
        })),
      }),
    );
  }

  listServiceOrdersAll(filters: ServiceOrderListFilters): Observable<ServiceOrderRecord[]> {
    return this.listServiceOrders(filters, 1, MAINTENANCE_OPTIONS_PAGE_SIZE).pipe(
      switchMap((firstPage) => {
        if (firstPage.meta.totalPages <= 1) {
          return of(firstPage.items);
        }

        const remainingRequests = Array.from(
          { length: firstPage.meta.totalPages - 1 },
          (_, index) => this.listServiceOrders(filters, index + 2, MAINTENANCE_OPTIONS_PAGE_SIZE),
        );

        return forkJoin(remainingRequests).pipe(
          map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
        );
      }),
    );
  }

  listVehiclesByStatus(
    status: VehicleStatus,
    page = 1,
    pageSize = 5,
  ): Observable<MaintenanceVehicleListResponse> {
    return this.apiService.get<MaintenanceVehicleListResponse>('vehicles', {
      params: {
        status,
        page,
        pageSize,
      },
    });
  }

  listVehicleOptions(search = ''): Observable<MaintenanceVehicleOption[]> {
    return this.apiService
      .get<VehicleOptionsResponse>('vehicles', {
        params: {
          page: 1,
          pageSize: MAINTENANCE_OPTIONS_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        switchMap((firstPage) => {
          if (firstPage.meta.totalPages <= 1) {
            return of(firstPage.items);
          }

          const remainingRequests = Array.from(
            { length: firstPage.meta.totalPages - 1 },
            (_, index) =>
              this.apiService.get<VehicleOptionsResponse>('vehicles', {
                params: {
                  page: index + 2,
                  pageSize: MAINTENANCE_OPTIONS_PAGE_SIZE,
                  ...(search.trim() ? { search: search.trim() } : {}),
                },
              }),
          );

          return forkJoin(remainingRequests).pipe(
            map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
          );
        }),
      );
  }

  listDriverOptions(search = ''): Observable<MaintenanceDriverOption[]> {
    return this.apiService
      .get<DriverOptionsResponse>('drivers', {
        params: {
          page: 1,
          pageSize: MAINTENANCE_OPTIONS_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        switchMap((firstPage) => {
          if (firstPage.meta.totalPages <= 1) {
            return of(firstPage.items);
          }

          const remainingRequests = Array.from(
            { length: firstPage.meta.totalPages - 1 },
            (_, index) =>
              this.apiService.get<DriverOptionsResponse>('drivers', {
                params: {
                  page: index + 2,
                  pageSize: MAINTENANCE_OPTIONS_PAGE_SIZE,
                  ...(search.trim() ? { search: search.trim() } : {}),
                },
              }),
          );

          return forkJoin(remainingRequests).pipe(
            map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
          );
        }),
        map((items) =>
          items
            .map((driver) => ({
              id: driver.id,
              name: driver.name,
              cpf: driver.cpf,
              label: `${driver.name} - CPF ${this.formatCpf(driver.cpf)}`,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
        ),
      );
  }

  listPlanOptions(vehicleId?: string | null): Observable<MaintenancePlanOption[]> {
    const filters: MaintenancePlanListFilters = {
      ...(vehicleId ? { vehicleId } : {}),
    };

    return this.listPlans(filters, 1, MAINTENANCE_OPTIONS_PAGE_SIZE).pipe(
      switchMap((firstPage) => {
        if (firstPage.meta.totalPages <= 1) {
          return of(firstPage.items);
        }

        const remainingRequests = Array.from(
          { length: firstPage.meta.totalPages - 1 },
          (_, index) => this.listPlans(filters, index + 2, MAINTENANCE_OPTIONS_PAGE_SIZE),
        );

        return forkJoin(remainingRequests).pipe(
          map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
        );
      }),
      map((items) =>
        items
          .map((plan) => ({
            id: plan.id,
            vehicleId: plan.vehicleId,
            name: plan.name,
            type: plan.type,
            label: `${plan.name} - ${plan.vehicle.plate}`,
            vehicleLabel: `${plan.vehicle.plate} - ${plan.vehicle.brand} ${plan.vehicle.model}`,
            isActive: plan.isActive,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
      ),
    );
  }

  getServiceOrderById(orderId: string): Observable<ServiceOrderRecord> {
    return this.apiService.get<ServiceOrderRecord>(`maintenance/service-orders/${orderId}`);
  }

  createServiceOrder(payload: ServiceOrderFormPayload): Observable<ServiceOrderRecord> {
    return this.apiService.post<ServiceOrderRecord, ServiceOrderWritePayload>(
      'maintenance/service-orders',
      this.serializeServiceOrderPayload(payload),
    );
  }

  updateServiceOrder(
    orderId: string,
    payload: ServiceOrderFormPayload,
  ): Observable<ServiceOrderRecord> {
    return this.apiService.put<ServiceOrderRecord, ServiceOrderWritePayload>(
      `maintenance/service-orders/${orderId}`,
      this.serializeServiceOrderPayload(payload),
    );
  }

  private toActivityParams(activity?: MaintenancePlanActivityFilter | null): {
    isActive?: boolean;
  } {
    if (activity === 'active') {
      return { isActive: true };
    }

    if (activity === 'inactive') {
      return { isActive: false };
    }

    return {};
  }

  private toDateRangeParams(
    dateFrom?: string | null,
    dateTo?: string | null,
  ): {
    dateFrom?: string;
    dateTo?: string;
  } {
    const params: {
      dateFrom?: string;
      dateTo?: string;
    } = {};

    if (dateFrom?.trim()) {
      params.dateFrom = this.toBoundaryIsoString(dateFrom, 'start');
    }

    if (dateTo?.trim()) {
      params.dateTo = this.toBoundaryIsoString(dateTo, 'end');
    }

    return params;
  }

  private toBoundaryIsoString(value: string, boundary: 'start' | 'end'): string {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));

    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return value;
    }

    const date =
      boundary === 'start'
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);

    return date.toISOString();
  }

  private serializeServiceOrderPayload(payload: ServiceOrderFormPayload): ServiceOrderWritePayload {
    const serialized: ServiceOrderWritePayload = {
      vehicleId: payload.vehicleId,
      type: payload.type,
      status: payload.status,
      description: payload.description.trim(),
      photos: payload.photos,
      items: payload.items.map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        ...(item.partNumber?.trim() ? { partNumber: item.partNumber.trim() } : {}),
      })),
    };

    const driverId = this.trimToUndefined(payload.driverId);
    const planId = this.trimToUndefined(payload.planId);
    const workshop = this.trimToUndefined(payload.workshop);
    const notes = this.trimToUndefined(payload.notes);
    const invoiceUrl = this.trimToUndefined(payload.invoiceUrl);

    if (driverId) {
      serialized.driverId = driverId;
    }

    if (planId) {
      serialized.planId = planId;
    }

    if (workshop) {
      serialized.workshop = workshop;
    }

    if (payload.laborCost != null) {
      serialized.laborCost = payload.laborCost;
    }

    if (payload.partsCost != null) {
      serialized.partsCost = payload.partsCost;
    }

    if (payload.totalCost != null) {
      serialized.totalCost = payload.totalCost;
    }

    if (notes) {
      serialized.notes = notes;
    }

    if (invoiceUrl) {
      serialized.invoiceUrl = invoiceUrl;
    }

    return serialized;
  }

  private trimToUndefined(value: string | null | undefined): string | undefined {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed : undefined;
  }

  private formatCpf(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length !== 11) {
      return value;
    }

    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
