import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  MaintenancePlanActivityFilter,
  MaintenancePlanListFilters,
  MaintenancePlanListResponse,
  MaintenanceVehicleOption,
} from './maintenance.types';

type VehicleOptionsResponse = {
  items: MaintenanceVehicleOption[];
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

  listVehicleOptions(search = ''): Observable<MaintenanceVehicleOption[]> {
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
}
