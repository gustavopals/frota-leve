import { z } from 'zod';
import { IncidentStatus } from '../enums/incident-status.enum';
import { IncidentType } from '../enums/incident-type.enum';

const incidentAssetSchema = z
  .array(z.string().trim().url('URL inválida'))
  .max(20, 'Máximo de 20 arquivos')
  .optional()
  .nullable();

const incidentBaseSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  driverId: z.string().uuid('ID do motorista inválido').optional().nullable(),
  date: z.coerce.date({ message: 'Data do sinistro inválida' }),
  location: z.string().trim().min(1, 'Local obrigatório').max(200),
  type: z.nativeEnum(IncidentType, { message: 'Tipo de sinistro inválido' }),
  description: z.string().trim().min(1, 'Descrição obrigatória').max(2000),
  thirdPartyInvolved: z.boolean().default(false),
  policeReport: z.boolean().default(false),
  insurerNotified: z.boolean().default(false),
  insuranceClaimNumber: z.string().trim().max(80).optional().nullable(),
  estimatedCost: z.coerce.number().nonnegative('Custo estimado inválido').optional().nullable(),
  actualCost: z.coerce.number().nonnegative('Custo real inválido').optional().nullable(),
  photos: incidentAssetSchema,
  documents: incidentAssetSchema,
  downtime: z.coerce.number().int().nonnegative('Indisponibilidade inválida').optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const createIncidentSchema = incidentBaseSchema;

export const updateIncidentSchema = incidentBaseSchema.extend({
  status: z.nativeEnum(IncidentStatus, { message: 'Status inválido' }),
});

export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentDto = z.infer<typeof updateIncidentSchema>;
