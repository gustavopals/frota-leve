import { DocumentStatus, DocumentType } from '@frota-leve/database';
import { prisma as prismaClient } from '../../config/database';
import {
  DOCUMENT_ALERT_SCHEDULER_USER_AGENT,
  DOCUMENT_ENTITY,
  DOCUMENT_EXPIRED_ACTION,
  DOCUMENT_EXPIRING_ACTION,
} from './documents.alerts';
import { DocumentAlertScheduler } from './document-alert.scheduler';

type MockDocument = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  driverId: string | null;
  type: DocumentType;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  status: DocumentStatus;
  vehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
  } | null;
  driver: {
    id: string;
    name: string;
    cpf: string;
  } | null;
};

type MockPrisma = {
  document: {
    findMany: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  $executeRaw: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const BASE_DATE = new Date('2026-04-08T10:00:00.000Z');

function createDocument(overrides: Partial<MockDocument> = {}): MockDocument {
  return {
    id: 'document-1',
    tenantId: 'tenant-1',
    vehicleId: 'vehicle-1',
    driverId: null,
    type: DocumentType.IPVA,
    description: 'IPVA 2026',
    expirationDate: new Date('2026-04-12T00:00:00.000Z'),
    alertDaysBefore: 10,
    status: DocumentStatus.EXPIRING,
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
      brand: 'Ford',
      model: 'Transit',
    },
    driver: null,
    ...overrides,
  };
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

describe('DocumentAlertScheduler', () => {
  beforeEach(() => {
    prisma.document.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gera alerta para documento próximo do vencimento', async () => {
    const scheduler = new DocumentAlertScheduler();
    const document = createDocument();

    prisma.document.findMany.mockResolvedValue([document]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(1);
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: document.tenantId,
        action: DOCUMENT_EXPIRING_ACTION,
        entity: DOCUMENT_ENTITY,
        entityId: document.id,
        userAgent: DOCUMENT_ALERT_SCHEDULER_USER_AGENT,
        changes: expect.objectContaining({
          documentType: document.type,
          vehiclePlate: document.vehicle?.plate,
          status: DocumentStatus.EXPIRING,
        }),
      }),
    });
  });

  it('gera alerta para documento vencido', async () => {
    const scheduler = new DocumentAlertScheduler();
    const document = createDocument({
      id: 'document-2',
      type: DocumentType.CNH,
      vehicleId: null,
      driverId: 'driver-1',
      expirationDate: new Date('2026-04-07T00:00:00.000Z'),
      status: DocumentStatus.EXPIRED,
      vehicle: null,
      driver: {
        id: 'driver-1',
        name: 'Maria Souza',
        cpf: '12345678901',
      },
    });

    prisma.document.findMany.mockResolvedValue([document]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: DOCUMENT_EXPIRED_ACTION,
        changes: expect.objectContaining({
          driverName: 'Maria Souza',
          documentType: DocumentType.CNH,
        }),
      }),
    });
    const createCall = prisma.auditLog.create.mock.calls[0]?.[0] as {
      data: { changes: { daysUntilExpiration: number } };
    };
    expect(createCall.data.changes.daysUntilExpiration).toBeLessThan(0);
  });

  it('não gera alerta quando não há documentos acionáveis', async () => {
    const scheduler = new DocumentAlertScheduler();

    prisma.document.findMany.mockResolvedValue([]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('não duplica alerta já gerado no mesmo dia para a mesma ação', async () => {
    const scheduler = new DocumentAlertScheduler();
    const document = createDocument();

    prisma.document.findMany.mockResolvedValue([document]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        entityId: document.id,
        action: DOCUMENT_EXPIRING_ACTION,
      },
    ]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: {
          in: [DOCUMENT_EXPIRING_ACTION, DOCUMENT_EXPIRED_ACTION],
        },
        entity: DOCUMENT_ENTITY,
        entityId: {
          in: [document.id],
        },
        createdAt: {
          gte: startOfDay(BASE_DATE),
        },
      },
      select: {
        entityId: true,
        action: true,
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
