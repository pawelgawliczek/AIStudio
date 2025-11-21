-- ST-58: Add versioning fields to Component and Workflow models

-- Component versioning fields
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "version_major" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "version_minor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "instructions_checksum" TEXT;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "config_checksum" TEXT;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "is_deprecated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMP(3);
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "change_description" TEXT;
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "created_from_version" TEXT;

-- Component self-relation for version history
ALTER TABLE "components" ADD CONSTRAINT "components_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Component indexes for versioning
CREATE INDEX IF NOT EXISTS "components_project_id_active_version_major_idx" ON "components"("project_id", "active", "version_major");
CREATE INDEX IF NOT EXISTS "components_parent_id_idx" ON "components"("parent_id");
CREATE INDEX IF NOT EXISTS "components_version_major_version_minor_idx" ON "components"("version_major", "version_minor");

-- Workflow versioning fields
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "version_major" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "version_minor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "instructions_checksum" TEXT;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "config_checksum" TEXT;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "is_deprecated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMP(3);
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "change_description" TEXT;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "created_from_version" TEXT;

-- Workflow self-relation for version history
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Workflow indexes for versioning
CREATE INDEX IF NOT EXISTS "workflows_project_id_active_version_major_idx" ON "workflows"("project_id", "active", "version_major");
CREATE INDEX IF NOT EXISTS "workflows_parent_id_idx" ON "workflows"("parent_id");
CREATE INDEX IF NOT EXISTS "workflows_version_major_version_minor_idx" ON "workflows"("version_major", "version_minor");
