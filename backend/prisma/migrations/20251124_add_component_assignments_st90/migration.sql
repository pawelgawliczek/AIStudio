-- AlterTable
ALTER TABLE "workflows" ADD COLUMN "component_assignments" JSONB NOT NULL DEFAULT '[]';
