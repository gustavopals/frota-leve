import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

/**
 * A partir do Prisma 7 a conexao nao vem mais do bloco `datasource` do schema:
 * o client precisa receber um driver adapter explicito.
 *
 * Nao valida `DATABASE_URL` aqui de proposito. O adapter so abre conexao no
 * primeiro query, e importar este modulo (por exemplo para usar um enum gerado)
 * precisa continuar funcionando sem banco configurado. Quem exige a variavel é o
 * boot da API, em `apps/api/src/config/env.ts`.
 */
export function createPrismaAdapter(): PrismaPg {
  return new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createPrismaAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
