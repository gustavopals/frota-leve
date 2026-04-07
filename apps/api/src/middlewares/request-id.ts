import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Injeta um ID único por request.
 * Reutiliza o header X-Request-Id se fornecido pelo cliente (ex: gateway, testes).
 * Disponibiliza via req.requestId e responde com X-Request-Id no header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' ? existingId : uuidv4();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  next();
}
