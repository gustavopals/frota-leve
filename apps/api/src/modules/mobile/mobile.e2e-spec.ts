import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleCategory } from '@frota-leve/database';
import { createApp } from '../../app';
import { prisma as prismaClient } from '../../config/database';

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  driver: { findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  checklistTemplate: { findMany: jest.Mock };
};

type TokenUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    driver: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    checklistTemplate: { findMany: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT = {
  id: 'aaaaaaaa-4444-4444-a444-444444444444',
  name: 'Transportadora Mobile',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const DRIVER_USER = {
  id: 'bbbbbbbb-4444-4444-a444-444444444441',
  tenantId: TENANT.id,
  role: UserRole.DRIVER,
  email: 'motorista@mobile.test',
  isActive: true,
};

const MANAGER_USER = {
  ...DRIVER_USER,
  id: 'bbbbbbbb-4444-4444-a444-444444444442',
  role: UserRole.MANAGER,
  email: 'gestor@mobile.test',
};

const DRIVER = {
  id: 'cccccccc-4444-4444-a444-444444444444',
  tenantId: TENANT.id,
  userId: DRIVER_USER.id,
  isActive: true,
};

const VEHICLE = {
  id: 'dddddddd-4444-4444-a444-444444444444',
  tenantId: TENANT.id,
  currentDriverId: DRIVER_USER.id,
  category: VehicleCategory.LIGHT,
  currentMileage: 10_000,
};

const TEMPLATE = {
  id: 'eeeeeeee-4444-4444-a444-444444444444',
  tenantId: TENANT.id,
  name: 'Inspeção diária',
  vehicleCategory: VehicleCategory.LIGHT,
  items: [
    {
      id: 'ffffffff-4444-4444-a444-444444444444',
      label: 'Conferir pneus',
      required: true,
      photoRequired: false,
      displayOrder: 0,
    },
  ],
};

function makeToken(user: TokenUser): string {
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
      jwtid: '99999999-4444-4444-a444-444444444444',
    },
  );
}

describe('Mobile E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    prisma.user.findUnique.mockResolvedValue(DRIVER_USER);
    prisma.driver.findFirst.mockResolvedValue(DRIVER);
    prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
    prisma.checklistTemplate.findMany.mockResolvedValue([TEMPLATE]);
  });

  it('GET /mobile/checklist-templates retorna somente modelos do veículo atribuído', async () => {
    const response = await request(app)
      .get('/api/v1/mobile/checklist-templates')
      .set('Authorization', `Bearer ${makeToken(DRIVER_USER)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [{ id: TEMPLATE.id, name: TEMPLATE.name }],
    });
    expect(prisma.checklistTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT.id }),
      }),
    );
  });

  it('bloqueia perfis administrativos nas rotas exclusivas do motorista', async () => {
    prisma.user.findUnique.mockResolvedValue(MANAGER_USER);

    const response = await request(app)
      .get('/api/v1/mobile/checklist-templates')
      .set('Authorization', `Bearer ${makeToken(MANAGER_USER)}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(prisma.checklistTemplate.findMany).not.toHaveBeenCalled();
  });

  it('valida o corpo antes de registrar um abastecimento', async () => {
    const response = await request(app)
      .post('/api/v1/mobile/fuel-records')
      .set('Authorization', `Bearer ${makeToken(DRIVER_USER)}`)
      .send({ mileage: 'quilometragem-inválida' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it('exige autenticação em todo o módulo mobile', async () => {
    const response = await request(app).get('/api/v1/mobile/context');

    expect(response.status).toBe(401);
  });
});
