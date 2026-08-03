-- CreateEnum
CREATE TYPE "public"."responsibility_term_status" AS ENUM ('PENDING', 'SIGNED');

-- CreateTable
CREATE TABLE "public"."responsibility_terms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."responsibility_term_status" NOT NULL DEFAULT 'PENDING',
    "signature_url" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_location" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsibility_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "responsibility_terms_vehicle_id_driver_id_content_version_key"
ON "public"."responsibility_terms"("vehicle_id", "driver_id", "content_version");

CREATE INDEX "responsibility_terms_tenant_id_user_id_status_idx"
ON "public"."responsibility_terms"("tenant_id", "user_id", "status");

CREATE INDEX "responsibility_terms_tenant_id_vehicle_id_created_at_idx"
ON "public"."responsibility_terms"("tenant_id", "vehicle_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."responsibility_terms"
ADD CONSTRAINT "responsibility_terms_tenant_id_fkey" FOREIGN KEY ("tenant_id")
REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."responsibility_terms"
ADD CONSTRAINT "responsibility_terms_vehicle_id_fkey" FOREIGN KEY ("vehicle_id")
REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."responsibility_terms"
ADD CONSTRAINT "responsibility_terms_driver_id_fkey" FOREIGN KEY ("driver_id")
REFERENCES "public"."drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."responsibility_terms"
ADD CONSTRAINT "responsibility_terms_user_id_fkey" FOREIGN KEY ("user_id")
REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
