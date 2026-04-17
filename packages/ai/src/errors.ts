export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export class AiNotImplementedError extends AiError {
  constructor(scope: string) {
    super(`${scope} ainda nao foi implementado.`);
    this.name = 'AiNotImplementedError';
  }
}

export class AIConfigurationError extends AiError {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigurationError';
  }
}

export class AIPlanRequiredError extends AiError {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} nao possui acesso aos recursos de IA no plano atual.`);
    this.name = 'AIPlanRequiredError';
  }
}

export class AIModelNotAllowedError extends AiError {
  constructor(model: string) {
    super(`Modelo ${model} nao esta liberado para o plano atual do tenant.`);
    this.name = 'AIModelNotAllowedError';
  }
}

export class AIQuotaExceededError extends AiError {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} excedeu o budget mensal de IA.`);
    this.name = 'AIQuotaExceededError';
  }
}

export class AIProviderError extends AiError {
  readonly code: string;

  readonly cause?: unknown;

  constructor(message: string, code = 'AI_PROVIDER_ERROR', cause?: unknown) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.cause = cause;
  }
}
