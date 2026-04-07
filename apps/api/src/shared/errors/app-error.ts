/**
 * Classe base para erros de aplicação com código, status HTTP e detalhes opcionais.
 * Todos os erros de domínio devem estender esta classe.
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    // Necessário para instanceof funcionar corretamente com classes que estendem Error
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 404 — recurso não encontrado */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/** 400 — dados de entrada inválidos (validação zod) */
export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/** 401 — não autenticado */
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — autenticado mas sem permissão */
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso proibido', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
    this.name = 'ForbiddenError';
  }
}

/** 409 — conflito (ex: e-mail ou placa já cadastrados) */
export class ConflictError extends AppError {
  constructor(message = 'Recurso já existe', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/** 402 — plano não permite esta operação */
export class PlanLimitError extends AppError {
  constructor(message = 'Limite do plano atingido', details?: unknown) {
    super(message, 402, 'PLAN_LIMIT_EXCEEDED', details);
    this.name = 'PlanLimitError';
  }
}

/** 429 — muitas requisições em uma janela curta */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas requisições', details?: unknown) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
    this.name = 'TooManyRequestsError';
  }
}
