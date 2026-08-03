import { z } from 'zod';
import { createChecklistExecutionSchema } from './checklist-execution.dto';
import { createFuelRecordSchema } from './fuel-record.dto';
import { createIncidentSchema } from './incident.dto';

export const mobileChecklistExecutionSchema = createChecklistExecutionSchema.omit({
  vehicleId: true,
  driverId: true,
});

export const mobileFuelRecordSchema = createFuelRecordSchema.omit({
  vehicleId: true,
  driverId: true,
});

export const mobileProblemSchema = createIncidentSchema
  .omit({
    vehicleId: true,
    driverId: true,
    insurerNotified: true,
    insuranceClaimNumber: true,
    estimatedCost: true,
    actualCost: true,
    documents: true,
    downtime: true,
    notes: true,
  })
  .extend({
    description: z.string().trim().min(3).max(2000),
    photos: z.array(z.string().url('Foto inválida')).max(5).optional(),
  });

export const responsibilityTermIdSchema = z.object({
  id: z.string().uuid('Termo inválido'),
});

export const signResponsibilityTermSchema = z.object({
  signatureUrl: z.string().url('Assinatura inválida'),
  location: z.string().trim().max(200).optional().nullable(),
});

export type MobileChecklistExecutionInput = z.infer<typeof mobileChecklistExecutionSchema>;
export type MobileFuelRecordInput = z.infer<typeof mobileFuelRecordSchema>;
export type MobileProblemInput = z.infer<typeof mobileProblemSchema>;
export type SignResponsibilityTermInput = z.infer<typeof signResponsibilityTermSchema>;
