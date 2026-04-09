import jwt from 'jsonwebtoken';
import request from 'supertest';
import { ChecklistItemStatus } from '@frota-leve/shared';
import {
  MaintenanceType,
  PlanType,
  ServiceOrderStatus,
  TenantStatus,
  UserRole,
  VehicleCategory,
} from '@frota-leve/database';
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

type MockChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  photoRequired: boolean;
  displayOrder: number;
  createdAt: Date;
};

type MockChecklistTemplate = {
  id: string;
  tenantId: string;
  name: string;
  vehicleCategory: VehicleCategory | null;
  createdAt: Date;
  updatedAt: Date;
  items: MockChecklistItem[];
};

type MockVehicle = {
  id: string;
  tenantId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
};

type MockChecklistExecution = {
  id: string;
  tenantId: string;
  templateId: string;
  vehicleId: string;
  driverId: string;
  executedAt: Date;
  status: 'COMPLIANT' | 'ATTENTION' | 'NON_COMPLIANT';
  signatureUrl: string | null;
  location: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  template: {
    id: string;
    name: string;
    vehicleCategory: VehicleCategory | null;
  };
  vehicle: MockVehicle;
  driver: MockDriver;
  items: Array<{
    id: string;
    checklistItemId: string;
    label: string;
    status: ChecklistItemStatus;
    photoUrl: string | null;
    notes: string | null;
    createdAt: Date;
  }>;
};

