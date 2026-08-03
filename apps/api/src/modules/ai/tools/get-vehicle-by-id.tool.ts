import { z } from 'zod';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  plate: z.string().min(1).max(20).optional(),
});

export const getVehicleByIdTool: AITool<typeof inputSchema> = {
  name: 'getVehicleById',
  description:
    'Retorna os detalhes de um veículo específico (custo total, abastecimentos recentes, manutenções abertas). ' +
    'Aceita `vehicleId` (UUID) ou `plate` (placa). Use sempre que a pergunta envolver um veículo identificado.',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      vehicleId: { type: 'string', description: 'UUID do veículo.' },
      plate: { type: 'string', description: 'Placa do veículo (ex: ABC1D23).' },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    if (!input.vehicleId && !input.plate) {
      return { error: 'Informe vehicleId ou plate.' };
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId: ctx.tenantId,
        ...(input.vehicleId ? { id: input.vehicleId } : {}),
        ...(input.plate ? { plate: input.plate.toUpperCase() } : {}),
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        category: true,
        fuelType: true,
        status: true,
        currentMileage: true,
        averageConsumption: true,
        expectedConsumption: true,
      },
    });

    if (!vehicle) {
      return { found: false };
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);

    const [fuelAgg, openOrders, recentFines] = await Promise.all([
      prisma.fuelRecord.aggregate({
        where: { tenantId: ctx.tenantId, vehicleId: vehicle.id, date: { gte: since } },
        _sum: { totalCost: true, liters: true },
        _count: { _all: true },
      }),
      prisma.serviceOrder.count({
        where: {
          tenantId: ctx.tenantId,
          vehicleId: vehicle.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      prisma.fine.count({
        where: { tenantId: ctx.tenantId, vehicleId: vehicle.id, date: { gte: since } },
      }),
    ]);

    return {
      found: true,
      vehicle,
      last90Days: {
        fuelTotalCost: fuelAgg._sum.totalCost ?? 0,
        fuelLiters: fuelAgg._sum.liters ?? 0,
        fuelEntries: fuelAgg._count._all,
        openServiceOrders: openOrders,
        finesCount: recentFines,
      },
    };
  },
};
