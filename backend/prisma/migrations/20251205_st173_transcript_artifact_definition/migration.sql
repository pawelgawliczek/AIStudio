-- ST-173: Add TRANSCRIPT artifact definition to all existing workflows
-- This enables transcript storage as artifacts for all workflows

-- Add TRANSCRIPT artifact definition to all existing workflows
INSERT INTO artifact_definitions (id, workflow_id, name, key, description, type, is_mandatory, created_at, updated_at)
SELECT
    uuid_generate_v4(),
    w.id,
    'Session Transcript',
    'TRANSCRIPT',
    'JSONL transcript of Claude Code session (master orchestrator or spawned agent)',
    'other',
    false,
    NOW(),
    NOW()
FROM workflows w
WHERE NOT EXISTS (
    SELECT 1 FROM artifact_definitions ad
    WHERE ad.workflow_id = w.id AND ad.key = 'TRANSCRIPT'
);

-- Add index for efficient transcript queries by workflow run
-- (existing index on artifacts already covers workflowRunId, but adding specific comment)
COMMENT ON INDEX ix_artifacts_workflow_run_id IS 'ST-173: Efficient lookup of transcripts by workflow run';

-- Add metadata column index hint for redaction queries (if not exists)
-- Note: The metadata column already exists with JSONB type, so no schema changes needed
