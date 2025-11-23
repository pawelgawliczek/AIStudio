-- ST-84: Add manual approval fields to Story table for direct commit deployments
-- AlterTable
ALTER TABLE "stories"
  ADD COLUMN IF NOT EXISTS "manual_approval" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approval_expires_at" TIMESTAMP(3);

-- ST-84: Add approval method tracking to DeploymentLog table
-- AlterTable
ALTER TABLE "deployment_logs"
  ADD COLUMN IF NOT EXISTS "approval_method" TEXT;

-- Create index for querying approval status
CREATE INDEX IF NOT EXISTS "idx_stories_manual_approval" ON "stories"("manual_approval", "approval_expires_at");

-- Create index for querying deployment approval methods
CREATE INDEX IF NOT EXISTS "idx_deployment_logs_approval_method" ON "deployment_logs"("approval_method");
