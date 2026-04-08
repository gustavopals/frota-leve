import { z } from 'zod';
import { TireStatus } from '../enums/tire-status.enum';

function optionalNullableUuid(message: string) {
  return z.preprocess((value) => {
    if (value === '' || value === undefined) {
      return undefined;
    }

    return value;
  }, z.string().uuid(message).optional().nullable());
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().max(maxLength).optional().nullable());
}

const tireSchemaShape = {
  brand: z.string().trim().min(1, 'Marca obrigatória').max(120),
  model: z.string().trim().min(1, 'Modelo obrigatório').max(120),
  size: z.string().trim().min(1, 'Medida obrigatória').max(60),
  serialNumber: z.string().trim().min(1, 'Número de série obrigatório').max(120),
  dot: z.string().trim().min(4, 'DOT inválido').max(40),
  currentVehicleId: optionalNullableUuid('ID do veículo inválido'),
  position: optionalTrimmedString(80),
  currentGrooveDepth: z.coerce.number().nonnegative('Sulco atual deve ser maior ou igual a zero'),
  originalGrooveDepth: z.coerce.number().positive('Sulco original deve ser maior que zero'),
  retreatCount: z.coerce
    .number()
    .int('Quantidade de recapagens deve ser um número inteiro')
    .min(0, 'Quantidade de recapagens não pode ser negativa')
    .max(10, 'Quantidade de recapagens excede o limite suportado')
    .default(0),
  costNew: z.coerce.number().nonnegative('Custo do pneu novo inválido'),
  costRetreat: z.coerce.number().nonnegative('Custo de recapagem inválido').default(0),
  totalKm: z.coerce
    .number()
    .int('Quilometragem total deve ser um número inteiro')
    .min(0, 'Quilometragem total não pode ser negativa')
    .default(0),
};

function withTireConsistency<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return schema.superRefine((value, ctx) => {
    if (value.currentGrooveDepth > value.originalGrooveDepth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentGrooveDepth'],
        message: 'Sulco atual não pode ser maior que o sulco original',
      });
    }

    const hasVehicle = Boolean(value.currentVehicleId);
    const hasPosition = Boolean(value.position);

    if (hasVehicle !== hasPosition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasVehicle ? ['position'] : ['currentVehicleId'],
        message: 'Informe veículo e posição juntos',
      });
    }

    if (value.status === TireStatus.IN_USE && (!hasVehicle || !hasPosition)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentVehicleId'],
        message: 'Pneu em uso deve estar vinculado a um veículo e posição',
      });
    }

    if (value.status !== TireStatus.IN_USE && (hasVehicle || hasPosition)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Apenas pneus em uso podem ficar vinculados a veículo e posição',
      });
    }

    if (value.status === TireStatus.NEW && value.retreatCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['retreatCount'],
        message: 'Pneu novo não pode ter recapagens registradas',
      });
    }

    if (value.status === TireStatus.RETREADED && value.retreatCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['retreatCount'],
        message: 'Pneu recapado deve ter pelo menos uma recapagem registrada',
      });
    }
  });
}

export const createTireSchema = withTireConsistency(
  z.object({
    ...tireSchemaShape,
    status: z.nativeEnum(TireStatus).default(TireStatus.NEW),
  }),
);

export const replaceTireSchema = withTireConsistency(
  z.object({
    ...tireSchemaShape,
    status: z.nativeEnum(TireStatus),
  }),
);

export type CreateTireDto = z.infer<typeof createTireSchema>;
export type ReplaceTireDto = z.infer<typeof replaceTireSchema>;
