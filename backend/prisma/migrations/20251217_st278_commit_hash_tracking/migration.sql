-- ST-278: Add commit hash tracking to ComponentRun for accurate LOC metrics per agent
-- AlterTable
ALTER TABLE "component_runs" ADD COLUMN "start_commit_hash" TEXT,
ADD COLUMN "end_commit_hash" TEXT;
