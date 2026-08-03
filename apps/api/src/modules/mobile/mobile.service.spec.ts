import { PlanType } from '@frota-leve/database';
import { FuelType } from '@frota-leve/shared';
import { prisma as prismaClient } from '../../config/database';
import { ForbiddenError, ValidationError } from '../../shared/errors';
import { FuelRecordsService } from '../fuel-records/fuel-records.service';
import type { MobileActorContext } from './mobile.types';
import { MobileService } from './mobile.service';

type MockPrisma = {
  driver: { findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  checklistTemplate: { findMany: jest.Mock };
};

jest.mock('../../config/database', () => ({
  prisma: {
    driver: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    checklistTemplate: { findMany: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const CONTEXT: MobileActorContext = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  tenantPlan: PlanType.PROFESSIONAL,
  userId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  ipAddress: '127.0.0.1',
  userAgent: 'Frotafy Mobile',
};

const DRIVER = {
  id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  tenantId: CONTEXT.tenantId,
  userId: CONTEXT.userId,
  isActive: true,
};

const VEHICLE = {
  id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
  tenantId: CONTEXT.tenantId,
  currentDriverId: CONTEXT.userId,
  category: 'LIGHT',
  currentMileage: 20_000,
};

describe('MobileService', () => {
  let service: MobileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobileService();
    prisma.driver.findFirst.mockResolvedValue(DRIVER);
    prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
    prisma.checklistTemplate.findMany.mockResolvedValue([]);
  });

  it('busca templates somente para o tenant e a categoria do veículo atribuído', async () => {
    await service.listChecklistTemplates(CONTEXT);

    expect(prisma.driver.findFirst).toHaveBeenCalledWith({
      where: { tenantId: CONTEXT.tenantId, userId: CONTEXT.userId, isActive: true },
    });
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
      where: { tenantId: CONTEXT.tenantId, currentDriverId: CONTEXT.userId },
    });
    expect(prisma.checklistTemplate.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: CONTEXT.tenantId,
        OR: [{ vehicleCategory: null }, { vehicleCategory: VEHICLE.category }],
      },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  });

  it('impede operação quando o motorista não possui veículo atribuído', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(service.listChecklistTemplates(CONTEXT)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('força motorista e veículo da sessão ao registrar abastecimento', async () => {
    const createFuelRecord = jest
      .spyOn(FuelRecordsService.prototype, 'createFuelRecord')
      .mockResolvedValue({ id: 'fuel-1' } as never);
    const input = {
      date: new Date('2026-08-03T12:00:00.000Z'),
      mileage: 20_100,
      liters: 35,
      pricePerLiter: 6,
      totalCost: 210,
      fuelType: FuelType.GASOLINE,
      fullTank: true,
      gasStation: null,
      notes: null,
      receiptUrl: null,
    };

    await service.createFuelRecord(CONTEXT, input);

    expect(createFuelRecord).toHaveBeenCalledWith(CONTEXT, {
      ...input,
      driverId: DRIVER.id,
      vehicleId: VEHICLE.id,
    });
    createFuelRecord.mockRestore();
  });

  it('rejeita quilometragem anterior à leitura atual do veículo', async () => {
    await expect(
      service.createFuelRecord(CONTEXT, {
        date: new Date(),
        mileage: 19_999,
        liters: 10,
        pricePerLiter: 6,
        totalCost: 60,
        fuelType: FuelType.GASOLINE,
        fullTank: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
