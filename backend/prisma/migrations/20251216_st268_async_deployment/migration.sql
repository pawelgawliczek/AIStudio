-- ST-268: Add async deployment tracking fields to deployment_logs
-- These fields enable async deployment with progress tracking

-- Add currentPhase to track which deployment phase is running
ALTER TABLE "deployment_logs" ADD COLUMN "current_phase" TEXT;

-- Add progress JSON to track detailed progress info
ALTER TABLE "deployment_logs" ADD COLUMN "progress" JSONB;

-- Add childProcessPid to track the worker process ID for orphan detection
ALTER TABLE "deployment_logs" ADD COLUMN "child_process_pid" INTEGER;

-- Add lastHeartbeat for orphan detection (deployments with stale heartbeat are considered orphaned)
ALTER TABLE "deployment_logs" ADD COLUMN "last_heartbeat" TIMESTAMP(3);

-- Add 'queued' status to DeploymentStatus enum
ALTER TYPE "DeploymentStatus" ADD VALUE IF NOT EXISTS 'queued' AFTER 'approved';
