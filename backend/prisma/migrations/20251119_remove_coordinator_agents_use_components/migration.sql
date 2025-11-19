-- Migration: Remove coordinator_agents table and use components instead
-- ST-68: Coordinator schema migration - use components for workflow coordination

-- Step 1: Drop foreign key constraints that reference coordinator_agents
ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_coordinator_id_fkey";
ALTER TABLE "workflow_runs" DROP CONSTRAINT IF EXISTS "workflow_runs_coordinator_id_fkey";

-- Step 2: Update foreign keys to reference components table instead
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_coordinator_id_fkey"
  FOREIGN KEY ("coordinator_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_coordinator_id_fkey"
  FOREIGN KEY ("coordinator_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 3: Drop the coordinator_agents table (it's replaced by components with tags=['coordinator'])
DROP TABLE IF EXISTS "coordinator_agents" CASCADE;

-- Note: Coordinators are now stored as Components with tags=['coordinator']
-- The Component model provides the same functionality with a more flexible architecture
