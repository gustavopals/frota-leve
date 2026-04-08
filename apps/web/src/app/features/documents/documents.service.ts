import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  DocumentDetail,
  DocumentDriverOption,
  DocumentFormPayload,
  DocumentListFilters,
  DocumentListResponse,
  DocumentRecord,
  DocumentVehicleOption,
  PendingDocumentsFilters,
  PendingDocumentsResponse,
} from './documents.types';

const DOCUMENTS_MAX_PAGE_SIZE = 100;

type DocumentWritePayload = {
  vehicleId?: string;
  driverId?: string;
  type: DocumentFormPayload['type'];
  description: string;
  expirationDate: string;
  alertDaysBefore: number;
  cost?: number;
  fileUrl: string;
  notes?: string;
};

type DriverOptionsResponse = {
  items: Array<{
    id: string;
    name: string;
    cpf: string;
    cnhNumber: string | null;
    isActive: boolean;
  }>;
};

type VehicleOptionsResponse = {
  items: Array<{
    id: string;
    plate: string;
    brand: string;
    model: string;
    status: string;
  }>;
};

@Injectable({
  providedIn: 'root',
})
export class DocumentsService {
  private readonly apiService = inject(ApiService);

  list(
    filters: DocumentListFilters = {},
    page = 1,
    pageSize = DOCUMENTS_MAX_PAGE_SIZE,
  ): Observable<DocumentListResponse> {
    return this.apiService.get<DocumentListResponse>('documents', {
      params: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        page,
        pageSize,
      },
    });
  }

  listAll(filters: DocumentListFilters = {}): Observable<DocumentRecord[]> {
    return this.list(filters).pipe(
      switchMap((firstPage) => {
        if (firstPage.meta.totalPages <= 1) {
          return of(firstPage.items);
        }

        const remainingRequests = Array.from(
          { length: firstPage.meta.totalPages - 1 },
          (_, index) => this.list(filters, index + 2),
        );

        return forkJoin(remainingRequests).pipe(
          map((responses) => [firstPage, ...responses].flatMap((response) => response.items)),
        );
      }),
    );
  }

  getPending(filters: PendingDocumentsFilters = {}): Observable<PendingDocumentsResponse> {
    return this.apiService.get<PendingDocumentsResponse>('documents/pending', {
      params: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
      },
    });
  }

  getById(documentId: string): Observable<DocumentDetail> {
    return this.apiService.get<DocumentDetail>(`documents/${documentId}`);
  }

  create(payload: DocumentFormPayload): Observable<DocumentRecord> {
    return this.apiService.post<DocumentRecord, DocumentWritePayload>(
      'documents',
      this.serializePayload(payload),
    );
  }

  update(documentId: string, payload: DocumentFormPayload): Observable<DocumentRecord> {
    return this.apiService.put<DocumentRecord, DocumentWritePayload>(
      `documents/${documentId}`,
      this.serializePayload(payload),
    );
  }

  listVehicleOptions(search = ''): Observable<DocumentVehicleOption[]> {
    return this.apiService
      .get<VehicleOptionsResponse>('vehicles', {
        params: {
          page: 1,
          pageSize: DOCUMENTS_MAX_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        map((response) =>
          response.items
            .map((vehicle) => ({
              id: vehicle.id,
              label: `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`,
              plate: vehicle.plate,
              brand: vehicle.brand,
              model: vehicle.model,
              status: vehicle.status,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
        ),
      );
  }

  listDriverOptions(search = ''): Observable<DocumentDriverOption[]> {
    return this.apiService
      .get<DriverOptionsResponse>('drivers', {
        params: {
          page: 1,
          pageSize: DOCUMENTS_MAX_PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      .pipe(
        map((response) =>
          response.items
            .map((driver) => ({
              id: driver.id,
              label: `${driver.name} - CPF ${this.formatCpf(driver.cpf)}`,
              name: driver.name,
              cpf: driver.cpf,
              cnhNumber: driver.cnhNumber,
              isActive: driver.isActive,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
        ),
      );
  }

  private serializePayload(payload: DocumentFormPayload): DocumentWritePayload {
    const serialized: DocumentWritePayload = {
      type: payload.type,
      description: payload.description.trim(),
      expirationDate: payload.expirationDate,
      alertDaysBefore: payload.alertDaysBefore,
      fileUrl: payload.fileUrl.trim(),
    };

    const vehicleId = this.trimToUndefined(payload.vehicleId);
    const driverId = this.trimToUndefined(payload.driverId);
    const notes = this.trimToUndefined(payload.notes);

    if (vehicleId) {
      serialized.vehicleId = vehicleId;
    }

    if (driverId) {
      serialized.driverId = driverId;
    }

    if (payload.cost != null) {
      serialized.cost = payload.cost;
    }

    if (notes) {
      serialized.notes = notes;
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
