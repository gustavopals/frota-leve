import { z } from 'zod';
import { ChecklistItemStatus } from '../enums/checklist-status.enum';

export const checklistExecutionItemInputSchema = z.object({
  checklistItemId: z.string().uuid('ID do item de checklist inválido'),
  status: z.nativeEnum(ChecklistItemStatus, { message: 'Status do item inválido' }),
  photoUrl: z.string().trim().url('URL da foto inválida').optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const createChecklistExecutionSchema = z.object({
  templateId: z.string().uuid('ID do template inválido'),
  vehicleId: z.string().uuid('ID do veículo inválido'),
  driverId: z.string().uuid('ID do motorista inválido'),
  executedAt: z.coerce.date({ message: 'Data de execução inválida' }),
  signatureUrl: z.string().trim().url('URL da assinatura inválida').optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  items: z
    .array(checklistExecutionItemInputSchema)
    .min(1, 'Informe ao menos um item executado')
    .max(100, 'Máximo de 100 itens por execução'),
});

export type ChecklistExecutionItemInputDto = z.infer<typeof checklistExecutionItemInputSchema>;
export type CreateChecklistExecutionDto = z.infer<typeof createChecklistExecutionSchema>;
