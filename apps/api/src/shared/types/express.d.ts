// Augmentation do tipo Request do Express — adiciona campos injetados pelos middlewares
declare namespace Express {
  interface Request {
    /** ID único gerado por request (UUID v4) — injetado pelo middleware request-id */
    requestId: string;

    /** Usuário autenticado — injetado pelo middleware auth (TASK 1.1) */
    user?: {
      id: string;
      tenantId: string;
      role: string;
      email: string;
    };

    /** Dados do tenant — injetado pelo middleware tenant (TASK 1.1) */
    tenant?: {
      id: string;
      name: string;
      plan: string;
      status: string;
    };
  }
}
