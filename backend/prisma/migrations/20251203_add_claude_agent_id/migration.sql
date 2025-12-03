-- Add claudeAgentId field to component_runs for transcript reference
-- The agentId is an 8-char hex (e.g., "b6ebed38") used in transcript filename: agent-{agentId}.jsonl

ALTER TABLE "component_runs" ADD COLUMN "claude_agent_id" TEXT;
