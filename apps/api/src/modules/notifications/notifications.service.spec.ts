import { NotificationType } from '@frota-leve/database';
import { prisma as prismaClient } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { NotificationService } from './notifications.service';

type MockNotification = {
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

type MockPrisma = {
  user: {
    findFirst: jest.Mock;
  };
  notification: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const USER = {
  id: 'bbbbbbbb-9999-9999-9999-999999999999',
  tenantId: 'aaaaaaaa-9999-9999-9999-999999999999',
};

const UNREAD_NOTIFICATION: MockNotification = {
  id: 'cccccccc-9999-9999-9999-999999999991',
  tenantId: USER.tenantId,
  userId: USER.id,
  type: NotificationType.WARNING,
  title: 'Documento expirando',
  message: 'O documento do veículo ABC1D23 vence em 3 dias.',
  entityType: 'Document',
  entityId: 'document-1',
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-04-09T13:40:00.000Z'),
};

const READ_NOTIFICATION: MockNotification = {
  ...UNREAD_NOTIFICATION,
  isRead: true,
  readAt: new Date('2026-04-09T14:00:00.000Z'),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
    prisma.user.findFirst.mockResolvedValue({ id: USER.id });
    prisma.notification.create.mockResolvedValue(UNREAD_NOTIFICATION);
    prisma.notification.findFirst.mockResolvedValue(UNREAD_NOTIFICATION);
    prisma.notification.update.mockResolvedValue(READ_NOTIFICATION);
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    prisma.notification.findMany.mockResolvedValue([UNREAD_NOTIFICATION]);
    prisma.notification.count.mockResolvedValue(3);
  });

  it('create persists an unread notification for a tenant user', async () => {
    const result = await service.create({
      tenantId: USER.tenantId,
      userId: USER.id,
      type: NotificationType.WARNING,
      title: ' Documento expirando ',
      message: ' O documento do veículo ABC1D23 vence em 3 dias. ',
      entityType: ' Document ',
      entityId: ' document-1 ',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: USER.id,
        tenantId: USER.tenantId,
      },
      select: {
        id: true,
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        tenantId: USER.tenantId,
        userId: USER.id,
        type: NotificationType.WARNING,
        title: 'Documento expirando',
        message: 'O documento do veículo ABC1D23 vence em 3 dias.',
        entityType: 'Document',
        entityId: 'document-1',
      },
    });
    expect(result).toMatchObject({
      id: UNREAD_NOTIFICATION.id,
      isRead: false,
      readAt: null,
    });
  });

  it('markAsRead updates an unread notification', async () => {
    const result = await service.markAsRead({
      tenantId: USER.tenantId,
      userId: USER.id,
      notificationId: UNREAD_NOTIFICATION.id,
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: UNREAD_NOTIFICATION.id,
        tenantId: USER.tenantId,
        userId: USER.id,
      },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: UNREAD_NOTIFICATION.id },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    });
    expect(result.isRead).toBe(true);
  });

  it('markAsRead is idempotent for already read notification', async () => {
    prisma.notification.findFirst.mockResolvedValue(READ_NOTIFICATION);

    const result = await service.markAsRead({
      tenantId: USER.tenantId,
      userId: USER.id,
      notificationId: READ_NOTIFICATION.id,
    });

    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: READ_NOTIFICATION.id,
      isRead: true,
      readAt: READ_NOTIFICATION.readAt,
    });
  });

  it('markAllAsRead updates all unread notifications for the user', async () => {
    const result = await service.markAllAsRead({
      tenantId: USER.tenantId,
      userId: USER.id,
    });

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: USER.tenantId,
        userId: USER.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      tenantId: USER.tenantId,
      userId: USER.id,
      updatedCount: 2,
      readAt: expect.any(Date),
    });
  });

  it('getUnread returns unread notifications ordered by newest first', async () => {
    const result = await service.getUnread({
      tenantId: USER.tenantId,
      userId: USER.id,
      limit: 10,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: USER.tenantId,
        userId: USER.id,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        tenantId: USER.tenantId,
        userId: USER.id,
        isRead: false,
      },
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: UNREAD_NOTIFICATION.id,
          isRead: false,
        }),
      ],
      unreadCount: 3,
      limit: 10,
    });
  });

  it('throws when creating a notification for a user outside the tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId: USER.tenantId,
        userId: USER.id,
        type: NotificationType.CRITICAL,
        title: 'Manutenção vencida',
        message: 'Há uma manutenção preventiva vencida.',
        entityType: 'MaintenancePlan',
        entityId: 'plan-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
