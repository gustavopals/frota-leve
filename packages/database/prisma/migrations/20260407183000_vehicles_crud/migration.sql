-- CreateEnum
CREATE TYPE "fuel_type" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'DIESEL_S10', 'GNV', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "vehicle_category" AS ENUM ('LIGHT', 'HEAVY', 'MOTORCYCLE', 'MACHINE', 'BUS');

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RESERVE', 'DECOMMISSIONED', 'INCIDENT');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "renavam" TEXT,
    "chassis" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "year_model" INTEGER NOT NULL,
    "color" TEXT,
    "fuel_type" "fuel_type" NOT NULL,
    "category" "vehicle_category" NOT NULL,
    "status" "vehicle_status" NOT NULL DEFAULT 'ACTIVE',
    "current_mileage" INTEGER NOT NULL DEFAULT 0,
    "average_consumption" DOUBLE PRECISION,
    "expected_consumption" DOUBLE PRECISION,
    "acquisition_date" TIMESTAMP(3),
    "acquisition_value" DOUBLE PRECISION,
    "photos" JSONB,
    "notes" TEXT,
    "current_driver_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_idx" ON "vehicles"("tenant_id");

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_status_idx" ON "vehicles"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_tenant_id_plate_key" ON "vehicles"("tenant_id", "plate");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_current_driver_id_fkey" FOREIGN KEY ("current_driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

