import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  FuelDriverOption,
  FuelRankingFilters,
  FuelRecord,
  FuelRecordFormPayload,
  FuelRecordListFilters,
  FuelRecordListResponse,
  FuelRecordRankingResponse,
  FuelRecordStatsResponse,
  FuelVehicleOption,
} from './fuel.types';

type VehicleOptionsResponse = {
  items: FuelVehicleOption[];
};

type DriverOptionsResponse = {
  items: FuelDriverOption[];
};

@Injectable({
  providedIn: 'root',
})
export class FuelService {
  private readonly apiService = inject(ApiService);

  list(
    filters: FuelRecordListFilters,
    page = 1,
    pageSize = 20,
  ): Observable<FuelRecordListResponse> {
    return this.apiService.get<FuelRecordListResponse>('fuel-records', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.fuelType ? { fuelType: filters.fuelType } : {}),
        ...(filters.gasStation?.trim() ? { gasStation: filters.gasStation.trim() } : {}),
        ...(filters.anomaly === true ? { anomaly: true } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        page,
        pageSize,
      },
    });
  }

  getById(id: string): Observable<FuelRecord> {
    return this.apiService.get<FuelRecord>(`fuel-records/${id}`);
  }

  create(payload: FuelRecordFormPayload): Observable<FuelRecord> {
    return this.apiService.post<FuelRecord, FuelRecordFormPayload>('fuel-records', payload);
  }

  update(id: string, payload: FuelRecordFormPayload): Observable<FuelRecord> {
    return this.apiService.put<FuelRecord, FuelRecordFormPayload>(`fuel-records/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: true; fuelRecordId: string }> {
    return this.apiService.delete<{ deleted: true; fuelRecordId: string }>(`fuel-records/${id}`);
  }

  getStats(filters: FuelRecordListFilters): Observable<FuelRecordStatsResponse> {
    return this.apiService.get<FuelRecordStatsResponse>('fuel-records/stats', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.fuelType ? { fuelType: filters.fuelType } : {}),
        ...(filters.gasStation?.trim() ? { gasStation: filters.gasStation.trim() } : {}),
        ...(filters.anomaly === true ? { anomaly: true } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      },
    });
  }

  getRanking(filters: FuelRankingFilters): Observable<FuelRecordRankingResponse> {
    return this.apiService.get<FuelRecordRankingResponse>('fuel-records/ranking', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.fuelType ? { fuelType: filters.fuelType } : {}),
        ...(filters.gasStation?.trim() ? { gasStation: filters.gasStation.trim() } : {}),
        ...(filters.anomaly === true ? { anomaly: true } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      },
    });
  }

  listVehicleOptions(search = ''): Observable<FuelVehicleOption[]> {
    return this.apiService
      .get<VehicleOptionsResponse>('vehicles', {
        params: {
          page: 1,
          pageSize: 100,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(map((response) => response.items));
  }

  listDriverOptions(search = ''): Observable<FuelDriverOption[]> {
    return this.apiService
      .get<DriverOptionsResponse>('drivers', {
        params: {
          page: 1,
          pageSize: 100,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(map((response) => response.items));
  }
}
