-- ST-57: Add tool_calls field to component_runs table
-- This field tracks the number of tool calls made by orchestrator and components

-- Add the tool_calls column
ALTER TABLE component_runs
ADD COLUMN tool_calls INTEGER DEFAULT 0;

-- Create index for performance (used in aggregation queries)
CREATE INDEX idx_component_runs_tool_calls
ON component_runs(workflow_run_id, tool_calls);

-- Backfill tool_calls from toolBreakdown JSONB for existing records
-- This extracts the count from tool_breakdown JSON field if it exists
UPDATE component_runs
SET tool_calls = (
  SELECT COUNT(*)::INTEGER
  FROM jsonb_object_keys(COALESCE(tool_breakdown, '{}'::jsonb))
)
WHERE tool_breakdown IS NOT NULL
  AND tool_breakdown != 'null'::jsonb
  AND tool_breakdown != '{}'::jsonb;
