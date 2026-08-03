import { Prisma, PlanType, prisma } from '@frota-leve/database';
import { PLAN_LIMITS } from '@frota-leve/shared';
import { AIPlanRequiredError, AIQuotaExceededError, AiError } from './errors';

type QuotaRecord = {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  tokenBudget: number;
  tokensUsed: number;
  costUsdMicros: number;
  blockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TenantPlanRecord = {
  id: string;
  plan: PlanType;
};

function getQuotaPeriod(referenceDate: Date): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const periodEnd = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );

  return { periodStart, periodEnd };
}

function normalizeTokenAmount(value: number): number {
  return Math.max(0, Math.ceil(value));
}

async function getTenantPlanOrThrow(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<TenantPlanRecord> {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true },
  });

  if (!tenant) {
    throw new AiError(`Tenant ${tenantId} nao foi encontrado.`);
  }

  const limits = PLAN_LIMITS[tenant.plan];

  if (!limits.hasAI) {
    throw new AIPlanRequiredError(tenantId);
  }

  return tenant;
}

async function findQuotaRecord(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<QuotaRecord | null> {
  const [quota] = await tx.$queryRaw<QuotaRecord[]>(Prisma.sql`
    SELECT
      tenant_id AS "tenantId",
      period_start AS "periodStart",
      period_end AS "periodEnd",
      token_budget AS "tokenBudget",
      tokens_used AS "tokensUsed",
      cost_usd_micros AS "costUsdMicros",
      blocked_at AS "blockedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.ai_tenant_quotas
    WHERE tenant_id = ${tenantId}::uuid
    LIMIT 1
  `);

  return quota ?? null;
}

async function createQuotaRecord(
  tx: Prisma.TransactionClient,
  tenantId: string,
  plan: PlanType,
  referenceDate: Date,
): Promise<QuotaRecord> {
  const limits = PLAN_LIMITS[plan];
  const { periodStart, periodEnd } = getQuotaPeriod(referenceDate);
  const [quota] = await tx.$queryRaw<QuotaRecord[]>(Prisma.sql`
    INSERT INTO public.ai_tenant_quotas (
      tenant_id,
      period_start,
      period_end,
      token_budget,
      tokens_used,
      cost_usd_micros,
      blocked_at,
      created_at,
      updated_at
    )
    VALUES (
      ${tenantId}::uuid,
      ${periodStart},
      ${periodEnd},
      ${limits.aiMonthlyTokenBudget},
      0,
      0,
      NULL,
      NOW(),
      NOW()
    )
    RETURNING
      tenant_id AS "tenantId",
      period_start AS "periodStart",
      period_end AS "periodEnd",
      token_budget AS "tokenBudget",
      tokens_used AS "tokensUsed",
      cost_usd_micros AS "costUsdMicros",
      blocked_at AS "blockedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);

  return quota;
}

async function resetQuotaRecordForPeriod(
  tx: Prisma.TransactionClient,
  tenantId: string,
  plan: PlanType,
  referenceDate: Date,
): Promise<QuotaRecord> {
  const limits = PLAN_LIMITS[plan];
  const { periodStart, periodEnd } = getQuotaPeriod(referenceDate);
  const [quota] = await tx.$queryRaw<QuotaRecord[]>(Prisma.sql`
    UPDATE public.ai_tenant_quotas
    SET
      period_start = ${periodStart},
      period_end = ${periodEnd},
      token_budget = ${limits.aiMonthlyTokenBudget},
      tokens_used = 0,
      cost_usd_micros = 0,
      blocked_at = NULL,
      updated_at = NOW()
    WHERE tenant_id = ${tenantId}::uuid
    RETURNING
      tenant_id AS "tenantId",
      period_start AS "periodStart",
      period_end AS "periodEnd",
      token_budget AS "tokenBudget",
      tokens_used AS "tokensUsed",
      cost_usd_micros AS "costUsdMicros",
      blocked_at AS "blockedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);

  return quota;
}

async function ensureQuotaRecord(
  tx: Prisma.TransactionClient,
  tenantId: string,
  referenceDate = new Date(),
): Promise<{ tenant: TenantPlanRecord; quota: QuotaRecord }> {
  const tenant = await getTenantPlanOrThrow(tx, tenantId);
  const expectedPeriod = getQuotaPeriod(referenceDate);
  const existingQuota = await findQuotaRecord(tx, tenantId);

  if (!existingQuota) {
    const createdQuota = await createQuotaRecord(tx, tenantId, tenant.plan, referenceDate);
    return { tenant, quota: createdQuota };
  }

  if (existingQuota.periodStart.getTime() !== expectedPeriod.periodStart.getTime()) {
    const resetQuota = await resetQuotaRecordForPeriod(tx, tenantId, tenant.plan, referenceDate);
    return { tenant, quota: resetQuota };
  }

  return { tenant, quota: existingQuota };
}

async function blockQuota(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE public.ai_tenant_quotas
    SET
      blocked_at = COALESCE(blocked_at, NOW()),
      updated_at = NOW()
    WHERE tenant_id = ${tenantId}::uuid
  `);
}

export async function getTenantQuotaSnapshot(
  tenantId: string,
  referenceDate = new Date(),
): Promise<QuotaRecord> {
  return prisma.$transaction(async (tx) => {
    const { quota } = await ensureQuotaRecord(tx, tenantId, referenceDate);
    return quota;
  });
}

export async function checkAndReserveQuota(
  tenantId: string,
  estimatedTokens: number,
): Promise<void> {
  const tokensToReserve = normalizeTokenAmount(estimatedTokens);

  await prisma.$transaction(async (tx) => {
    const { quota } = await ensureQuotaRecord(tx, tenantId);

    if (quota.blockedAt || quota.tokenBudget <= 0) {
      await blockQuota(tx, tenantId);
      throw new AIQuotaExceededError(tenantId);
    }

    if (tokensToReserve === 0) {
      return;
    }

    const updatedRows = await tx.$queryRaw<QuotaRecord[]>(Prisma.sql`
      UPDATE public.ai_tenant_quotas
      SET
        tokens_used = tokens_used + ${tokensToReserve},
        blocked_at = CASE
          WHEN token_budget > 0 AND tokens_used + ${tokensToReserve} >= token_budget
            THEN COALESCE(blocked_at, NOW())
          ELSE blocked_at
        END,
        updated_at = NOW()
      WHERE
        tenant_id = ${tenantId}::uuid
        AND blocked_at IS NULL
        AND token_budget > 0
        AND tokens_used + ${tokensToReserve} <= token_budget
      RETURNING
        tenant_id AS "tenantId",
        period_start AS "periodStart",
        period_end AS "periodEnd",
        token_budget AS "tokenBudget",
        tokens_used AS "tokensUsed",
        cost_usd_micros AS "costUsdMicros",
        blocked_at AS "blockedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    if (updatedRows.length > 0) {
      return;
    }

    await blockQuota(tx, tenantId);
    throw new AIQuotaExceededError(tenantId);
  });
}

