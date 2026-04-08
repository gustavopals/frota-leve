-- CreateTable
CREATE TABLE "public"."drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" TIMESTAMP(3),
    "cnh_number" TEXT,
    "cnh_category" TEXT,
    "cnh_expiration" TIMESTAMP(3),
    "cnh_points" INTEGER DEFAULT 0,
    "emergency_contact" TEXT,
    "emergency_phone" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "photo_url" TEXT,
    "hire_date" TIMESTAMP(3),
    "score" DOUBLE PRECISION DEFAULT 100,
    "notes" TEXT,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_user_id_key" ON "public"."drivers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_tenant_id_cpf_key" ON "public"."drivers"("tenant_id", "cpf");

-- CreateIndex
CREATE INDEX "drivers_tenant_id_idx" ON "public"."drivers"("tenant_id");

-- CreateIndex
CREATE INDEX "drivers_tenant_id_is_active_idx" ON "public"."drivers"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "public"."drivers" ADD CONSTRAINT "drivers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
