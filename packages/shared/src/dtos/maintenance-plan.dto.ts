import { z } from 'zod';
import { MaintenanceType } from '../enums/maintenance-type.enum';

function optionalCoercedPositiveInt() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().int().positive().optional());
}

function optionalCoercedNonNegativeInt() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().int().nonnegative().optional());
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

export const createMaintenancePlanSchema = z
  .object({
    vehicleId: z.string().uuid('ID do veículo inválido'),
    name: z.string().trim().min(1, 'Nome obrigatório').max(120),
    type: z.nativeEnum(MaintenanceType),
    intervalKm: optionalCoercedPositiveInt(),
    intervalDays: optionalCoercedPositiveInt(),
    lastExecutedAt: optionalCoercedDate(),
    lastExecutedMileage: optionalCoercedNonNegativeInt(),
    nextDueAt: optionalCoercedDate(),
    nextDueMileage: optionalCoercedNonNegativeInt(),
    isActive: z.boolean().default(true).optional(),
  })
  .superRefine((value, ctx) => {
    const hasDateSchedule = value.intervalDays !== undefined || value.nextDueAt !== undefined;
    const hasMileageSchedule = value.intervalKm !== undefined || value.nextDueMileage !== undefined;

    if (!hasDateSchedule && !hasMileageSchedule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um agendamento por data ou por quilometragem',
        path: ['intervalDays'],
      });
    }

    if (value.intervalDays !== undefined && !value.lastExecutedAt && !value.nextDueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a última execução ou a próxima data de vencimento',
        path: ['lastExecutedAt'],
      });
    }

    if (
      value.intervalKm !== undefined &&
      value.lastExecutedMileage === undefined &&
      value.nextDueMileage === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a última execução ou a próxima quilometragem de vencimento',
        path: ['lastExecutedMileage'],
      });
    }

    if (
      value.lastExecutedAt &&
      value.nextDueAt &&
      value.nextDueAt.getTime() < value.lastExecutedAt.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A próxima data de vencimento não pode ser anterior à última execução',
        path: ['nextDueAt'],
      });
    }

    if (
      value.lastExecutedMileage !== undefined &&
      value.nextDueMileage !== undefined &&
      value.nextDueMileage < value.lastExecutedMileage
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A próxima quilometragem não pode ser menor que a última execução',
        path: ['nextDueMileage'],
      });
    }
  });

export const replaceMaintenancePlanSchema = createMaintenancePlanSchema;

export type CreateMaintenancePlanDto = z.infer<typeof createMaintenancePlanSchema>;
export type ReplaceMaintenancePlanDto = z.infer<typeof replaceMaintenancePlanSchema>;