export async function commitQuota(
  tenantId: string,
  actualTokens: number,
  costUsdMicros: number,
  reservedTokens = 0,
): Promise<void> {
  const normalizedActualTokens = normalizeTokenAmount(actualTokens);
  const normalizedReservedTokens = normalizeTokenAmount(reservedTokens);
  const deltaTokens = normalizedActualTokens - normalizedReservedTokens;
  const normalizedCostUsdMicros = Math.max(0, Math.round(costUsdMicros));

  await prisma.$transaction(async (tx) => {
    await ensureQuotaRecord(tx, tenantId);

    await tx.$executeRaw(Prisma.sql`
      UPDATE public.ai_tenant_quotas
      SET
        tokens_used = GREATEST(0, tokens_used + ${deltaTokens}),
        cost_usd_micros = cost_usd_micros + ${normalizedCostUsdMicros},
        blocked_at = CASE
          WHEN token_budget > 0 AND GREATEST(0, tokens_used + ${deltaTokens}) >= token_budget
            THEN COALESCE(blocked_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}::uuid
    `);
  });
}

export async function refundQuota(tenantId: string, reservedTokens: number): Promise<void> {
  const normalizedReservedTokens = normalizeTokenAmount(reservedTokens);

  if (normalizedReservedTokens === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await ensureQuotaRecord(tx, tenantId);

    await tx.$executeRaw(Prisma.sql`
      UPDATE public.ai_tenant_quotas
      SET
        tokens_used = GREATEST(0, tokens_used - ${normalizedReservedTokens}),
        blocked_at = CASE
          WHEN token_budget > 0 AND GREATEST(0, tokens_used - ${normalizedReservedTokens}) >= token_budget
            THEN COALESCE(blocked_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}::uuid
    `);
  });
}

export async function resetTenantQuotaPeriod(
  tenantId: string,
  referenceDate = new Date(),
): Promise<QuotaRecord> {
  return prisma.$transaction(async (tx) => {
    const { tenant } = await ensureQuotaRecord(tx, tenantId, referenceDate);
    return resetQuotaRecordForPeriod(tx, tenantId, tenant.plan, referenceDate);
  });
}

export async function resetExpiredTenantQuotas(referenceDate = new Date()): Promise<number> {
  const aiTenants = await prisma.tenant.findMany({
    where: {
      plan: {
        in: [PlanType.PROFESSIONAL, PlanType.ENTERPRISE],
      },
    },
    select: {
      id: true,
      plan: true,
    },
  });

  let resets = 0;

  for (const tenant of aiTenants) {
    const quota = await findQuotaRecord(prisma, tenant.id);

    if (!quota) {
      await createQuotaRecord(prisma, tenant.id, tenant.plan, referenceDate);
      resets += 1;
      continue;
    }

    if (quota.periodEnd <= referenceDate) {
      await resetQuotaRecordForPeriod(prisma, tenant.id, tenant.plan, referenceDate);
      resets += 1;
    }
  }

  return resets;
}
