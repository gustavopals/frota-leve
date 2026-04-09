import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  FineDriverOption,
  FineImportResult,
  FineListFilters,
  FineListResponse,
  FineRecord,
  FineStatsFilters,
  FineStatsResponse,
  FineVehicleOption,
  FineWorkflowPayload,
} from './fines.types';

const FINES_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 100;

type VehicleOptionsResponse = {
  items: Array<{ id: string; plate: string; brand: string; model: string; year: number }>;
};

type DriverOptionsResponse = {
  items: Array<{ id: string; name: string; cpf: string }>;
};

@Injectable({ providedIn: 'root' })
export class FinesService {
  private readonly apiService = inject(ApiService);

  list(
    filters: FineListFilters = {},
    page = 1,
    pageSize = FINES_PAGE_SIZE,
  ): Observable<FineListResponse> {
    return this.apiService.get<FineListResponse>('fines', {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        page,
        pageSize,
      },
    });
  }

  getById(fineId: string): Observable<FineRecord> {
    return this.apiService.get<FineRecord>(`fines/${fineId}`);
  }

  update(fineId: string, payload: FineWorkflowPayload): Observable<FineRecord> {
    return this.apiService.put<FineRecord, FineWorkflowPayload>(`fines/${fineId}`, payload);
  }

  delete(fineId: string): Observable<{ deleted: boolean; mode: string; fineId: string }> {
    return this.apiService.delete(`fines/${fineId}`);
  }

  getStats(filters: FineStatsFilters = {}): Observable<FineStatsResponse> {
    return this.apiService.get<FineStatsResponse>('fines/stats', {
      params: {
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        granularity: filters.granularity ?? 'month',
      },
    });
  }

  importFile(file: File): Observable<FineImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiService.post<FineImportResult, FormData>('fines/import', formData);
  }

  listVehicleOptions(search = ''): Observable<FineVehicleOption[]> {
    return this.apiService
      .get<VehicleOptionsResponse>('vehicles', {
        params: {
          page: 1,
          pageSize: OPTIONS_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        map((res) =>
          res.items.map((v) => ({
            id: v.id,
            label: `${v.plate} — ${v.brand} ${v.model} (${v.year})`,
            plate: v.plate,
            brand: v.brand,
            model: v.model,
          })),
        ),
      );
  }

  listDriverOptions(search = ''): Observable<FineDriverOption[]> {
    return this.apiService
      .get<DriverOptionsResponse>('drivers', {
        params: {
          page: 1,
          pageSize: OPTIONS_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        map((res) =>
          res.items.map((d) => ({
            id: d.id,
            label: `${d.name} — CPF ${this.formatCpf(d.cpf)}`,
            name: d.name,
            cpf: d.cpf,
          })),
        ),
      );
  }

  private formatCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return cpf;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
