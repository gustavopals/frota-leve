import type { PlanType, TenantStatus, UserRole } from '@frota-leve/database';

declare global {
  namespace Express {
    interface Request {
      /** ID único gerado por request (UUID v4) — injetado pelo middleware request-id */
      requestId: string;

      /** Usuário autenticado — injetado pelo middleware auth */
      user?: {
        id: string;
        tenantId: string;
        role: UserRole;
        email: string;
      };

      /** Dados do tenant — injetado pelo middleware tenant */
      tenant?: {
        id: string;
        name: string;
        plan: PlanType;
        status: TenantStatus;
        trialEndsAt: Date | null;
      };
    }
  }
}

export {};
