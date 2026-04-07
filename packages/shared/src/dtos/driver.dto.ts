import { z } from 'zod';
import { isValidCPF } from '../utils/validation.utils';

// Categorias de CNH válidas no Brasil
const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] as const;

export const createDriverSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine(isValidCPF, 'CPF inválido'),
  cnh: z.string().min(1, 'Número da CNH obrigatório'),
  cnhCategory: z.enum(CNH_CATEGORIES, { message: 'Categoria de CNH inválida' }),
  cnhExpiry: z.coerce.date({ message: 'Data de vencimento da CNH inválida' }),
  birthDate: z.coerce.date({ message: 'Data de nascimento inválida' }),
  phone: z.string().min(10, 'Telefone inválido').max(11),
  email: z.string().email('E-mail inválido').optional(),
  notes: z.string().optional(),
});

export const updateDriverSchema = createDriverSchema.partial();

export type CreateDriverDto = z.infer<typeof createDriverSchema>;
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;
