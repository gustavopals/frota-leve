import { DocumentStatus, Prisma } from '@frota-leve/database';

export const DOCUMENT_ENTITY = 'Document';
export const DOCUMENT_EXPIRING_ACTION = 'DOCUMENT_EXPIRING';
export const DOCUMENT_EXPIRED_ACTION = 'DOCUMENT_EXPIRED';
export const DOCUMENT_ALERT_SCHEDULER_USER_AGENT = 'document-alert-scheduler';
export const DOCUMENT_CRITICAL_ALERT_DAYS = 7;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

type RawExecutor = {
  $executeRaw(query: Prisma.Sql): Promise<unknown>;
};

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, days: number): Date {
  const result = startOfDay(value);
  result.setDate(result.getDate() + days);
  return result;
}

export function resolveDocumentStatus(
  expirationDate: Date,
  alertDaysBefore: number,
  referenceDate: Date = new Date(),
): DocumentStatus {
  const today = startOfDay(referenceDate);
  const expirationDay = startOfDay(expirationDate);

  if (expirationDay.getTime() < today.getTime()) {
    return DocumentStatus.EXPIRED;
  }

  const alertLimit = addDays(today, alertDaysBefore);

  if (expirationDay.getTime() <= alertLimit.getTime()) {
    return DocumentStatus.EXPIRING;
  }

  return DocumentStatus.VALID;
}

export function getDaysUntilExpiration(
  expirationDate: Date,
  referenceDate: Date = new Date(),
): number {
  return Math.ceil(
    (startOfDay(expirationDate).getTime() - startOfDay(referenceDate).getTime()) / DAY_IN_MS,
  );
}

export async function refreshDocumentStatuses(
  client: RawExecutor,
  tenantId?: string,
  documentId?: string,
): Promise<void> {
  const filters: Prisma.Sql[] = [];

  if (tenantId) {
    filters.push(Prisma.sql`"tenant_id" = CAST(${tenantId} AS UUID)`);
  }

  if (documentId) {
    filters.push(Prisma.sql`"id" = CAST(${documentId} AS UUID)`);
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "public"."documents"
    SET "status" = CASE
      WHEN "expiration_date"::date < CURRENT_DATE THEN CAST('EXPIRED' AS "public"."document_status")
      WHEN "expiration_date"::date <= CURRENT_DATE + ("alert_days_before" * INTERVAL '1 day')
        THEN CAST('EXPIRING' AS "public"."document_status")
      ELSE CAST('VALID' AS "public"."document_status")
    END
    ${filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty}
  `);
}
