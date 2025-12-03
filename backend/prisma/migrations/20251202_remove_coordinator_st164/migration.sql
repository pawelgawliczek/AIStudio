-- ST-164: Remove Coordinator/Project Manager Entity
-- This migration removes the coordinatorId field from workflows and workflow_runs tables.
-- Coordinators are deprecated - execution order is now defined by WorkflowState.order

-- Step 1: Drop the foreign key constraint from workflows
ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_coordinator_id_fkey";

-- Step 2: Drop the index on coordinatorId from workflows
DROP INDEX IF EXISTS "workflows_coordinator_id_idx";

-- Step 3: Drop the coordinatorId column from workflows
ALTER TABLE "workflows" DROP COLUMN IF EXISTS "coordinator_id";

-- Step 4: Drop the foreign key constraint from workflow_runs
ALTER TABLE "workflow_runs" DROP CONSTRAINT IF EXISTS "workflow_runs_coordinator_id_fkey";

-- Step 5: Drop the index on coordinatorId from workflow_runs
DROP INDEX IF EXISTS "workflow_runs_coordinator_id_idx";

-- Step 6: Drop the coordinatorId column from workflow_runs
ALTER TABLE "workflow_runs" DROP COLUMN IF EXISTS "coordinator_id";
