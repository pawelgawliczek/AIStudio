-- ST-158: Add config column to remote_agents table
-- Stores agent configuration including projectPath and worktreeRoot for MCP-orchestrated operations

-- Add config column with default empty JSON object
ALTER TABLE "remote_agents" ADD COLUMN IF NOT EXISTS "config" JSONB NOT NULL DEFAULT '{}';

-- Add comment to document the column
COMMENT ON COLUMN "remote_agents"."config" IS 'Agent configuration (projectPath, worktreeRoot) for MCP-orchestrated operations (ST-158)';
