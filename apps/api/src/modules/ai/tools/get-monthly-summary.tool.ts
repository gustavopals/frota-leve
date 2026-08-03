import { z } from 'zod';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período deve estar no formato YYYY-MM')
    .optional()
    .describe('Mês no formato YYYY-MM. Padrão: mês corrente.'),
});

function resolvePeriod(period?: string): { period: string; start: Date; end: Date } {
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

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    period: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`,
    start,
    end,
  };
}

export const getMonthlySummaryTool: AITool<typeof inputSchema> = {
  name: 'getMonthlySummary',
  description:
    'Retorna agregados financeiros e operacionais de um mês: total gasto com combustível, manutenções, multas, sinistros, ' +
    'consumo médio (km/l) e comparativo com o mês anterior. Use para "como foi março?", "resumo do mês", "quanto gastei em abril?".',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
        description: 'Mês no formato YYYY-MM (ex: 2026-03). Padrão: mês corrente.',
      },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    const current = resolvePeriod(input.period);
    const previousMonthDate = new Date(current.start);
    previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
    const previous = resolvePeriod(
      `${previousMonthDate.getUTCFullYear()}-${(previousMonthDate.getUTCMonth() + 1).toString().padStart(2, '0')}`,
    );

    async function aggregateRange(start: Date, end: Date) {
      const [fuel, orders, fines, incidents] = await Promise.all([
        prisma.fuelRecord.aggregate({
          where: { tenantId: ctx.tenantId, date: { gte: start, lt: end } },
          _sum: { totalCost: true, liters: true, kmPerLiter: true },
          _count: { _all: true },
          _avg: { kmPerLiter: true },
        }),
        prisma.serviceOrder.aggregate({
          where: { tenantId: ctx.tenantId, createdAt: { gte: start, lt: end } },
          _sum: { totalCost: true },
          _count: { _all: true },
        }),
        prisma.fine.aggregate({
          where: { tenantId: ctx.tenantId, date: { gte: start, lt: end } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.incident.count({
          where: { tenantId: ctx.tenantId, date: { gte: start, lt: end } },
        }),
      ]);

      return {
        fuel: {
          totalCost: fuel._sum.totalCost ?? 0,
          liters: fuel._sum.liters ?? 0,
          entries: fuel._count._all,
          avgKmPerLiter: fuel._avg.kmPerLiter ?? null,
        },
        maintenance: {
          totalCost: orders._sum.totalCost ?? 0,
          orders: orders._count._all,
        },
        fines: {
          totalValue: fines._sum?.amount ?? 0,
          count: fines._count?._all ?? 0,
        },
        incidents,
      };
    }

    const [currentData, previousData] = await Promise.all([
      aggregateRange(current.start, current.end),
      aggregateRange(previous.start, previous.end),
    ]);

    const currentTotal =
      currentData.fuel.totalCost + currentData.maintenance.totalCost + currentData.fines.totalValue;
    const previousTotal =
      previousData.fuel.totalCost +
      previousData.maintenance.totalCost +
      previousData.fines.totalValue;

    const variation =
      previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;

    return {
      period: current.period,
      previousPeriod: previous.period,
      current: { ...currentData, totalCost: currentTotal },
      previous: { ...previousData, totalCost: previousTotal },
      variationPercent: variation,
    };
  },
};
