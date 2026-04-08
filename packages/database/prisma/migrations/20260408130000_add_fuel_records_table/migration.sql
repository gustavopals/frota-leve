-- CreateTable
CREATE TABLE "public"."fuel_records" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID NOT NULL,
    "vehicle_id"        UUID NOT NULL,
    "driver_id"         UUID,
    "date"              TIMESTAMP(3) NOT NULL,
    "mileage"           INTEGER NOT NULL,
    "liters"            DOUBLE PRECISION NOT NULL,
    "price_per_liter"   DOUBLE PRECISION NOT NULL,
    "total_cost"        DOUBLE PRECISION NOT NULL,
    "fuel_type"         "public"."fuel_type" NOT NULL,
    "full_tank"         BOOLEAN NOT NULL DEFAULT true,
    "gas_station"       TEXT,
    "notes"             TEXT,
    "receipt_url"       TEXT,
    "km_per_liter"      DOUBLE PRECISION,
    "anomaly"           BOOLEAN NOT NULL DEFAULT false,
    "anomaly_reason"    TEXT,
    "created_by_user_id" UUID,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_records_tenant_id_idx" ON "public"."fuel_records"("tenant_id");

-- CreateIndex
CREATE INDEX "fuel_records_tenant_id_vehicle_id_idx" ON "public"."fuel_records"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "fuel_records_tenant_id_driver_id_idx" ON "public"."fuel_records"("tenant_id", "driver_id");

-- CreateIndex
CREATE INDEX "fuel_records_tenant_id_date_idx" ON "public"."fuel_records"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "public"."fuel_records" ADD CONSTRAINT "fuel_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fuel_records" ADD CONSTRAINT "fuel_records_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fuel_records" ADD CONSTRAINT "fuel_records_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
