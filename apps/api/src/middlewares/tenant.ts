import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware de identificação e validação do tenant.
 * Lê tenantId de req.user (populado pelo middleware de auth),
 * busca o tenant no banco e popula req.tenant.
 *
 * TODO TASK 1.1 — implementar após autenticação estar pronta:
 *   - Buscar tenant pelo tenantId do req.user
 *   - Verificar se status é ACTIVE ou TRIAL (bloquear SUSPENDED e CANCELLED)
 *   - Setar req.tenant com { id, name, plan, status }
 */
export function tenantMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  // Placeholder — implementação real na TASK 1.1
  next();
}
