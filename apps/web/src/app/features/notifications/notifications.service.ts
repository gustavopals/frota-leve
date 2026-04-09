import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  NotificationListResponse,
  NotificationMarkAllReadResponse,
  NotificationRecord,
  NotificationsFilters,
} from './notifications.types';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly apiService = inject(ApiService);

  list(
    filters: NotificationsFilters = {},
    page = 1,
    pageSize = 20,
  ): Observable<NotificationListResponse> {
    return this.apiService.get<NotificationListResponse>('notifications', {
      params: {
        ...(typeof filters.isRead === 'boolean' ? { isRead: filters.isRead } : {}),
        page,
        pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    });
  }

  getUnreadCount(): Observable<number> {
    return this.list({ isRead: false }, 1, 1).pipe(map((response) => response.meta.total));
  }

  markAsRead(notificationId: string): Observable<NotificationRecord> {
    return this.apiService.patch<NotificationRecord, Record<string, never>>(
      `notifications/${notificationId}/read`,
      {},
    );
  }

  markAllAsRead(): Observable<NotificationMarkAllReadResponse> {
    return this.apiService.patch<NotificationMarkAllReadResponse, Record<string, never>>(
      'notifications/read-all',
      {},
    );
  }
}
