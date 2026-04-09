import { z } from 'zod';
import { VehicleCategory } from '../enums/vehicle-category.enum';

export const checklistTemplateItemSchema = z.object({
  label: z.string().trim().min(1, 'Rótulo do item obrigatório').max(200),
  required: z.boolean().default(true),
  photoRequired: z.boolean().default(false),
});

const checklistTemplateBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nome do template obrigatório').max(120),
  vehicleCategory: z.nativeEnum(VehicleCategory).optional().nullable(),
  items: z
    .array(checklistTemplateItemSchema)
    .min(1, 'Informe ao menos um item no checklist')
    .max(100, 'Máximo de 100 itens por checklist'),
});

export const createChecklistTemplateSchema = checklistTemplateBaseSchema;
export const replaceChecklistTemplateSchema = checklistTemplateBaseSchema;

export type ChecklistTemplateItemDto = z.infer<typeof checklistTemplateItemSchema>;
export type CreateChecklistTemplateDto = z.infer<typeof createChecklistTemplateSchema>;
export type ReplaceChecklistTemplateDto = z.infer<typeof replaceChecklistTemplateSchema>;
