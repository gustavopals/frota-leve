-- CreateEnum
CREATE TYPE "public"."service_order_status" AS ENUM ('OPEN', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."service_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID,
    "plan_id" UUID,
    "type" "public"."maintenance_type" NOT NULL,
    "status" "public"."service_order_status" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "workshop" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION,
    "parts_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "photos" JSONB,
    "approved_by_user_id" UUID,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_order_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_cost" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "part_number" TEXT,

    CONSTRAINT "service_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_idx" ON "public"."service_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_status_idx" ON "public"."service_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_vehicle_id_idx" ON "public"."service_orders"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_driver_id_idx" ON "public"."service_orders"("tenant_id", "driver_id");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_plan_id_idx" ON "public"."service_orders"("tenant_id", "plan_id");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_type_idx" ON "public"."service_orders"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_created_at_idx" ON "public"."service_orders"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "service_order_items_service_order_id_idx" ON "public"."service_order_items"("service_order_id");

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_order_items" ADD CONSTRAINT "service_order_items_service_order_id_fkey"
    FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
