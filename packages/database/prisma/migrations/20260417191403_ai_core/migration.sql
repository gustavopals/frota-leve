-- CreateEnum
CREATE TYPE "ai_feature" AS ENUM ('CHAT', 'ANOMALY_EXPLANATION', 'REPORT_MONTHLY', 'REPORT_ON_DEMAND', 'OCR_FUEL', 'OCR_INVOICE', 'DRIVER_SCORING', 'DRIVER_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "ai_usage_status" AS ENUM ('SUCCESS', 'ERROR', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ai_chat_message_role" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "ai_report_kind" AS ENUM ('MONTHLY', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "ai_report_status" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "ai_anomaly_kind" AS ENUM ('FUEL_DEVIATION', 'MAINT_COST', 'FINE_PATTERN', 'COST_PER_KM_TREND', 'OTHER');

-- CreateEnum
CREATE TYPE "ai_anomaly_severity" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "ai_anomaly_status" AS ENUM ('OPEN', 'ACK', 'DISMISSED');

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "feature" "ai_feature" NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_creation_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "status" "ai_usage_status" NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tenant_quotas" (
    "tenant_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "token_budget" INTEGER NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "blocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tenant_quotas_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "ai_chat_message_role" NOT NULL,
    "content" JSONB NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "kind" "ai_report_kind" NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "status" "ai_report_status" NOT NULL,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_anomalies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "ai_anomaly_kind" NOT NULL,
    "severity" "ai_anomaly_severity" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ai_anomaly_status" NOT NULL DEFAULT 'OPEN',
    "detected_at" TIMESTAMP(3) NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "recommendations" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_created_at_idx" ON "ai_usage_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_feature_created_at_idx" ON "ai_usage_logs"("tenant_id", "feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_user_id_created_at_idx" ON "ai_usage_logs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_tenant_quotas_period_start_period_end_idx" ON "ai_tenant_quotas"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "ai_tenant_quotas_blocked_at_idx" ON "ai_tenant_quotas"("blocked_at");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_tenant_id_user_id_created_at_idx" ON "ai_chat_sessions"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_tenant_id_archived_at_idx" ON "ai_chat_sessions"("tenant_id", "archived_at");

-- CreateIndex
CREATE INDEX "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_reports_tenant_id_created_at_idx" ON "ai_reports"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_reports_tenant_id_status_created_at_idx" ON "ai_reports"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reports_tenant_id_period_kind_key" ON "ai_reports"("tenant_id", "period", "kind");

-- CreateIndex
CREATE INDEX "ai_anomalies_tenant_id_status_detected_at_idx" ON "ai_anomalies"("tenant_id", "status", "detected_at");

-- CreateIndex
CREATE INDEX "ai_anomalies_tenant_id_kind_detected_at_idx" ON "ai_anomalies"("tenant_id", "kind", "detected_at");

-- CreateIndex
CREATE INDEX "ai_anomalies_tenant_id_entity_type_entity_id_idx" ON "ai_anomalies"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "driver_scores_tenant_id_driver_id_period_start_idx" ON "driver_scores"("tenant_id", "driver_id", "period_start");

-- CreateIndex
CREATE INDEX "driver_scores_tenant_id_created_at_idx" ON "driver_scores"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "driver_scores_driver_id_period_start_key" ON "driver_scores"("driver_id", "period_start");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tenant_quotas" ADD CONSTRAINT "ai_tenant_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_anomalies" ADD CONSTRAINT "ai_anomalies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_anomalies" ADD CONSTRAINT "ai_anomalies_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_scores" ADD CONSTRAINT "driver_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_scores" ADD CONSTRAINT "driver_scores_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
