import { DocumentStatus, NotificationType, UserRole } from '@frota-leve/database';
import { prisma as prismaClient } from '../../config/database';
import { NotificationAlertScheduler } from './notification-alert.scheduler';
import { notificationEmailService } from './notification-email.service';

type MockRecipient = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  tenant: {
    name: string;
    tradeName: string | null;
  };
};

type MockMaintenancePlan = {
  id: string;
  tenantId: string;
  name: string;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  vehicle: {
    id: string;
    plate: string;
    currentMileage: number;
  };
};

type MockDocument = {
  id: string;
  tenantId: string;
  type: string;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  status: DocumentStatus;
  vehicle: {
    id: string;
    plate: string;
  } | null;
  driver: {
    id: string;
    name: string;
  } | null;
};

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cnhCategory: string | null;
  cnhExpiration: Date | null;
};

type MockFine = {
  id: string;
  tenantId: string;
  autoNumber: string;
  dueDate: Date;
  vehicle: {
    id: string;
    plate: string;
  };
};

type MockPrisma = {
  user: {
    findMany: jest.Mock;
  };
  maintenancePlan: {
    findMany: jest.Mock;
  };
  document: {
    findMany: jest.Mock;
  };
  driver: {
    findMany: jest.Mock;
  };
  fine: {
    findMany: jest.Mock;
  };
  notification: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  $executeRaw: jest.Mock;
};

type MockNotificationEmailService = {
  sendCriticalAlertDigest: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    maintenancePlan: {
      findMany: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
    },
    fine: {
      findMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

jest.mock('./notification-email.service', () => ({
  notificationEmailService: {
    sendCriticalAlertDigest: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;
const emailService = notificationEmailService as unknown as MockNotificationEmailService;

const BASE_DATE = new Date('2026-04-09T10:00:00.000Z');
const TENANT_ID = 'tenant-1';

function createRecipient(overrides: Partial<MockRecipient> = {}): MockRecipient {
  return {
    id: 'user-1',
    tenantId: TENANT_ID,
    name: 'Gestor da Frota',
    email: 'gestor@tenant.com',
    tenant: {
      name: 'Transportadora Alfa',
      tradeName: 'Alfa Log',
    },
    ...overrides,
  };
}

function createMaintenancePlan(overrides: Partial<MockMaintenancePlan> = {}): MockMaintenancePlan {
  return {
    id: 'plan-1',
    tenantId: TENANT_ID,
    name: 'Troca de óleo',
    nextDueAt: new Date('2026-04-08T00:00:00.000Z'),
    nextDueMileage: null,
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
      currentMileage: 52000,
    },
    ...overrides,
  };
}

function createDocument(overrides: Partial<MockDocument> = {}): MockDocument {
  return {
    id: 'document-1',
    tenantId: TENANT_ID,
    type: 'IPVA',
    description: 'IPVA 2026',
    expirationDate: new Date('2026-04-12T00:00:00.000Z'),
    alertDaysBefore: 10,
    status: DocumentStatus.EXPIRING,
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
    },
    driver: null,
    ...overrides,
  };
}

function createDriver(overrides: Partial<MockDriver> = {}): MockDriver {
  return {
    id: 'driver-1',
    tenantId: TENANT_ID,
    name: 'Marina Souza',
    cnhCategory: 'D',
    cnhExpiration: new Date('2026-04-20T00:00:00.000Z'),
    ...overrides,
  };
}

function createFine(overrides: Partial<MockFine> = {}): MockFine {
  return {
    id: 'fine-1',
    tenantId: TENANT_ID,
    autoNumber: 'AUTO-123',
    dueDate: new Date('2026-04-14T00:00:00.000Z'),
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
    },
    ...overrides,
  };
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

describe('NotificationAlertScheduler', () => {
  beforeEach(() => {
    prisma.user.findMany.mockResolvedValue([createRecipient(), createRecipient({ id: 'user-2' })]);
    prisma.maintenancePlan.findMany.mockResolvedValue([]);
    prisma.document.findMany.mockResolvedValue([]);
    prisma.driver.findMany.mockResolvedValue([]);
    prisma.fine.findMany.mockResolvedValue([]);
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.create.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
    emailService.sendCriticalAlertDigest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gera notificações para manutenção, documento, CNH e multa', async () => {
    const scheduler = new NotificationAlertScheduler();

    prisma.maintenancePlan.findMany.mockResolvedValue([createMaintenancePlan()]);
    prisma.document.findMany.mockResolvedValue([
      createDocument({
        status: DocumentStatus.EXPIRED,
        expirationDate: new Date('2026-04-08T00:00:00.000Z'),
      }),
    ]);
    prisma.driver.findMany.mockResolvedValue([createDriver()]);
    prisma.fine.findMany.mockResolvedValue([createFine()]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(8);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        role: {
          in: [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCIAL],
        },
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        tenant: {
          select: {
            name: true,
            tradeName: true,
          },
        },
      },
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['user-1', 'user-2'],
        },
        entityType: {
          in: ['MaintenancePlan', 'Document', 'Driver', 'Fine'],
        },
        createdAt: {
          gte: startOfDay(BASE_DATE),
        },
      },
      select: {
        userId: true,
        entityType: true,
        entityId: true,
        title: true,
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(8);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-1',
        entityType: 'MaintenancePlan',
        entityId: 'plan-1',
        title: 'Plano de manutenção vencido',
        type: NotificationType.CRITICAL,
      }),
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-1',
        entityType: 'Document',
        entityId: 'document-1',
        title: 'Documento expirado',
        type: NotificationType.CRITICAL,
      }),
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-1',
        entityType: 'Driver',
        entityId: 'driver-1',
        title: 'CNH próxima do vencimento',
        type: NotificationType.WARNING,
      }),
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-1',
        entityType: 'Fine',
        entityId: 'fine-1',
        title: 'Prazo de recurso da multa próximo',
        type: NotificationType.WARNING,
      }),
    });
    expect(emailService.sendCriticalAlertDigest).toHaveBeenCalledTimes(2);
    expect(emailService.sendCriticalAlertDigest).toHaveBeenCalledWith({
      recipient: {
        id: 'user-1',
        name: 'Gestor da Frota',
        email: 'gestor@tenant.com',
        companyName: 'Alfa Log',
      },
      alerts: [
        {
          title: 'Plano de manutenção vencido',
          message: 'O plano "Troca de óleo" do veículo ABC1234 está vencido por data.',
          actionUrl: 'http://localhost:4200/maintenance',
          actionLabel: 'Abrir manutenção',
        },
        {
          title: 'Documento expirado',
          message: 'O documento IPVA (IPVA 2026) do veículo ABC1234 vence em 08/04/2026.',
          actionUrl: 'http://localhost:4200/documents',
          actionLabel: 'Abrir documentos',
        },
      ],
      referenceDate: BASE_DATE,
    });
  });

  it('não duplica notificações já geradas no mesmo dia', async () => {
    const scheduler = new NotificationAlertScheduler();

    prisma.user.findMany.mockResolvedValue([createRecipient()]);
    prisma.maintenancePlan.findMany.mockResolvedValue([createMaintenancePlan()]);
    prisma.notification.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        entityType: 'MaintenancePlan',
        entityId: 'plan-1',
        title: 'Plano de manutenção vencido',
      },
    ]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emailService.sendCriticalAlertDigest).not.toHaveBeenCalled();
  });

  it('não gera notificações sem usuários destinatários', async () => {
    const scheduler = new NotificationAlertScheduler();

    prisma.user.findMany.mockResolvedValue([]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emailService.sendCriticalAlertDigest).not.toHaveBeenCalled();
  });
});
