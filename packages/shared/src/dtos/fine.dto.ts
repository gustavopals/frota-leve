import { z } from 'zod';
import { FineSeverity } from '../enums/fine-severity.enum';
import { FineStatus } from '../enums/fine-status.enum';

const fineBaseSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  driverId: z.string().uuid('ID do motorista inválido').optional().nullable(),
  date: z.coerce.date({ message: 'Data da infração inválida' }),
  autoNumber: z.string().trim().min(1, 'Número do auto obrigatório').max(40),
  location: z.string().trim().min(1, 'Local obrigatório').max(200),
  description: z.string().trim().min(1, 'Descrição obrigatória').max(500),
  severity: z.nativeEnum(FineSeverity, { message: 'Gravidade inválida' }),
  points: z.coerce.number().int().min(0, 'Pontuação inválida'),
  amount: z.coerce.number().nonnegative('Valor inválido'),
  discountAmount: z.coerce.number().nonnegative('Valor de desconto inválido').optional().nullable(),
  dueDate: z.coerce.date({ message: 'Data de vencimento inválida' }),
  payrollDeduction: z.boolean().default(false),
  notes: z.string().trim().max(4000).optional().nullable(),
  fileUrl: z.string().url('URL do arquivo inválida').optional().nullable(),
});

export const createFineSchema = fineBaseSchema;

export const updateFineSchema = fineBaseSchema.extend({
  status: z.nativeEnum(FineStatus, { message: 'Status inválido' }),
});

export type CreateFineDto = z.infer<typeof createFineSchema>;
export type UpdateFineDto = z.infer<typeof updateFineSchema>;