type MockTransactionClient = {
  checklistTemplate: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  checklistExecution: {
    create: jest.Mock;
  };
  serviceOrder: {
    create: jest.Mock;
  };
  checklistItem: {
    deleteMany: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  driver: { findFirst: jest.Mock };
  checklistTemplate: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  checklistExecution: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    checklistTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    checklistExecution: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-5555-5555-5555-555555555555',
  name: 'Tenant Checklists',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-5555-5555-5555-555555555551',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@checklists.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-5555-5555-5555-555555555552',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@checklists.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'ffffffff-5555-5555-5555-555555555551',
  tenantId: TENANT.id,
  plate: 'CHK1A23',
  brand: 'Fiat',
  model: 'Fiorino',
  year: 2025,
};

const DRIVER: MockDriver = {
  id: '99999999-5555-5555-5555-555555555551',
  tenantId: TENANT.id,
  name: 'João Lima',
  cpf: '12345678900',
};

const TEMPLATE: MockChecklistTemplate = {
  id: 'cccccccc-5555-5555-5555-555555555555',
  tenantId: TENANT.id,
  name: 'Checklist diário de saída',
  vehicleCategory: VehicleCategory.LIGHT,
  createdAt: new Date('2026-04-09T10:00:00.000Z'),
  updatedAt: new Date('2026-04-09T10:00:00.000Z'),
  items: [
    {
      id: 'dddddddd-5555-5555-5555-555555555551',
      label: 'Verificar pneus',
      required: true,
      photoRequired: false,
      displayOrder: 0,
      createdAt: new Date('2026-04-09T10:00:00.000Z'),
    },
    {
      id: 'dddddddd-5555-5555-5555-555555555552',
      label: 'Conferir luzes',
      required: true,
      photoRequired: false,
      displayOrder: 1,
      createdAt: new Date('2026-04-09T10:00:00.000Z'),
    },
  ],
};

function getTemplateItem(template: MockChecklistTemplate, index: number): MockChecklistItem {
  const item = template.items[index];

  if (!item) {
    throw new Error(`Template item at index ${index} is required for this test fixture.`);
  }

  return item;
}

const TEMPLATE_ITEM_ENGINE = getTemplateItem(TEMPLATE, 0);
const TEMPLATE_ITEM_LIGHT = getTemplateItem(TEMPLATE, 1);

const EXECUTION: MockChecklistExecution = {
  id: 'abababab-5555-5555-5555-555555555551',
  tenantId: TENANT.id,
  templateId: TEMPLATE.id,
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  executedAt: new Date('2026-04-09T12:00:00.000Z'),
  status: 'NON_COMPLIANT',
  signatureUrl: 'https://files.example.com/checklists/signature.png',
  location: 'Pátio central',
  notes: 'Lanterna traseira direita sem funcionamento.',
  createdByUserId: OWNER.id,
  createdAt: new Date('2026-04-09T12:05:00.000Z'),
  template: {
    id: TEMPLATE.id,
    name: TEMPLATE.name,
    vehicleCategory: TEMPLATE.vehicleCategory,
  },
  vehicle: VEHICLE,
  driver: DRIVER,
  items: [
    {
      id: 'cdcdcdcd-5555-5555-5555-555555555551',
      checklistItemId: TEMPLATE_ITEM_ENGINE.id,
      label: TEMPLATE_ITEM_ENGINE.label,
      status: ChecklistItemStatus.OK,
      photoUrl: null,
      notes: null,
      createdAt: new Date('2026-04-09T12:05:00.000Z'),
    },
    {
      id: 'cdcdcdcd-5555-5555-5555-555555555552',
      checklistItemId: TEMPLATE_ITEM_LIGHT.id,
      label: TEMPLATE_ITEM_LIGHT.label,
      status: ChecklistItemStatus.NON_COMPLIANT,
      photoUrl: 'https://files.example.com/checklists/light-issue.jpg',
      notes: 'Lanterna queimada.',
      createdAt: new Date('2026-04-09T12:05:00.000Z'),
    },
  ],
};

const AUTO_SERVICE_ORDER = {
  id: 'abababab-7777-7777-7777-777777777771',
};

const COMPLIANCE_EXECUTIONS = [
  {
    executedAt: new Date('2026-04-01T08:00:00.000Z'),
    status: 'COMPLIANT',
  },
  {
    executedAt: new Date('2026-04-02T08:00:00.000Z'),
    status: 'NON_COMPLIANT',
  },
  {
    executedAt: new Date('2026-04-10T08:00:00.000Z'),
    status: 'ATTENTION',
  },
  {
    executedAt: new Date('2026-05-03T08:00:00.000Z'),
    status: 'COMPLIANT',
  },
];

const BASE_PAYLOAD = {
  name: 'Checklist diário de saída',
  vehicleCategory: VehicleCategory.LIGHT,
  items: [
    { label: 'Verificar pneus', required: true, photoRequired: false },
    { label: 'Conferir luzes', required: true, photoRequired: false },
  ],
};

function makeToken(user: MockUser) {
  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    process.env['JWT_SECRET'] as string,
    {
      subject: user.id,
      expiresIn: '15m',
      jwtid: 'eeeeeeee-5555-4555-8555-555555555555',
    },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.checklistTemplate.findMany.mockResolvedValue([TEMPLATE]);
  prisma.checklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
  prisma.checklistTemplate.count.mockResolvedValue(1);
  prisma.checklistExecution.findMany.mockResolvedValue(COMPLIANCE_EXECUTIONS);
  prisma.checklistExecution.count.mockResolvedValue(0);
}

describe('Checklists E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /checklists/templates returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/checklists/templates')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: TEMPLATE.id,
      name: TEMPLATE.name,
      vehicleCategory: VehicleCategory.LIGHT,
      itemCount: 2,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /checklists/templates/:id returns a template', async () => {
    const res = await request(app)
      .get(`/api/v1/checklists/templates/${TEMPLATE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TEMPLATE.id);
    expect(res.body.items).toHaveLength(2);
  });

  it('POST /checklists/templates creates a template', async () => {
    const txMock: MockTransactionClient = {
      checklistTemplate: {
        create: jest.fn().mockResolvedValue(TEMPLATE),
        update: jest.fn(),
        delete: jest.fn(),
      },
      checklistExecution: {
        create: jest.fn(),
      },
      serviceOrder: {
        create: jest.fn(),
      },
      checklistItem: {
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/checklists/templates')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(TEMPLATE.name);
    expect(res.body.itemCount).toBe(2);
    expect(txMock.auditLog.create).toHaveBeenCalled();
  });

  it('POST /checklists/templates returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/checklists/templates')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /checklists/templates/:id replaces template and items', async () => {
    const updatedTemplate = {
      ...TEMPLATE,
      name: 'Checklist semanal',
      vehicleCategory: VehicleCategory.HEAVY,
      items: [
        {
          id: 'dddddddd-5555-5555-5555-555555555553',
          label: 'Inspecionar suspensão',
          required: true,
          photoRequired: true,
          displayOrder: 0,
          createdAt: new Date('2026-04-09T10:30:00.000Z'),
        },
      ],
    };

    const txMock: MockTransactionClient = {
      checklistTemplate: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updatedTemplate),
        delete: jest.fn(),
      },
      checklistExecution: {
        create: jest.fn(),
      },
      serviceOrder: {
        create: jest.fn(),
      },
      checklistItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .put(`/api/v1/checklists/templates/${TEMPLATE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        name: 'Checklist semanal',
        vehicleCategory: VehicleCategory.HEAVY,
        items: [{ label: 'Inspecionar suspensão', required: true, photoRequired: true }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: TEMPLATE.id,
      name: 'Checklist semanal',
      vehicleCategory: VehicleCategory.HEAVY,
      itemCount: 1,
    });
    expect(txMock.checklistItem.deleteMany).toHaveBeenCalled();
  });

  it('DELETE /checklists/templates/:id removes a template without executions', async () => {
    const txMock: MockTransactionClient = {
      checklistTemplate: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      checklistExecution: {
        create: jest.fn(),
      },
      serviceOrder: {
        create: jest.fn(),
      },
      checklistItem: {
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .delete(`/api/v1/checklists/templates/${TEMPLATE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, templateId: TEMPLATE.id });
  });

  it('DELETE /checklists/templates/:id rejects template with executions', async () => {
    prisma.checklistExecution.count.mockResolvedValue(1);

    const res = await request(app)
      .delete(`/api/v1/checklists/templates/${TEMPLATE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(400);
  });

  it('POST /checklists/execute registers an execution and derives NON_COMPLIANT status', async () => {
    const txMock: MockTransactionClient = {
      checklistTemplate: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      checklistExecution: {
        create: jest.fn().mockResolvedValue(EXECUTION),
      },
      serviceOrder: {
        create: jest.fn().mockResolvedValue(AUTO_SERVICE_ORDER),
      },
      checklistItem: {
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/checklists/execute')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        templateId: TEMPLATE.id,
        vehicleId: VEHICLE.id,
        driverId: DRIVER.id,
        executedAt: '2026-04-09T12:00:00.000Z',
        signatureUrl: 'https://files.example.com/checklists/signature.png',
        location: 'Pátio central',
        notes: 'Lanterna traseira direita sem funcionamento.',
        items: [
          {
            checklistItemId: TEMPLATE_ITEM_ENGINE.id,
            status: ChecklistItemStatus.OK,
          },
          {
            checklistItemId: TEMPLATE_ITEM_LIGHT.id,
            status: ChecklistItemStatus.NON_COMPLIANT,
            photoUrl: 'https://files.example.com/checklists/light-issue.jpg',
            notes: 'Lanterna queimada.',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: EXECUTION.id,
      status: 'NON_COMPLIANT',
      itemCount: 2,
      templateId: TEMPLATE.id,
      vehicleId: VEHICLE.id,
      driverId: DRIVER.id,
      correctiveServiceOrderId: AUTO_SERVICE_ORDER.id,
    });
    expect(txMock.auditLog.create).toHaveBeenCalled();
    expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT.id,
          vehicleId: VEHICLE.id,
          driverId: DRIVER.id,
          type: MaintenanceType.CORRECTIVE,
          status: ServiceOrderStatus.OPEN,
        }),
      }),
    );
  });

  it('POST /checklists/execute rejects incomplete checklist execution', async () => {
    const res = await request(app)
      .post('/api/v1/checklists/execute')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        templateId: TEMPLATE.id,
        vehicleId: VEHICLE.id,
        driverId: DRIVER.id,
        executedAt: '2026-04-09T12:00:00.000Z',
        items: [
          {
            checklistItemId: TEMPLATE_ITEM_ENGINE.id,
            status: ChecklistItemStatus.OK,
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('GET /checklists/compliance returns summary and compliance by period', async () => {
    const res = await request(app)
      .get('/api/v1/checklists/compliance?dateFrom=2026-04-01&dateTo=2026-05-31')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(prisma.checklistExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          executedAt: expect.objectContaining({
            gte: new Date('2026-04-01T00:00:00.000Z'),
            lte: new Date('2026-05-31T00:00:00.000Z'),
          }),
        }),
      }),
    );
    expect(res.body.summary).toMatchObject({
      totalExecutions: 4,
      compliantExecutions: 2,
      attentionExecutions: 1,
      nonCompliantExecutions: 1,
      complianceRate: 50,
      attentionRate: 25,
      nonComplianceRate: 25,
    });
    expect(res.body.byStatus).toEqual([
      { status: 'COMPLIANT', count: 2, percentage: 50 },
      { status: 'ATTENTION', count: 1, percentage: 25 },
      { status: 'NON_COMPLIANT', count: 1, percentage: 25 },
    ]);
    expect(res.body.byPeriod).toEqual([
      {
        period: '2026-04',
        label: 'Abr/2026',
        totalExecutions: 3,
        compliantExecutions: 1,
        attentionExecutions: 1,
        nonCompliantExecutions: 1,
        complianceRate: 33.33,
      },
      {
        period: '2026-05',
        label: 'Mai/2026',
        totalExecutions: 1,
        compliantExecutions: 1,
        attentionExecutions: 0,
        nonCompliantExecutions: 0,
        complianceRate: 100,
      },
    ]);
  });
});
