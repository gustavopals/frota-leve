import { z } from 'zod';
import { isValidCPF } from '../utils/validation.utils';

// Categorias de CNH válidas no Brasil
export const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] as const;
export type CnhCategory = (typeof CNH_CATEGORIES)[number];

export const createDriverSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine(isValidCPF, 'CPF inválido'),
  phone: z.string().min(10, 'Telefone inválido').max(11).optional(),
  email: z.string().email('E-mail inválido').optional(),
  birthDate: z.coerce.date({ message: 'Data de nascimento inválida' }).optional(),
  cnhNumber: z.string().min(1).max(20).optional(),
  cnhCategory: z.enum(CNH_CATEGORIES, { message: 'Categoria de CNH inválida' }).optional(),
  cnhExpiration: z.coerce.date({ message: 'Data de vencimento da CNH inválida' }).optional(),
  cnhPoints: z.number().int().min(0).max(40).default(0).optional(),
  emergencyContact: z.string().max(120).optional(),
  emergencyPhone: z.string().min(10).max(11).optional(),
  department: z.string().max(80).optional(),
  isActive: z.boolean().default(true).optional(),
  photoUrl: z.string().url('URL da foto inválida').optional(),
  hireDate: z.coerce.date({ message: 'Data de contratação inválida' }).optional(),
  score: z.number().min(0).max(100).default(100).optional(),
  notes: z.string().max(1000).optional(),
  userId: z.string().uuid('ID de usuário inválido').optional(),
});

export const updateDriverSchema = createDriverSchema.partial();

export type CreateDriverDto = z.infer<typeof createDriverSchema>;
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;
