-- Migration: add_workflow_metadata_worktree_host
-- Description: Add missing metadata column to workflows table and host fields to worktrees table

-- Add metadata column to workflows table (ST-103: Version Bumping for Teams)
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Add WorktreeHostType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "WorktreeHostType" AS ENUM ('local', 'remote');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add host_name and host_type columns to worktrees table
ALTER TABLE "worktrees" ADD COLUMN IF NOT EXISTS "host_name" TEXT;
ALTER TABLE "worktrees" ADD COLUMN IF NOT EXISTS "host_type" "WorktreeHostType";

-- Add indexes to service_deployment_states if they don't exist
CREATE INDEX IF NOT EXISTS "service_deployment_states_service_idx" ON "service_deployment_states"("service");
CREATE INDEX IF NOT EXISTS "service_deployment_states_last_deployed_at_idx" ON "service_deployment_states"("last_deployed_at");
