import jwt from 'jsonwebtoken';
import request from 'supertest';
import { NotificationType, PlanType, TenantStatus, UserRole } from '@frota-leve/database';
import { createApp } from '../../app';
import { prisma as prismaClient } from '../../config/database';

type MockTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
};

type MockUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isActive: boolean;
};

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
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  notification: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-1010-1010-1010-101010101010',
  name: 'Tenant Notifications',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const USER: MockUser = {
  id: 'bbbbbbbb-1010-1010-1010-101010101010',
  tenantId: TENANT.id,
  role: UserRole.MANAGER,
  email: 'manager@notifications.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-1010-1010-1010-101010101011',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@notifications.com',
  isActive: true,
};

const NOTIFICATION: MockNotification = {
  id: 'cccccccc-1010-1010-1010-101010101010',
  tenantId: TENANT.id,
  userId: USER.id,
  type: NotificationType.WARNING,
  title: 'Documento expirando',
  message: 'O documento do veículo ABC1D23 vence em 3 dias.',
  entityType: 'Document',
  entityId: 'document-1',
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-04-09T15:00:00.000Z'),
};

const READ_NOTIFICATION: MockNotification = {
  ...NOTIFICATION,
  isRead: true,
  readAt: new Date('2026-04-09T15:05:00.000Z'),
};

function makeToken(user: MockUser) {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { subject: user.id, expiresIn: '1h', jwtid: 'notifications-access-token' },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(USER);
  prisma.user.findFirst.mockResolvedValue({ id: USER.id });
  prisma.notification.findMany.mockResolvedValue([NOTIFICATION]);
  prisma.notification.findFirst.mockResolvedValue(NOTIFICATION);
  prisma.notification.update.mockResolvedValue(READ_NOTIFICATION);
  prisma.notification.updateMany.mockResolvedValue({ count: 1 });
  prisma.notification.count.mockResolvedValue(1);
}

describe('Notifications E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /notifications returns paginated list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/notifications?page=1&pageSize=10&isRead=false')
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT.id,
        userId: USER.id,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id: NOTIFICATION.id,
        title: NOTIFICATION.title,
        isRead: false,
      }),
    ]);
    expect(res.body).toMatchObject({
      hasNext: false,
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('GET /notifications scopes results to the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue({ id: VIEWER.id });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`);

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT.id,
        userId: VIEWER.id,
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('PATCH /notifications/:id/read marks one notification as read', async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${NOTIFICATION.id}/read`)
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: NOTIFICATION.id,
        tenantId: TENANT.id,
        userId: USER.id,
      },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: NOTIFICATION.id },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    });
    expect(res.body).toMatchObject({
      id: NOTIFICATION.id,
      isRead: true,
    });
  });

  it('PATCH /notifications/read-all marks all unread notifications as read', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT.id,
        userId: USER.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    });
    expect(res.body).toMatchObject({
      tenantId: TENANT.id,
      userId: USER.id,
      updatedCount: 1,
      readAt: expect.any(String),
    });
  });
});
