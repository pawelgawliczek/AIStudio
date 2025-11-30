-- ST-147: Session Telemetry - Complete Audit Trail
-- Add columns for runner session tracking, turn counting, and resume context

-- WorkflowRun: Runner Session Telemetry
ALTER TABLE workflow_runs
  ADD COLUMN runner_transcript_path TEXT,
  ADD COLUMN runner_tokens_input INTEGER DEFAULT 0,
  ADD COLUMN runner_tokens_output INTEGER DEFAULT 0,
  ADD COLUMN total_runner_tokens INTEGER DEFAULT 0;

-- WorkflowRun: Turn Tracking
ALTER TABLE workflow_runs
  ADD COLUMN total_turns INTEGER DEFAULT 0,
  ADD COLUMN total_manual_prompts INTEGER DEFAULT 0;

-- WorkflowRun: Resume Context
ALTER TABLE workflow_runs
  ADD COLUMN resume_summary TEXT,
  ADD COLUMN resume_generated_at TIMESTAMP(3),
  ADD COLUMN decision_history JSONB,
  ADD COLUMN checkpoint_data JSONB,
  ADD COLUMN last_checkpoint_at TIMESTAMP(3);

-- ComponentRun: Turn Tracking (per-component)
ALTER TABLE component_runs
  ADD COLUMN total_turns INTEGER DEFAULT 0,
  ADD COLUMN manual_prompts INTEGER DEFAULT 0,
  ADD COLUMN auto_continues INTEGER DEFAULT 0;

-- ComponentRun: Transcript & Summary
ALTER TABLE component_runs
  ADD COLUMN transcript_path TEXT,
  ADD COLUMN component_summary TEXT;

-- Indexes for analytics queries
CREATE INDEX idx_workflow_runs_total_turns ON workflow_runs(total_turns);
CREATE INDEX idx_workflow_runs_total_manual_prompts ON workflow_runs(total_manual_prompts);
CREATE INDEX idx_component_runs_total_turns ON component_runs(total_turns);
