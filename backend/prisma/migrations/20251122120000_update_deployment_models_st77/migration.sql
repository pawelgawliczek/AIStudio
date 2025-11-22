-- ST-77: Update deployment models for production deployment safety system
-- This migration updates the existing DeploymentLock and DeploymentLog models
-- to support comprehensive deployment tracking and approval workflows

-- Update DeploymentStatus enum to include all workflow states
ALTER TYPE "DeploymentStatus" RENAME TO "DeploymentStatus_old";

CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'approved', 'deploying', 'deployed', 'failed', 'rolled_back');

-- Update DeploymentLock table
ALTER TABLE "deployment_locks" DROP CONSTRAINT IF EXISTS "deployment_locks_story_id_fkey";
ALTER TABLE "deployment_locks" ALTER COLUMN "story_id" DROP NOT NULL;
ALTER TABLE "deployment_locks" ALTER COLUMN "pr_number" DROP NOT NULL;
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL DEFAULT 'Production deployment';
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "locked_by" TEXT NOT NULL DEFAULT 'claude-code';
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "deployment_locks" RENAME COLUMN "acquired_at" TO "locked_at_temp";
ALTER TABLE "deployment_locks" DROP COLUMN IF EXISTS "locked_at_temp";
ALTER TABLE "deployment_locks" RENAME COLUMN "acquired_by" TO "locked_by_temp";
ALTER TABLE "deployment_locks" DROP COLUMN IF EXISTS "locked_by_temp";
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "deployment_locks" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT NOW();

-- Re-add foreign key with SetNull
ALTER TABLE "deployment_locks"
  ADD CONSTRAINT "deployment_locks_story_id_fkey"
  FOREIGN KEY ("story_id")
  REFERENCES "stories"("id")
  ON DELETE SET NULL;

-- Add new indexes for DeploymentLock
DROP INDEX IF EXISTS "deployment_locks_released_at_expires_at_idx";
CREATE INDEX IF NOT EXISTS "deployment_locks_active_expires_at_idx" ON "deployment_locks"("active", "expires_at");
CREATE INDEX IF NOT EXISTS "deployment_locks_story_id_idx" ON "deployment_locks"("story_id");

-- Update DeploymentLog table
ALTER TABLE "deployment_logs" DROP CONSTRAINT IF EXISTS "deployment_logs_story_id_fkey";
ALTER TABLE "deployment_logs" ALTER COLUMN "story_id" DROP NOT NULL;
ALTER TABLE "deployment_logs" ALTER COLUMN "pr_number" DROP NOT NULL;
ALTER TABLE "deployment_logs" ALTER COLUMN "deployed_by" DROP NOT NULL;
ALTER TABLE "deployment_logs" ALTER COLUMN "deployed_by" DROP DEFAULT;
ALTER TABLE "deployment_logs" ALTER COLUMN "deployed_at" DROP NOT NULL;
ALTER TABLE "deployment_logs" ALTER COLUMN "deployed_at" DROP DEFAULT;

-- Update status column type
ALTER TABLE "deployment_logs" ALTER COLUMN "status" TYPE "DeploymentStatus" USING
  CASE
    WHEN "status"::text = 'success' THEN 'deployed'::DeploymentStatus
    WHEN "status"::text = 'failed' THEN 'failed'::DeploymentStatus
    WHEN "status"::text = 'rolled_back' THEN 'rolled_back'::DeploymentStatus
    ELSE 'pending'::DeploymentStatus
  END;
ALTER TABLE "deployment_logs" ALTER COLUMN "status" SET DEFAULT 'pending'::DeploymentStatus;

-- Add new columns to DeploymentLog
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "deployment_id" UUID;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'production';
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "branch" TEXT;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "commit_hash" TEXT;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "logs" TEXT;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "deployment_logs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT NOW();

-- Remove old columns
ALTER TABLE "deployment_logs" DROP COLUMN IF EXISTS "duration";
ALTER TABLE "deployment_logs" DROP COLUMN IF EXISTS "rollback_at";
ALTER TABLE "deployment_logs" DROP COLUMN IF EXISTS "services_deployed";

-- Re-add foreign key with SetNull
ALTER TABLE "deployment_logs"
  ADD CONSTRAINT "deployment_logs_story_id_fkey"
  FOREIGN KEY ("story_id")
  REFERENCES "stories"("id")
  ON DELETE SET NULL;

-- Add new indexes for DeploymentLog (audit queries)
DROP INDEX IF EXISTS "deployment_logs_deployed_at_idx";
CREATE INDEX IF NOT EXISTS "deployment_logs_status_created_at_idx" ON "deployment_logs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "deployment_logs_story_id_status_idx" ON "deployment_logs"("story_id", "status");
CREATE INDEX IF NOT EXISTS "deployment_logs_pr_number_idx" ON "deployment_logs"("pr_number");
CREATE INDEX IF NOT EXISTS "deployment_logs_environment_status_idx" ON "deployment_logs"("environment", "status");
CREATE INDEX IF NOT EXISTS "deployment_logs_created_at_idx" ON "deployment_logs"("created_at");

-- Drop old enum
DROP TYPE "DeploymentStatus_old";

-- Create unique partial index for singleton deployment lock enforcement
-- Only one active lock can exist at a time
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_locks_active_unique"
  ON "deployment_locks" ("active")
  WHERE "active" = true;
