import { z } from 'zod';

export const financialVehicleIdParamSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
});

export const financialTcoQuerySchema = z.object({
  currentMarketValue: z.coerce.number().nonnegative('Valor de mercado inválido').optional(),
});

export const financialOverviewQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  monthlyBudget: z.coerce.number().nonnegative('Orçamento mensal inválido').optional(),
});

export const financialComparisonQuerySchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type FinancialVehicleIdParams = z.infer<typeof financialVehicleIdParamSchema>;
export type FinancialTcoQueryInput = z.infer<typeof financialTcoQuerySchema>;
export type FinancialOverviewQueryInput = z.infer<typeof financialOverviewQuerySchema>;
export type FinancialComparisonQueryInput = z.infer<typeof financialComparisonQuerySchema>;
