import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  DriverDeletionResponse,
  DriverDetail,
  DriverFormPayload,
  DriverListFilters,
  DriverListResponse,
  DriverRecord,
  DriverVehicleListResponse,
  DriverVehicleOption,
} from './drivers.types';
import { extractDigits, sanitizePhoneDigits } from './drivers.utils';

type DriverWritePayload = {
  name: string;
  cpf: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  birthDate?: string;
  cnhNumber?: string;
  cnhCategory?: string;
  cnhExpiration?: string;
  cnhPoints?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  department?: string;
  photoUrl?: string;
  hireDate?: string;
  score?: number;
  notes?: string;
  userId?: string;
};

@Injectable({
  providedIn: 'root',
})
export class DriversService {
  private readonly apiService = inject(ApiService);

  list(filters: DriverListFilters, page = 1, pageSize = 20): Observable<DriverListResponse> {
    return this.apiService.get<DriverListResponse>('drivers', {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.department?.trim() ? { department: filters.department.trim() } : {}),
        ...(typeof filters.isActive === 'boolean' ? { isActive: filters.isActive } : {}),
        ...(filters.cnhExpiring ? { cnhExpiring: true } : {}),
        page,
        pageSize,
      },
    });
  }

  getById(driverId: string): Observable<DriverDetail> {
    return this.apiService.get<DriverDetail>(`drivers/${driverId}`);
  }

  create(payload: DriverFormPayload): Observable<DriverRecord> {
    return this.apiService.post<DriverRecord, DriverWritePayload>(
      'drivers',
      this.serializePayload(payload),
    );
  }

  update(driverId: string, payload: DriverFormPayload): Observable<DriverRecord> {
    return this.apiService.put<DriverRecord, DriverWritePayload>(
      `drivers/${driverId}`,
      this.serializePayload(payload),
    );
  }

  delete(driverId: string): Observable<DriverDeletionResponse> {
    return this.apiService.delete<DriverDeletionResponse>(`drivers/${driverId}`);
  }

  linkVehicle(driverId: string, vehicleId: string): Observable<DriverRecord> {
    return this.apiService.patch<DriverRecord, Record<string, never>>(
      `drivers/${driverId}/link-vehicle/${vehicleId}`,
      {},
    );
  }

  listVehicleOptions(search = ''): Observable<DriverVehicleOption[]> {
    return this.apiService
      .get<DriverVehicleListResponse>('vehicles', {
        params: {
          page: 1,
          pageSize: 100,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        map((response) =>
          response.items.map((vehicle) => ({
            id: vehicle.id,
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            status: vehicle.status,
          })),
        ),
      );
  }

  private serializePayload(payload: DriverFormPayload): DriverWritePayload {
    const serialized: DriverWritePayload = {
      name: payload.name.trim(),
      cpf: extractDigits(payload.cpf).slice(0, 11),
      isActive: payload.isActive,
    };

    const phone = sanitizePhoneDigits(payload.phone);
    const emergencyPhone = sanitizePhoneDigits(payload.emergencyPhone);
    const email = this.trimToUndefined(payload.email)?.toLowerCase();
    const birthDate = this.trimToUndefined(payload.birthDate);
    const cnhNumber = this.trimToUndefined(payload.cnhNumber);
    const cnhExpiration = this.trimToUndefined(payload.cnhExpiration);
    const emergencyContact = this.trimToUndefined(payload.emergencyContact);
    const department = this.trimToUndefined(payload.department);
    const photoUrl = this.trimToUndefined(payload.photoUrl);
    const hireDate = this.trimToUndefined(payload.hireDate);
    const notes = this.trimToUndefined(payload.notes);
    const userId = this.trimToUndefined(payload.userId);

    if (phone) serialized.phone = phone;
    if (email) serialized.email = email;
    if (birthDate) serialized.birthDate = birthDate;
    if (cnhNumber) serialized.cnhNumber = cnhNumber;
    if (payload.cnhCategory) serialized.cnhCategory = payload.cnhCategory;
    if (cnhExpiration) serialized.cnhExpiration = cnhExpiration;
    if (payload.cnhPoints != null) serialized.cnhPoints = payload.cnhPoints;
    if (emergencyContact) serialized.emergencyContact = emergencyContact;
    if (emergencyPhone) serialized.emergencyPhone = emergencyPhone;
    if (department) serialized.department = department;
    if (photoUrl) serialized.photoUrl = photoUrl;
    if (hireDate) serialized.hireDate = hireDate;
    if (payload.score != null) serialized.score = payload.score;
    if (notes) serialized.notes = notes;
    if (userId) serialized.userId = userId;

    return serialized;
  }

  private trimToUndefined(value: string | null | undefined): string | undefined {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed : undefined;
  }
}
