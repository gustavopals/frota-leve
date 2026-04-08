import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  DocumentListFilters,
  DocumentListResponse,
  DocumentRecord,
  PendingDocumentsFilters,
  PendingDocumentsResponse,
} from './documents.types';

const DOCUMENTS_MAX_PAGE_SIZE = 100;

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
}
