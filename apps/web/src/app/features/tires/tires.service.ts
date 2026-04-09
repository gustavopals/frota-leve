import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type { TireInspectionListResponse, TireListFilters, TireListResponse } from './tires.types';

@Injectable({ providedIn: 'root' })
export class TiresService {
  private readonly apiService = inject(ApiService);

  list(filters: TireListFilters = {}, page = 1, pageSize = 20): Observable<TireListResponse> {
    return this.apiService.get<TireListResponse>('tires', {
      params: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.currentVehicleId ? { currentVehicleId: filters.currentVehicleId } : {}),
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        page,
        pageSize,
      },
    });
  }

  listByVehicle(vehicleId: string): Observable<TireListResponse> {
    return this.list({ currentVehicleId: vehicleId, status: 'IN_USE' }, 1, 100);
  }

  listInspections(tireId: string, page = 1, pageSize = 50): Observable<TireInspectionListResponse> {
    return this.apiService.get<TireInspectionListResponse>(`tires/${tireId}/inspections`, {
      params: { page, pageSize },
    });
  }
}
