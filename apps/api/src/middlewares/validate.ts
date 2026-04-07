import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../shared/errors/app-error';

type ValidateTarget = 'body' | 'params' | 'query';
type RequestSchemaMap = Partial<Record<ValidateTarget, ZodTypeAny>>;

function isSchemaMap(schema: ZodTypeAny | RequestSchemaMap): schema is RequestSchemaMap {
  return !('safeParse' in schema);
}

function assignValidatedValue(req: Request, target: ValidateTarget, value: unknown): void {
  switch (target) {
    case 'body':
      req.body = value;
      return;
    case 'params':
      req.params = value as Request['params'];
      return;
    case 'query':
      req.query = value as Request['query'];
      return;
  }
}

/**
 * Middleware de validação com zod.
 * Aceita um schema único para body/params/query ou um mapa com múltiplos schemas.
 * Em caso de erro, lança ValidationError com os detalhes por alvo/campo.
 * Os dados são substituídos pela versão parseada do zod (com defaults aplicados).
 */
export function validate(schema: ZodTypeAny | RequestSchemaMap, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!isSchemaMap(schema)) {
      const result = schema.safeParse(req[target]);

      if (!result.success) {
        const details = result.error.flatten().fieldErrors;
        next(new ValidationError('Dados inválidos', details));
        return;
      }

      // Substituir pelo objeto parseado (defaults do zod aplicados, tipos coercidos)
      assignValidatedValue(req, target, result.data);
      next();
      return;
    }

    const validationTargets: ValidateTarget[] = ['body', 'params', 'query'];
    const errors: Partial<Record<ValidateTarget, Record<string, string[] | undefined>>> = {};

    for (const validationTarget of validationTargets) {
      const targetSchema = schema[validationTarget];

      if (!targetSchema) {
        continue;
      }

      const result = targetSchema.safeParse(req[validationTarget]);

      if (!result.success) {
        errors[validationTarget] = result.error.flatten().fieldErrors;
        continue;
      }

      assignValidatedValue(req, validationTarget, result.data);
    }

    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Dados inválidos', errors));
      return;
    }

    next();
  };
}
