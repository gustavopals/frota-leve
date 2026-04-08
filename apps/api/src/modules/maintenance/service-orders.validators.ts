import { createServiceOrderSchema, replaceServiceOrderSchema } from '@frota-leve/shared';
import { MaintenanceType, ServiceOrderStatus } from '@frota-leve/shared';
import { z } from 'zod';

const serviceOrderSortFieldSchema = z.enum([
  'status',
  'startDate',
  'endDate',
  'totalCost',
  'createdAt',
  'updatedAt',
]);

type ServiceOrderSortField = z.infer<typeof serviceOrderSortFieldSchema>;

function resolveServiceOrderSort(
  value: {
    order?: string;
    sortBy?: ServiceOrderSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: ServiceOrderSortField,
  defaultSortOrder: 'asc' | 'desc',
) {
  if (!value.order) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  const normalizedOrder = value.order.trim();
  const sortOrder = normalizedOrder.startsWith('-') ? 'desc' : 'asc';
  const rawSortBy = normalizedOrder.replace(/^-/, '') as ServiceOrderSortField;
  const parsedSortBy = serviceOrderSortFieldSchema.safeParse(rawSortBy);

  if (!parsedSortBy.success) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  return {
    sortBy: parsedSortBy.data,
    sortOrder,
  };
}

export const serviceOrderIdParamSchema = z.object({
  id: z.string().uuid('ID da ordem de serviço inválido'),
});

export const createServiceOrderBodySchema = createServiceOrderSchema;
export const replaceServiceOrderBodySchema = replaceServiceOrderSchema;

export const listServiceOrdersQuerySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    type: z.nativeEnum(MaintenanceType).optional(),
    status: z.nativeEnum(ServiceOrderStatus).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: serviceOrderSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveServiceOrderSort(value, 'createdAt', 'desc'),
  }));

export type ServiceOrderIdParams = z.infer<typeof serviceOrderIdParamSchema>;
export type ServiceOrderCreateInput = z.infer<typeof createServiceOrderBodySchema>;
export type ServiceOrderReplaceInput = z.infer<typeof replaceServiceOrderBodySchema>;
export type ServiceOrderListQueryInput = z.infer<typeof listServiceOrdersQuerySchema>;
