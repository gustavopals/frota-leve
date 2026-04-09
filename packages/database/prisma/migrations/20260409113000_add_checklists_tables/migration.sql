CREATE TYPE "checklist_execution_status" AS ENUM (
    'COMPLIANT',
    'NON_COMPLIANT',
    'ATTENTION'
);

CREATE TYPE "checklist_item_status" AS ENUM (
    'OK',
    'ATTENTION',
    'NON_COMPLIANT'
);

CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "vehicle_category" "vehicle_category",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "photo_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "status" "checklist_execution_status" NOT NULL,
    "signature_url" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_execution_items" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "checklist_item_id" UUID,
    "label" TEXT NOT NULL,
    "status" "checklist_item_status" NOT NULL,
    "photo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_execution_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_templates_tenant_id_idx" ON "checklist_templates"("tenant_id");
CREATE INDEX "checklist_templates_tenant_id_vehicle_category_idx" ON "checklist_templates"("tenant_id", "vehicle_category");

CREATE INDEX "checklist_items_template_id_idx" ON "checklist_items"("template_id");
CREATE INDEX "checklist_items_template_id_display_order_idx" ON "checklist_items"("template_id", "display_order");

CREATE INDEX "checklist_executions_tenant_id_idx" ON "checklist_executions"("tenant_id");
CREATE INDEX "checklist_executions_tenant_id_template_id_idx" ON "checklist_executions"("tenant_id", "template_id");
CREATE INDEX "checklist_executions_tenant_id_vehicle_id_idx" ON "checklist_executions"("tenant_id", "vehicle_id");
CREATE INDEX "checklist_executions_tenant_id_driver_id_idx" ON "checklist_executions"("tenant_id", "driver_id");
CREATE INDEX "checklist_executions_tenant_id_status_idx" ON "checklist_executions"("tenant_id", "status");
CREATE INDEX "checklist_executions_tenant_id_executed_at_idx" ON "checklist_executions"("tenant_id", "executed_at");
CREATE INDEX "checklist_executions_tenant_id_created_by_user_id_idx" ON "checklist_executions"("tenant_id", "created_by_user_id");

CREATE INDEX "checklist_execution_items_execution_id_idx" ON "checklist_execution_items"("execution_id");
CREATE INDEX "checklist_execution_items_checklist_item_id_idx" ON "checklist_execution_items"("checklist_item_id");
CREATE INDEX "checklist_execution_items_execution_id_status_idx" ON "checklist_execution_items"("execution_id", "status");

ALTER TABLE "checklist_templates"
ADD CONSTRAINT "checklist_templates_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_items"
ADD CONSTRAINT "checklist_items_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_executions"
ADD CONSTRAINT "checklist_executions_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_executions"
ADD CONSTRAINT "checklist_executions_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_executions"
ADD CONSTRAINT "checklist_executions_vehicle_id_fkey"
FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_executions"
ADD CONSTRAINT "checklist_executions_driver_id_fkey"
FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_executions"
ADD CONSTRAINT "checklist_executions_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_execution_items"
ADD CONSTRAINT "checklist_execution_items_execution_id_fkey"
FOREIGN KEY ("execution_id") REFERENCES "checklist_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_execution_items"
ADD CONSTRAINT "checklist_execution_items_checklist_item_id_fkey"
FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
