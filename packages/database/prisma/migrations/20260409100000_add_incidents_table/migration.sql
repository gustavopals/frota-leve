CREATE TYPE "incident_type" AS ENUM ('COLLISION', 'THEFT', 'VANDALISM', 'NATURAL', 'OTHER');

CREATE TYPE "incident_status" AS ENUM (
    'REGISTERED',
    'UNDER_ANALYSIS',
    'IN_REPAIR',
    'CONCLUDED'
);

CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "type" "incident_type" NOT NULL,
    "description" TEXT NOT NULL,
    "third_party_involved" BOOLEAN NOT NULL DEFAULT false,
    "police_report" BOOLEAN NOT NULL DEFAULT false,
    "insurer_notified" BOOLEAN NOT NULL DEFAULT false,
    "insurance_claim_number" TEXT,
    "estimated_cost" DOUBLE PRECISION,
    "actual_cost" DOUBLE PRECISION,
    "status" "incident_status" NOT NULL DEFAULT 'REGISTERED',
    "photos" JSONB,
    "documents" JSONB,
    "downtime" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incidents_tenant_id_idx" ON "incidents"("tenant_id");
CREATE INDEX "incidents_tenant_id_vehicle_id_idx" ON "incidents"("tenant_id", "vehicle_id");
CREATE INDEX "incidents_tenant_id_driver_id_idx" ON "incidents"("tenant_id", "driver_id");
CREATE INDEX "incidents_tenant_id_type_idx" ON "incidents"("tenant_id", "type");
CREATE INDEX "incidents_tenant_id_status_idx" ON "incidents"("tenant_id", "status");
CREATE INDEX "incidents_tenant_id_date_idx" ON "incidents"("tenant_id", "date");

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_vehicle_id_fkey"
FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_driver_id_fkey"
FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
