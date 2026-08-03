import { z } from 'zod';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período deve estar no formato YYYY-MM')
    .optional(),
  limit: z.number().int().min(1).max(20).default(5),
  metric: z.enum(['totalCost', 'fuelCost', 'maintenanceCost']).default('totalCost'),
});

function resolveRange(period?: string): { period: string; start: Date; end: Date } {
  const now = new Date();
  let year: number;
  let month: number;
  if (period) {
    const [y, m] = period.split('-');
    year = Number(y);
    month = Number(m);
  } else {
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export const getTopCostVehiclesTool: AITool<typeof inputSchema> = {
  name: 'getTopCostVehicles',
  description:
    'Ranking dos veículos com maior custo no período. Métricas: `totalCost` (combustível + manutenção), `fuelCost`, `maintenanceCost`. ' +
    'Use para "quais veículos gastaram mais?", "top 5 caros do mês".',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
        description: 'Mês YYYY-MM. Padrão: mês corrente.',
      },
      limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      metric: {
        type: 'string',
        enum: ['totalCost', 'fuelCost', 'maintenanceCost'],
        default: 'totalCost',
      },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    const range = resolveRange(input.period);

    const [fuelByVehicle, maintenanceByVehicle] = await Promise.all([
      prisma.fuelRecord.groupBy({
        by: ['vehicleId'],
        where: { tenantId: ctx.tenantId, date: { gte: range.start, lt: range.end } },
        _sum: { totalCost: true },
      }),
      prisma.serviceOrder.groupBy({
        by: ['vehicleId'],
        where: { tenantId: ctx.tenantId, createdAt: { gte: range.start, lt: range.end } },
        _sum: { totalCost: true },
      }),
    ]);

    const totals = new Map<string, { fuelCost: number; maintenanceCost: number }>();
    for (const row of fuelByVehicle) {
      totals.set(row.vehicleId, {
        fuelCost: row._sum.totalCost ?? 0,
        maintenanceCost: 0,
      });
    }
    for (const row of maintenanceByVehicle) {
      const cur = totals.get(row.vehicleId) ?? { fuelCost: 0, maintenanceCost: 0 };
      cur.maintenanceCost = row._sum.totalCost ?? 0;
      totals.set(row.vehicleId, cur);
    }

    const ranked = Array.from(totals.entries())
      .map(([vehicleId, t]) => ({
        vehicleId,
        fuelCost: t.fuelCost,
        maintenanceCost: t.maintenanceCost,
        totalCost: t.fuelCost + t.maintenanceCost,
      }))
      .sort((a, b) => b[input.metric] - a[input.metric])
      .slice(0, input.limit);

    if (ranked.length === 0) {
      return { period: range.period, metric: input.metric, ranking: [] };
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: ctx.tenantId, id: { in: ranked.map((r) => r.vehicleId) } },
      select: { id: true, plate: true, brand: true, model: true, year: true },
    });
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    return {
      period: range.period,
      metric: input.metric,
      ranking: ranked.map((r) => ({
        vehicle: vehicleMap.get(r.vehicleId) ?? { id: r.vehicleId, plate: 'N/A' },
        fuelCost: r.fuelCost,
        maintenanceCost: r.maintenanceCost,
        totalCost: r.totalCost,
      })),
    };
  },
};
