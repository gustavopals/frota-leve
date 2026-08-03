import { z } from 'zod';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  driverId: z.string().uuid().optional(),
  driverName: z.string().min(1).max(200).optional(),
  days: z.number().int().min(7).max(365).default(90),
});

export const getDriverMetricsTool: AITool<typeof inputSchema> = {
  name: 'getDriverMetrics',
  description:
    'Métricas de um motorista: consumo médio, multas, sinistros, score atual. Use para "como está o desempenho do João?", ' +
    '"motorista X tem multas?". Aceita `driverId` (UUID) ou `driverName` (busca por nome parcial).',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      driverId: { type: 'string', description: 'UUID do motorista.' },
      driverName: { type: 'string', description: 'Nome (ou parte do nome) do motorista.' },
      days: { type: 'integer', minimum: 7, maximum: 365, default: 90 },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    if (!input.driverId && !input.driverName) {
      return { error: 'Informe driverId ou driverName.' };
    }

    const driverWhere = input.driverId
      ? { tenantId: ctx.tenantId, id: input.driverId }
      : {
          tenantId: ctx.tenantId,
          name: { contains: input.driverName, mode: 'insensitive' as const },
        };

    const driver = await prisma.driver.findFirst({
      where: {
        ...driverWhere,
      },
      select: {
        id: true,
        name: true,
        cnhCategory: true,
        cnhExpiration: true,
        cnhPoints: true,
        score: true,
        isActive: true,
      },
    });

    if (!driver) {
      return { found: false };
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - input.days);

    const [fuelAgg, fines, incidents] = await Promise.all([
      prisma.fuelRecord.aggregate({
        where: { tenantId: ctx.tenantId, driverId: driver.id, date: { gte: since } },
        _avg: { kmPerLiter: true },
        _sum: { totalCost: true, liters: true },
        _count: { _all: true },
      }),
      prisma.fine.aggregate({
        where: { tenantId: ctx.tenantId, driverId: driver.id, date: { gte: since } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.incident.count({
        where: { tenantId: ctx.tenantId, driverId: driver.id, date: { gte: since } },
      }),
    ]);

    return {
      found: true,
      driver,
      windowDays: input.days,
      metrics: {
        fuelEntries: fuelAgg._count._all,
        avgKmPerLiter: fuelAgg._avg.kmPerLiter ?? null,
        totalFuelCost: fuelAgg._sum.totalCost ?? 0,
        totalLiters: fuelAgg._sum.liters ?? 0,
        finesCount: fines._count?._all ?? 0,
        finesValue: fines._sum?.amount ?? 0,
        incidentsCount: incidents,
      },
    };
  },
};
