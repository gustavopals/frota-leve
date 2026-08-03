import type { PlanType } from '@frota-leve/database';

export interface MobileActorContext {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}
