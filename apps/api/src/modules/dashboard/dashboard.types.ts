import type { PlanType } from '@frota-leve/database';

export type DashboardActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};
