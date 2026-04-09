import type { Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import type {
  NotificationActorContext,
  CreateNotificationInput,
  GetUnreadNotificationsInput,
  NotificationListResponse,
  MarkAllNotificationsAsReadInput,
  MarkAllNotificationsAsReadResult,
  MarkNotificationAsReadInput,
  NotificationResponse,
  UnreadNotificationsResponse,
} from './notifications.types';
import type { ListNotificationsQueryInput } from './notifications.validators';

const DEFAULT_UNREAD_LIMIT = 20;
const MAX_UNREAD_LIMIT = 100;

type NotificationRecord = Prisma.NotificationGetPayload<Record<string, never>>;

function normalizeLimit(limit?: number): number {
  if (limit == null) return DEFAULT_UNREAD_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_UNREAD_LIMIT);
}

async function ensureUserBelongsToTenant(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new NotFoundError('Usuário não encontrado');
  }

  return user;
}

export class NotificationService {
  async list(
    context: NotificationActorContext,
    query: ListNotificationsQueryInput,
  ): Promise<NotificationListResponse<NotificationResponse>> {
    await ensureUserBelongsToTenant(context.tenantId, context.userId);

    const where: Prisma.NotificationWhereInput = {
      tenantId: context.tenantId,
      userId: context.userId,
      ...(query.isRead != null ? { isRead: query.isRead } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.pageSize), 1);

    return {
      items: items.map((item) => this.toNotificationResponse(item)),
      hasNext: query.page < totalPages,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async create(input: CreateNotificationInput): Promise<NotificationResponse> {
    await ensureUserBelongsToTenant(input.tenantId, input.userId);

    const notification = await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title.trim(),
        message: input.message.trim(),
        entityType: input.entityType.trim(),
        entityId: input.entityId.trim(),
      },
    });

    return this.toNotificationResponse(notification);
  }

  async markAsRead(input: MarkNotificationAsReadInput): Promise<NotificationResponse> {
    const existing = await prisma.notification.findFirst({
      where: {
        id: input.notificationId,
        tenantId: input.tenantId,
        userId: input.userId,
      },
    });

    if (!existing) {
      throw new NotFoundError('Notificação não encontrada');
    }

    if (existing.isRead) {
      return this.toNotificationResponse(existing);
    }

    const updated = await prisma.notification.update({
      where: { id: input.notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.toNotificationResponse(updated);
  }

  async markAllAsRead(
    input: MarkAllNotificationsAsReadInput,
  ): Promise<MarkAllNotificationsAsReadResult> {
    await ensureUserBelongsToTenant(input.tenantId, input.userId);

    const readAt = new Date();
    const result = await prisma.notification.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt,
      },
    });

    return {
      tenantId: input.tenantId,
      userId: input.userId,
      updatedCount: result.count,
      readAt,
    };
  }

  async getUnread(input: GetUnreadNotificationsInput): Promise<UnreadNotificationsResponse> {
    await ensureUserBelongsToTenant(input.tenantId, input.userId);

    const limit = normalizeLimit(input.limit);
    const where: Prisma.NotificationWhereInput = {
      tenantId: input.tenantId,
      userId: input.userId,
      isRead: false,
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toNotificationResponse(item)),
      unreadCount,
      limit,
    };
  }

  private toNotificationResponse(record: NotificationRecord): NotificationResponse {
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      entityType: record.entityType,
      entityId: record.entityId,
      isRead: record.isRead,
      readAt: record.readAt,
      createdAt: record.createdAt,
    };
  }
}

export const notificationService = new NotificationService();
