-- CreateEnum
CREATE TYPE "public"."maintenance_type" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE');

-- CreateTable
CREATE TABLE "public"."maintenance_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."maintenance_type" NOT NULL,
    "interval_km" INTEGER,
    "interval_days" INTEGER,
    "last_executed_at" TIMESTAMP(3),
    "last_executed_mileage" INTEGER,
    "next_due_at" TIMESTAMP(3),
    "next_due_mileage" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_plans_tenant_id_idx" ON "public"."maintenance_plans"("tenant_id");

-- CreateIndex
CREATE INDEX "maintenance_plans_tenant_id_vehicle_id_idx" ON "public"."maintenance_plans"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "maintenance_plans_tenant_id_is_active_idx" ON "public"."maintenance_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "maintenance_plans_tenant_id_next_due_at_idx" ON "public"."maintenance_plans"("tenant_id", "next_due_at");

-- CreateIndex
CREATE INDEX "maintenance_plans_tenant_id_next_due_mileage_idx" ON "public"."maintenance_plans"("tenant_id", "next_due_mileage");

-- AddForeignKey
ALTER TABLE "public"."maintenance_plans" ADD CONSTRAINT "maintenance_plans_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."maintenance_plans" ADD CONSTRAINT "maintenance_plans_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
