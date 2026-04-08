-- CreateEnum
CREATE TYPE "public"."document_type" AS ENUM (
    'IPVA',
    'LICENSING',
    'INSURANCE',
    'CNH',
    'ANTT',
    'AET',
    'MOPP',
    'INSPECTION',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "public"."document_status" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "type" "public"."document_type" NOT NULL,
    "description" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "alert_days_before" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION,
    "file_url" TEXT NOT NULL,
    "status" "public"."document_status" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "public"."documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_vehicle_id_idx" ON "public"."documents"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_driver_id_idx" ON "public"."documents"("tenant_id", "driver_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_type_idx" ON "public"."documents"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "documents_tenant_id_status_idx" ON "public"."documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "documents_tenant_id_expiration_date_idx" ON "public"."documents"("tenant_id", "expiration_date");

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
