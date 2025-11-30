-- ST-150: Remote Agent Execution for Story Runner
-- Enables Claude Code agent execution on remote machines (laptops) with streaming progress

-- =============================================================================
-- 1. Extend WorkflowState with remote execution configuration
-- =============================================================================

ALTER TABLE "workflow_states" ADD COLUMN "run_location" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "workflow_states" ADD COLUMN "offline_fallback" TEXT NOT NULL DEFAULT 'pause';

COMMENT ON COLUMN "workflow_states"."run_location" IS 'Where to execute: local (KVM) or laptop';
COMMENT ON COLUMN "workflow_states"."offline_fallback" IS 'What to do if laptop offline: pause, skip, or fail';

-- =============================================================================
-- 2. Extend WorkflowRun with remote agent tracking
-- =============================================================================

ALTER TABLE "workflow_runs" ADD COLUMN "executing_agent_id" UUID;
ALTER TABLE "workflow_runs" ADD COLUMN "agent_disconnected_at" TIMESTAMPTZ;

COMMENT ON COLUMN "workflow_runs"."executing_agent_id" IS 'RemoteAgent ID if executing on laptop';
COMMENT ON COLUMN "workflow_runs"."agent_disconnected_at" IS 'When remote agent disconnected (for pause-on-offline)';

-- =============================================================================
-- 3. Extend ComponentRun with remote execution tracking
-- =============================================================================

ALTER TABLE "component_runs" ADD COLUMN "remote_job_id" UUID;
ALTER TABLE "component_runs" ADD COLUMN "executed_on" TEXT;

CREATE INDEX "component_runs_remote_job_id_idx" ON "component_runs"("remote_job_id");

COMMENT ON COLUMN "component_runs"."remote_job_id" IS 'Link to RemoteJob if executed remotely';
COMMENT ON COLUMN "component_runs"."executed_on" IS 'Execution location: kvm_server or laptop:hostname';

-- =============================================================================
-- 4. Extend RemoteAgent with Claude Code support
-- =============================================================================

ALTER TABLE "remote_agents" ADD COLUMN "claude_code_available" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "remote_agents" ADD COLUMN "claude_code_version" TEXT;
ALTER TABLE "remote_agents" ADD COLUMN "current_execution_id" UUID;

CREATE INDEX "remote_agents_status_claude_code_available_idx" ON "remote_agents"("status", "claude_code_available");

COMMENT ON COLUMN "remote_agents"."claude_code_available" IS 'Whether Claude Code CLI is installed and available';
COMMENT ON COLUMN "remote_agents"."claude_code_version" IS 'Version of Claude Code CLI';
COMMENT ON COLUMN "remote_agents"."current_execution_id" IS 'Currently executing job ID';

-- =============================================================================
-- 5. Extend RemoteJob with Claude Code execution fields
-- =============================================================================

ALTER TABLE "remote_jobs" ADD COLUMN "job_type" TEXT;
ALTER TABLE "remote_jobs" ADD COLUMN "component_run_id" UUID;
ALTER TABLE "remote_jobs" ADD COLUMN "workflow_run_id" UUID;
ALTER TABLE "remote_jobs" ADD COLUMN "last_heartbeat_at" TIMESTAMPTZ;
ALTER TABLE "remote_jobs" ADD COLUMN "disconnected_at" TIMESTAMPTZ;
ALTER TABLE "remote_jobs" ADD COLUMN "reconnect_expires_at" TIMESTAMPTZ;

CREATE INDEX "remote_jobs_component_run_id_idx" ON "remote_jobs"("component_run_id");
CREATE INDEX "remote_jobs_workflow_run_id_status_idx" ON "remote_jobs"("workflow_run_id", "status");
CREATE INDEX "remote_jobs_status_reconnect_expires_at_idx" ON "remote_jobs"("status", "reconnect_expires_at");

COMMENT ON COLUMN "remote_jobs"."job_type" IS 'Job type: script or claude-agent';
COMMENT ON COLUMN "remote_jobs"."component_run_id" IS 'Link to ComponentRun for Claude agent jobs';
COMMENT ON COLUMN "remote_jobs"."workflow_run_id" IS 'Link to WorkflowRun for Claude agent jobs';
COMMENT ON COLUMN "remote_jobs"."last_heartbeat_at" IS 'Last heartbeat received (tiered: 5s during execution, 30s idle)';
COMMENT ON COLUMN "remote_jobs"."disconnected_at" IS 'When agent disconnected during execution';
COMMENT ON COLUMN "remote_jobs"."reconnect_expires_at" IS 'Grace period expiration (15 min from disconnect)';

-- =============================================================================
-- 6. Create AgentStreamEvent table for real-time streaming
-- =============================================================================

CREATE TABLE "agent_stream_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "component_run_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_stream_events_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient queries
CREATE INDEX "agent_stream_events_component_run_id_sequence_number_idx" ON "agent_stream_events"("component_run_id", "sequence_number");
CREATE INDEX "agent_stream_events_workflow_run_id_event_type_idx" ON "agent_stream_events"("workflow_run_id", "event_type");
CREATE INDEX "agent_stream_events_component_run_id_event_type_timestamp_idx" ON "agent_stream_events"("component_run_id", "event_type", "timestamp");

-- Foreign keys
ALTER TABLE "agent_stream_events" ADD CONSTRAINT "agent_stream_events_component_run_id_fkey"
    FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_stream_events" ADD CONSTRAINT "agent_stream_events_workflow_run_id_fkey"
    FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "agent_stream_events" IS 'ST-150: Streaming events from Claude Code agent execution';
COMMENT ON COLUMN "agent_stream_events"."event_type" IS 'Event types: token_update, tool_call, tool_result, activity_change, stream_end';
COMMENT ON COLUMN "agent_stream_events"."sequence_number" IS 'Monotonically increasing for ordering and replay';
COMMENT ON COLUMN "agent_stream_events"."payload" IS 'Event-specific data (JSON)';
