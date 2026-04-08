-- CreateEnum
CREATE TYPE "public"."tire_status" AS ENUM ('NEW', 'IN_USE', 'RETREADED', 'DISCARDED');

-- CreateTable
CREATE TABLE "public"."tires" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "dot" TEXT NOT NULL,
    "status" "public"."tire_status" NOT NULL DEFAULT 'NEW',
    "current_vehicle_id" UUID,
    "position" TEXT,
    "current_groove_depth" DOUBLE PRECISION NOT NULL,
    "original_groove_depth" DOUBLE PRECISION NOT NULL,
    "retreat_count" INTEGER NOT NULL DEFAULT 0,
    "cost_new" DOUBLE PRECISION NOT NULL,
    "cost_retreat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_km" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tire_inspections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tire_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "inspected_by_user_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "groove_depth" DOUBLE PRECISION NOT NULL,
    "position" TEXT NOT NULL,
    "photos" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tire_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tires_tenant_id_serial_number_key" ON "public"."tires"("tenant_id", "serial_number");

-- CreateIndex
CREATE INDEX "tires_tenant_id_idx" ON "public"."tires"("tenant_id");

-- CreateIndex
CREATE INDEX "tires_tenant_id_status_idx" ON "public"."tires"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tires_tenant_id_current_vehicle_id_idx" ON "public"."tires"("tenant_id", "current_vehicle_id");

-- CreateIndex
CREATE INDEX "tire_inspections_tenant_id_idx" ON "public"."tire_inspections"("tenant_id");

-- CreateIndex
CREATE INDEX "tire_inspections_tenant_id_tire_id_idx" ON "public"."tire_inspections"("tenant_id", "tire_id");

-- CreateIndex
CREATE INDEX "tire_inspections_tenant_id_vehicle_id_idx" ON "public"."tire_inspections"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "tire_inspections_tenant_id_inspected_by_user_id_idx" ON "public"."tire_inspections"("tenant_id", "inspected_by_user_id");

-- CreateIndex
CREATE INDEX "tire_inspections_tenant_id_date_idx" ON "public"."tire_inspections"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "public"."tires" ADD CONSTRAINT "tires_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tires" ADD CONSTRAINT "tires_current_vehicle_id_fkey"
    FOREIGN KEY ("current_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tire_inspections" ADD CONSTRAINT "tire_inspections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tire_inspections" ADD CONSTRAINT "tire_inspections_tire_id_fkey"
    FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tire_inspections" ADD CONSTRAINT "tire_inspections_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tire_inspections" ADD CONSTRAINT "tire_inspections_inspected_by_user_id_fkey"
    FOREIGN KEY ("inspected_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
