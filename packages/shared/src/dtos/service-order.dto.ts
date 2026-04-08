import { z } from 'zod';
import { MaintenanceType } from '../enums/maintenance-type.enum';
import { ServiceOrderStatus } from '../enums/os-status.enum';

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().max(maxLength).optional());
}

function optionalCoercedDate() {
  return z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      return value;
    },
    z.coerce.date({ message: 'Data inválida' }).optional(),
  );
}

function optionalCoercedNonNegativeNumber() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().nonnegative().optional());
}

export const serviceOrderItemSchema = z.object({
  description: z.string().trim().min(1, 'Descrição obrigatória').max(200),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  unitCost: z.coerce.number().nonnegative('Custo unitário inválido'),
  totalCost: optionalCoercedNonNegativeNumber(),
  partNumber: optionalTrimmedString(80),
});

const serviceOrderBaseSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  driverId: z.string().uuid('ID do motorista inválido').optional().nullable(),
  planId: z.string().uuid('ID do plano inválido').optional().nullable(),
  type: z.nativeEnum(MaintenanceType),
  description: z.string().trim().min(1, 'Descrição obrigatória').max(500),
  workshop: optionalTrimmedString(120),
  startDate: optionalCoercedDate(),
  endDate: optionalCoercedDate(),
  totalCost: optionalCoercedNonNegativeNumber(),
  laborCost: optionalCoercedNonNegativeNumber(),
  partsCost: optionalCoercedNonNegativeNumber(),
  notes: optionalTrimmedString(4000),
  photos: z.array(z.string().url('URL de foto inválida')).max(10).optional(),
  items: z.array(serviceOrderItemSchema).max(50).default([]),
});

export const createServiceOrderSchema = serviceOrderBaseSchema
  .extend({
    status: z.nativeEnum(ServiceOrderStatus).optional().default(ServiceOrderStatus.OPEN),
  })
  .superRefine((value, ctx) => {
    if (value.status !== ServiceOrderStatus.OPEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nova ordem de serviço deve iniciar com status OPEN',
        path: ['status'],
      });
    }

    if (value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de início não pode ser informada ao criar uma OS em aberto',
        path: ['startDate'],
      });
    }

    if (value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de conclusão não pode ser informada ao criar uma OS em aberto',
        path: ['endDate'],
      });
    }
  });

export const replaceServiceOrderSchema = serviceOrderBaseSchema
  .extend({
    status: z.nativeEnum(ServiceOrderStatus),
  })
  .superRefine((value, ctx) => {
    if (
      value.status !== ServiceOrderStatus.IN_PROGRESS &&
      value.status !== ServiceOrderStatus.COMPLETED &&
      value.startDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de início só é permitida para ordens em andamento ou concluídas',
        path: ['startDate'],
      });
    }

    if (value.status !== ServiceOrderStatus.COMPLETED && value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de conclusão só é permitida para ordens concluídas',
        path: ['endDate'],
      });
    }

    if (value.startDate && value.endDate && value.endDate.getTime() < value.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de conclusão não pode ser anterior à data de início',
        path: ['endDate'],
      });
    }
  });

export type ServiceOrderItemDto = z.infer<typeof serviceOrderItemSchema>;
export type CreateServiceOrderDto = z.infer<typeof createServiceOrderSchema>;
export type ReplaceServiceOrderDto = z.infer<typeof replaceServiceOrderSchema>;
