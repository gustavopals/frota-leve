export type NotificationType = 'INFO' | 'WARNING' | 'CRITICAL';

export type NotificationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type NotificationsFilters = {
  isRead?: boolean;
};

export type NotificationMarkAllReadResponse = {
  tenantId: string;
  userId: string;
  updatedCount: number;
  readAt: string;
};
