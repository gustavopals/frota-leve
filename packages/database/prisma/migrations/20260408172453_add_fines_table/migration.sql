-- CreateEnum
CREATE TYPE "fine_status" AS ENUM ('PENDING', 'DRIVER_IDENTIFIED', 'APPEALED', 'PAID', 'PAYROLL_DEDUCTED');

-- CreateEnum
CREATE TYPE "fine_severity" AS ENUM ('LIGHT', 'MEDIUM', 'SERIOUS', 'VERY_SERIOUS');

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "drivers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fuel_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "maintenance_plans" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_order_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_orders" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "fines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "auto_number" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "fine_severity" NOT NULL,
    "points" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "discount_amount" DOUBLE PRECISION,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "fine_status" NOT NULL DEFAULT 'PENDING',
    "payroll_deduction" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fines_tenant_id_idx" ON "fines"("tenant_id");

-- CreateIndex
CREATE INDEX "fines_tenant_id_vehicle_id_idx" ON "fines"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "fines_tenant_id_driver_id_idx" ON "fines"("tenant_id", "driver_id");

-- CreateIndex
CREATE INDEX "fines_tenant_id_status_idx" ON "fines"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "fines_tenant_id_date_idx" ON "fines"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "fines_tenant_id_severity_idx" ON "fines"("tenant_id", "severity");

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
