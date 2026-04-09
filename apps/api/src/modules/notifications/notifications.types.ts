import type { NotificationType } from '@frota-leve/database';

export type NotificationActorContext = {
  tenantId: string;
  userId: string;
};

export type NotificationResponse = {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export type CreateNotificationInput = {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
};

export type MarkNotificationAsReadInput = {
  tenantId: string;
  userId: string;
  notificationId: string;
};

export type MarkAllNotificationsAsReadInput = {
  tenantId: string;
  userId: string;
};

export type GetUnreadNotificationsInput = {
  tenantId: string;
  userId: string;
  limit?: number;
};

export type MarkAllNotificationsAsReadResult = {
  tenantId: string;
  userId: string;
  updatedCount: number;
  readAt: Date;
};

export type UnreadNotificationsResponse = {
  items: NotificationResponse[];
  unreadCount: number;
  limit: number;
};

export type NotificationListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
