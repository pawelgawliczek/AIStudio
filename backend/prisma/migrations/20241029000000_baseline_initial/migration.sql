-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "EpicStatus" AS ENUM ('planning', 'in_progress', 'done', 'archived');

-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('feature', 'bug', 'defect', 'chore', 'spike');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('backlog', 'planning', 'analysis', 'architecture', 'design', 'implementation', 'review', 'qa', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "SubtaskStatus" AS ENUM ('todo', 'in_progress', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "AssigneeType" AS ENUM ('human', 'agent');

-- CreateEnum
CREATE TYPE "UseCaseRelation" AS ENUM ('implements', 'modifies', 'deprecates');

-- CreateEnum
CREATE TYPE "MappingSource" AS ENUM ('COMMIT_DERIVED', 'AI_INFERRED', 'MANUAL', 'PATTERN_MATCHED', 'IMPORT_ANALYSIS');

-- CreateEnum
CREATE TYPE "OriginStage" AS ENUM ('dev', 'arch', 'ba', 'unknown');

-- CreateEnum
CREATE TYPE "DiscoveryStage" AS ENUM ('unit_test', 'integration_test', 'qa', 'uat', 'production');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TestCaseType" AS ENUM ('unit', 'integration', 'e2e');

-- CreateEnum
CREATE TYPE "TestPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('pending', 'implemented', 'automated', 'deprecated');

-- CreateEnum
CREATE TYPE "TestExecutionStatus" AS ENUM ('pass', 'fail', 'skip', 'error');

-- CreateEnum
CREATE TYPE "RunOrigin" AS ENUM ('mcp', 'cli', 'ci', 'ui');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('planned', 'in_progress', 'released', 'rolled_back');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'paused');

-- CreateEnum
CREATE TYPE "WorktreeStatus" AS ENUM ('active', 'idle', 'cleaning', 'removed');

-- CreateEnum
CREATE TYPE "WorktreeHostType" AS ENUM ('local', 'remote');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('pending', 'running', 'passed', 'failed', 'cancelled', 'skipped');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('draft', 'open', 'approved', 'changes_requested', 'merged', 'closed', 'conflict');

-- CreateEnum
CREATE TYPE "StoryPhase" AS ENUM ('context', 'ba', 'design', 'architecture', 'implementation', 'testing', 'review', 'done');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'approved', 'deploying', 'deployed', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "BreakpointPosition" AS ENUM ('before', 'after');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('warning', 'critical');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repository_url" TEXT,
    "local_path" TEXT,
    "host_path" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "EpicStatus" NOT NULL DEFAULT 'planning',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "epic_id" UUID,
    "key" TEXT NOT NULL,
    "type" "StoryType" NOT NULL DEFAULT 'feature',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "StoryStatus" NOT NULL DEFAULT 'planning',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "business_impact" INTEGER,
    "business_complexity" INTEGER,
    "technical_complexity" INTEGER,
    "estimated_token_cost" INTEGER,
    "assigned_framework_id" UUID,
    "assigned_workflow_id" UUID,
    "created_by" UUID NOT NULL,
    "context_exploration" TEXT,
    "ba_analysis" TEXT,
    "designer_analysis" TEXT,
    "architect_analysis" TEXT,
    "context_explored_at" TIMESTAMP(3),
    "ba_analyzed_at" TIMESTAMP(3),
    "designer_analyzed_at" TIMESTAMP(3),
    "architect_analyzed_at" TIMESTAMP(3),
    "current_phase" "StoryPhase",
    "metadata" JSONB,
    "defect_leakage_count" INTEGER NOT NULL DEFAULT 0,
    "manual_approval" BOOLEAN DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID NOT NULL,
    "key" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_type" "AssigneeType" NOT NULL DEFAULT 'agent',
    "assignee_id" UUID,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'todo',
    "component_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_metrics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "language" TEXT,
    "lines_of_code" INTEGER NOT NULL,
    "cyclomatic_complexity" DOUBLE PRECISION NOT NULL,
    "cognitive_complexity" DOUBLE PRECISION NOT NULL,
    "maintainability_index" DOUBLE PRECISION NOT NULL,
    "test_coverage" DOUBLE PRECISION DEFAULT 0.0,
    "churn_rate" INTEGER NOT NULL,
    "churn_count" INTEGER NOT NULL DEFAULT 0,
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "code_smell_count" INTEGER NOT NULL,
    "critical_issues" INTEGER NOT NULL DEFAULT 0,
    "last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_analyzed_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_metrics_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_files" INTEGER NOT NULL,
    "total_loc" INTEGER NOT NULL,
    "avg_complexity" DOUBLE PRECISION NOT NULL,
    "avg_coverage" DOUBLE PRECISION NOT NULL,
    "health_score" DOUBLE PRECISION NOT NULL,
    "tech_debt_ratio" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "analysis_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "use_cases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "use_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "use_case_versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "use_case_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_story_id" UUID,
    "linked_defect_id" UUID,

    CONSTRAINT "use_case_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_use_case_links" (
    "story_id" UUID NOT NULL,
    "use_case_id" UUID NOT NULL,
    "relation" "UseCaseRelation" NOT NULL DEFAULT 'implements',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_use_case_links_pkey" PRIMARY KEY ("story_id","use_case_id")
);

-- CreateTable
CREATE TABLE "file_use_case_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "use_case_id" UUID NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" "MappingSource" NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "file_use_case_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defects" (
    "story_id" UUID NOT NULL,
    "origin_story_id" UUID,
    "origin_stage" "OriginStage",
    "discovery_stage" "DiscoveryStage" NOT NULL,
    "severity" "DefectSeverity" NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("story_id")
);

-- CreateTable
CREATE TABLE "commits" (
    "hash" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "author" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "message" TEXT NOT NULL,
    "story_id" UUID,
    "epic_id" UUID,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "commit_files" (
    "id" BIGSERIAL NOT NULL,
    "commit_hash" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "loc_added" INTEGER NOT NULL DEFAULT 0,
    "loc_deleted" INTEGER NOT NULL DEFAULT 0,
    "complexity_before" INTEGER,
    "complexity_after" INTEGER,
    "coverage_before" DECIMAL(5,2),
    "coverage_after" DECIMAL(5,2),

    CONSTRAINT "commit_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "use_case_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "test_level" "TestCaseType" NOT NULL,
    "priority" "TestPriority" DEFAULT 'medium',
    "preconditions" TEXT,
    "test_steps" TEXT,
    "expected_results" TEXT,
    "test_data" JSONB,
    "status" "TestCaseStatus" NOT NULL DEFAULT 'pending',
    "test_file_path" TEXT,
    "assigned_to" UUID,
    "metadata" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_executions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "test_case_id" UUID NOT NULL,
    "story_id" UUID,
    "commit_hash" TEXT,
    "executed_at" TIMESTAMPTZ NOT NULL,
    "status" "TestExecutionStatus" NOT NULL,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "coverage_percentage" DECIMAL(5,2),
    "lines_covered" INTEGER,
    "lines_total" INTEGER,
    "ci_run_id" TEXT,
    "environment" TEXT,

    CONSTRAINT "test_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_frameworks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "story_id" UUID,
    "subtask_id" UUID,
    "agent_id" UUID,
    "framework_id" UUID,
    "origin" "RunOrigin" NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_type" TEXT,
    "iterations" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_instructions" TEXT NOT NULL,
    "operation_instructions" TEXT NOT NULL,
    "output_instructions" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "tools" TEXT[],
    "subtask_config" JSONB,
    "on_failure" TEXT NOT NULL DEFAULT 'stop',
    "tags" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_major" INTEGER NOT NULL DEFAULT 1,
    "version_minor" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "instructions_checksum" TEXT,
    "config_checksum" TEXT,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "deprecated_at" TIMESTAMP(3),
    "change_description" TEXT,
    "created_from_version" TEXT,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "coordinator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "trigger_config" JSONB NOT NULL,
    "component_assignments" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_major" INTEGER NOT NULL DEFAULT 1,
    "version_minor" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "instructions_checksum" TEXT,
    "config_checksum" TEXT,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "deprecated_at" TIMESTAMP(3),
    "change_description" TEXT,
    "created_from_version" TEXT,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "story_id" UUID,
    "epic_id" UUID,
    "coordinator_id" UUID,
    "triggered_by" TEXT,
    "trigger_type" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "current_state_id" UUID,
    "runner_session_id" TEXT,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMP(3),
    "pause_reason" TEXT,
    "executing_agent_id" UUID,
    "agent_disconnected_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "total_tokens_input" INTEGER,
    "total_tokens_output" INTEGER,
    "total_tokens" INTEGER,
    "total_loc_generated" INTEGER,
    "total_tests_added" INTEGER,
    "estimated_cost" DOUBLE PRECISION,
    "total_user_prompts" INTEGER,
    "total_iterations" INTEGER,
    "total_interventions" INTEGER,
    "avg_prompts_per_component" DOUBLE PRECISION,
    "coordinator_decisions" JSONB,
    "coordinator_metrics" JSONB,
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "execution_order" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "input_data" JSONB,
    "output_data" JSONB,
    "output" TEXT,
    "tokens_input" INTEGER DEFAULT 0,
    "tokens_output" INTEGER DEFAULT 0,
    "total_tokens" INTEGER,
    "duration_seconds" INTEGER,
    "cost" DOUBLE PRECISION DEFAULT 0,
    "iterations" INTEGER DEFAULT 1,
    "loc_generated" INTEGER,
    "tests_added" INTEGER,
    "files_modified" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokens_per_loc" DOUBLE PRECISION,
    "loc_per_prompt" DOUBLE PRECISION,
    "runtime_per_loc" DOUBLE PRECISION,
    "runtime_per_token" DOUBLE PRECISION,
    "user_prompts" INTEGER DEFAULT 0,
    "system_iterations" INTEGER DEFAULT 1,
    "human_interventions" INTEGER DEFAULT 0,
    "iteration_log" JSONB,
    "tool_calls" INTEGER DEFAULT 0,
    "session_id" TEXT,
    "tokens_system_prompt" INTEGER DEFAULT 0,
    "tokens_system_tools" INTEGER DEFAULT 0,
    "tokens_mcp_tools" INTEGER DEFAULT 0,
    "tokens_memory_files" INTEGER DEFAULT 0,
    "tokens_messages" INTEGER DEFAULT 0,
    "lines_added" INTEGER DEFAULT 0,
    "lines_deleted" INTEGER DEFAULT 0,
    "lines_modified" INTEGER DEFAULT 0,
    "complexity_before" DOUBLE PRECISION,
    "complexity_after" DOUBLE PRECISION,
    "coverage_before" DOUBLE PRECISION,
    "coverage_after" DOUBLE PRECISION,
    "error_rate" DOUBLE PRECISION,
    "success_rate" DOUBLE PRECISION,
    "tool_breakdown" JSONB,
    "context_switches" INTEGER DEFAULT 0,
    "exploration_depth" INTEGER DEFAULT 0,
    "cost_breakdown" JSONB,
    "model_id" TEXT,
    "temperature" DOUBLE PRECISION,
    "max_tokens" INTEGER,
    "stop_reason" TEXT,
    "time_to_first_token" DOUBLE PRECISION,
    "tokens_per_second" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "retry_count" INTEGER DEFAULT 0,
    "error_type" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "artifacts" JSONB,
    "remote_job_id" UUID,
    "executed_on" TEXT,

    CONSTRAINT "component_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otel_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "workflow_run_id" UUID,
    "component_run_id" UUID,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_name" TEXT,
    "metadata" JSONB,
    "attributes" JSONB,
    "tool_name" TEXT,
    "tool_parameters" JSONB,
    "tool_duration" DOUBLE PRECISION,
    "tool_success" BOOLEAN,
    "tool_error" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "aggregated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defects_new" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL,
    "found_in_story_id" UUID,
    "introduced_by_story_id" UUID,
    "confirmed_by_user_id" UUID,
    "introduced_by_workflow_run_id" UUID,
    "introduced_by_component_id" UUID,
    "status" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "fixed_at" TIMESTAMP(3),
    "root_cause" TEXT,
    "affected_files" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_workflows" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_by" TEXT NOT NULL,
    "files_generated" TEXT[],
    "status" TEXT NOT NULL,
    "auto_sync" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "active_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worktrees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID NOT NULL,
    "branch_name" TEXT NOT NULL,
    "worktree_path" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL DEFAULT 'main',
    "status" "WorktreeStatus" NOT NULL DEFAULT 'active',
    "host_type" "WorktreeHostType" NOT NULL DEFAULT 'remote',
    "host_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worktrees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_queue" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "QueueStatus" NOT NULL DEFAULT 'pending',
    "submitted_by" TEXT NOT NULL,
    "test_results" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_queue_locks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "reason" TEXT NOT NULL,
    "locked_by" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_queue_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PRStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_aggregations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "aggregation_type" TEXT NOT NULL,
    "aggregation_date" TIMESTAMP(3) NOT NULL,
    "project_id" UUID NOT NULL,
    "metrics" JSONB NOT NULL,
    "last_calculated_at" TIMESTAMP(3) NOT NULL,
    "calculation_time" INTEGER NOT NULL,

    CONSTRAINT "metrics_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "release_date" TIMESTAMP(3),
    "status" "ReleaseStatus" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_items" (
    "release_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,

    CONSTRAINT "release_items_pkey" PRIMARY KEY ("release_id","story_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "project_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diff" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_locks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID,
    "pr_number" INTEGER,
    "reason" TEXT NOT NULL,
    "locked_by" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID,
    "pr_number" INTEGER,
    "deployment_id" UUID,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'pending',
    "environment" TEXT NOT NULL,
    "branch" TEXT,
    "commit_hash" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "deployed_by" TEXT,
    "deployed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "logs" TEXT,
    "metadata" JSONB,
    "approval_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_deployment_states" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service" TEXT NOT NULL,
    "last_deployed_commit" TEXT NOT NULL,
    "last_deployed_at" TIMESTAMP(3) NOT NULL,
    "files_changed" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_deployment_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disk_usage_alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_type" "AlertType" NOT NULL,
    "threshold_gb" INTEGER NOT NULL,
    "available_space_gb" DECIMAL(10,2) NOT NULL,
    "used_space_gb" DECIMAL(10,2) NOT NULL,
    "total_space_gb" DECIMAL(10,2) NOT NULL,
    "percent_used" DECIMAL(5,2) NOT NULL,
    "worktree_count" INTEGER NOT NULL,
    "stalled_count" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "disk_usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disk_usage_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_date" TIMESTAMP(3) NOT NULL,
    "report_period_start" TIMESTAMP(3) NOT NULL,
    "report_period_end" TIMESTAMP(3) NOT NULL,
    "total_space_gb" DECIMAL(10,2) NOT NULL,
    "used_space_gb" DECIMAL(10,2) NOT NULL,
    "available_space_gb" DECIMAL(10,2) NOT NULL,
    "percent_used" DECIMAL(5,2) NOT NULL,
    "total_worktrees" INTEGER NOT NULL,
    "active_worktrees" INTEGER NOT NULL,
    "stalled_worktrees" INTEGER NOT NULL,
    "total_worktree_usage_mb" INTEGER NOT NULL,
    "avg_worktree_usage_mb" DECIMAL(10,2) NOT NULL,
    "largest_worktrees" JSONB,
    "stalled_worktrees_list" JSONB,
    "week_over_week_change_gb" DECIMAL(10,2),
    "week_over_week_change_percent" DECIMAL(5,2),
    "reportHtml" TEXT,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),

    CONSTRAINT "disk_usage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "component_id" UUID,
    "pre_execution_instructions" TEXT,
    "post_execution_instructions" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "run_location" TEXT NOT NULL DEFAULT 'local',
    "offline_fallback" TEXT NOT NULL DEFAULT 'pause',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runner_breakpoints" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "position" "BreakpointPosition" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hit_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runner_breakpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_agents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "hostname" TEXT NOT NULL,
    "socket_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "last_seen_at" TIMESTAMP(3),
    "capabilities" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "claude_code_available" BOOLEAN NOT NULL DEFAULT false,
    "claude_code_version" TEXT,
    "current_execution_id" UUID,

    CONSTRAINT "remote_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_jobs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "script" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "agent_id" TEXT,
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "job_type" TEXT,
    "component_run_id" UUID,
    "workflow_run_id" UUID,
    "last_heartbeat_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "reconnect_expires_at" TIMESTAMP(3),

    CONSTRAINT "remote_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "schema" JSONB,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifact_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "definition_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_component_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_access" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "definition_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "access_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_stream_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "component_run_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_stream_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE INDEX "epics_project_id_status_idx" ON "epics"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "epics_project_id_key_key" ON "epics"("project_id", "key");

-- CreateIndex
CREATE INDEX "stories_project_id_status_type_idx" ON "stories"("project_id", "status", "type");

-- CreateIndex
CREATE INDEX "stories_epic_id_idx" ON "stories"("epic_id");

-- CreateIndex
CREATE INDEX "stories_assigned_framework_id_idx" ON "stories"("assigned_framework_id");

-- CreateIndex
CREATE INDEX "stories_assigned_workflow_id_idx" ON "stories"("assigned_workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "stories_project_id_key_key" ON "stories"("project_id", "key");

-- CreateIndex
CREATE INDEX "subtasks_story_id_status_idx" ON "subtasks"("story_id", "status");

-- CreateIndex
CREATE INDEX "subtasks_component_run_id_idx" ON "subtasks"("component_run_id");

-- CreateIndex
CREATE INDEX "code_metrics_project_id_maintainability_index_idx" ON "code_metrics"("project_id", "maintainability_index");

-- CreateIndex
CREATE INDEX "code_metrics_project_id_risk_score_idx" ON "code_metrics"("project_id", "risk_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "code_metrics_project_id_file_path_key" ON "code_metrics"("project_id", "file_path");

-- CreateIndex
CREATE INDEX "code_metrics_snapshots_project_id_snapshot_date_idx" ON "code_metrics_snapshots"("project_id", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "code_metrics_snapshots_project_id_created_at_idx" ON "code_metrics_snapshots"("project_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "code_metrics_snapshots_project_id_snapshot_date_key" ON "code_metrics_snapshots"("project_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "use_cases_project_id_area_idx" ON "use_cases"("project_id", "area");

-- CreateIndex
CREATE UNIQUE INDEX "use_cases_project_id_key_key" ON "use_cases"("project_id", "key");

-- CreateIndex
CREATE INDEX "use_case_versions_use_case_id_idx" ON "use_case_versions"("use_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "use_case_versions_use_case_id_version_key" ON "use_case_versions"("use_case_id", "version");

-- CreateIndex
CREATE INDEX "file_use_case_links_project_id_file_path_idx" ON "file_use_case_links"("project_id", "file_path");

-- CreateIndex
CREATE INDEX "file_use_case_links_project_id_use_case_id_idx" ON "file_use_case_links"("project_id", "use_case_id");

-- CreateIndex
CREATE INDEX "file_use_case_links_project_id_confidence_idx" ON "file_use_case_links"("project_id", "confidence" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "file_use_case_links_project_id_file_path_use_case_id_key" ON "file_use_case_links"("project_id", "file_path", "use_case_id");

-- CreateIndex
CREATE INDEX "commits_project_id_timestamp_idx" ON "commits"("project_id", "timestamp");

-- CreateIndex
CREATE INDEX "commits_story_id_idx" ON "commits"("story_id");

-- CreateIndex
CREATE INDEX "commit_files_commit_hash_idx" ON "commit_files"("commit_hash");

-- CreateIndex
CREATE INDEX "commit_files_file_path_idx" ON "commit_files"("file_path");

-- CreateIndex
CREATE INDEX "test_cases_project_id_test_level_idx" ON "test_cases"("project_id", "test_level");

-- CreateIndex
CREATE INDEX "test_cases_use_case_id_idx" ON "test_cases"("use_case_id");

-- CreateIndex
CREATE INDEX "test_cases_status_idx" ON "test_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_project_id_key_key" ON "test_cases"("project_id", "key");

-- CreateIndex
CREATE INDEX "test_executions_test_case_id_executed_at_idx" ON "test_executions"("test_case_id", "executed_at");

-- CreateIndex
CREATE INDEX "test_executions_story_id_idx" ON "test_executions"("story_id");

-- CreateIndex
CREATE INDEX "test_executions_commit_hash_idx" ON "test_executions"("commit_hash");

-- CreateIndex
CREATE INDEX "test_executions_status_idx" ON "test_executions"("status");

-- CreateIndex
CREATE INDEX "agents_project_id_active_idx" ON "agents"("project_id", "active");

-- CreateIndex
CREATE INDEX "agent_frameworks_project_id_active_idx" ON "agent_frameworks"("project_id", "active");

-- CreateIndex
CREATE INDEX "runs_project_id_started_at_idx" ON "runs"("project_id", "started_at");

-- CreateIndex
CREATE INDEX "runs_story_id_idx" ON "runs"("story_id");

-- CreateIndex
CREATE INDEX "runs_framework_id_success_idx" ON "runs"("framework_id", "success");

-- CreateIndex
CREATE INDEX "components_project_id_idx" ON "components"("project_id");

-- CreateIndex
CREATE INDEX "components_project_id_active_idx" ON "components"("project_id", "active");

-- CreateIndex
CREATE INDEX "components_tags_idx" ON "components"("tags");

-- CreateIndex
CREATE INDEX "components_parent_id_idx" ON "components"("parent_id");

-- CreateIndex
CREATE INDEX "components_project_id_active_version_major_idx" ON "components"("project_id", "active", "version_major");

-- CreateIndex
CREATE INDEX "components_version_major_version_minor_idx" ON "components"("version_major", "version_minor");

-- CreateIndex
CREATE INDEX "workflows_project_id_idx" ON "workflows"("project_id");

-- CreateIndex
CREATE INDEX "workflows_coordinator_id_idx" ON "workflows"("coordinator_id");

-- CreateIndex
CREATE INDEX "workflows_project_id_active_idx" ON "workflows"("project_id", "active");

-- CreateIndex
CREATE INDEX "workflows_parent_id_idx" ON "workflows"("parent_id");

-- CreateIndex
CREATE INDEX "workflows_project_id_active_version_major_idx" ON "workflows"("project_id", "active", "version_major");

-- CreateIndex
CREATE INDEX "workflows_version_major_version_minor_idx" ON "workflows"("version_major", "version_minor");

-- CreateIndex
CREATE INDEX "workflow_runs_project_id_idx" ON "workflow_runs"("project_id");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_runs_story_id_idx" ON "workflow_runs"("story_id");

-- CreateIndex
CREATE INDEX "workflow_runs_coordinator_id_idx" ON "workflow_runs"("coordinator_id");

-- CreateIndex
CREATE INDEX "workflow_runs_started_at_idx" ON "workflow_runs"("started_at");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_current_state_id_idx" ON "workflow_runs"("current_state_id");

-- CreateIndex
CREATE INDEX "workflow_runs_is_paused_idx" ON "workflow_runs"("is_paused");

-- CreateIndex
CREATE INDEX "component_runs_workflow_run_id_idx" ON "component_runs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "component_runs_component_id_idx" ON "component_runs"("component_id");

-- CreateIndex
CREATE INDEX "component_runs_started_at_idx" ON "component_runs"("started_at");

-- CreateIndex
CREATE INDEX "component_runs_status_idx" ON "component_runs"("status");

-- CreateIndex
CREATE INDEX "component_runs_remote_job_id_idx" ON "component_runs"("remote_job_id");

-- CreateIndex
CREATE INDEX "otel_events_session_id_timestamp_idx" ON "otel_events"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "otel_events_workflow_run_id_component_run_id_idx" ON "otel_events"("workflow_run_id", "component_run_id");

-- CreateIndex
CREATE INDEX "otel_events_project_id_event_type_timestamp_idx" ON "otel_events"("project_id", "event_type", "timestamp");

-- CreateIndex
CREATE INDEX "otel_events_processed_aggregated_at_idx" ON "otel_events"("processed", "aggregated_at");

-- CreateIndex
CREATE UNIQUE INDEX "defects_new_key_key" ON "defects_new"("key");

-- CreateIndex
CREATE INDEX "defects_new_project_id_idx" ON "defects_new"("project_id");

-- CreateIndex
CREATE INDEX "defects_new_found_in_story_id_idx" ON "defects_new"("found_in_story_id");

-- CreateIndex
CREATE INDEX "defects_new_introduced_by_story_id_idx" ON "defects_new"("introduced_by_story_id");

-- CreateIndex
CREATE INDEX "defects_new_status_idx" ON "defects_new"("status");

-- CreateIndex
CREATE INDEX "active_workflows_workflow_id_idx" ON "active_workflows"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_workflows_project_id_key" ON "active_workflows"("project_id");

-- CreateIndex
CREATE INDEX "worktrees_story_id_status_idx" ON "worktrees"("story_id", "status");

-- CreateIndex
CREATE INDEX "worktrees_status_idx" ON "worktrees"("status");

-- CreateIndex
CREATE INDEX "worktrees_branch_name_idx" ON "worktrees"("branch_name");

-- CreateIndex
CREATE INDEX "worktrees_status_updated_at_idx" ON "worktrees"("status", "updated_at");

-- CreateIndex
CREATE INDEX "test_queue_status_position_idx" ON "test_queue"("status", "position");

-- CreateIndex
CREATE INDEX "test_queue_status_priority_idx" ON "test_queue"("status", "priority");

-- CreateIndex
CREATE INDEX "test_queue_story_id_idx" ON "test_queue"("story_id");

-- CreateIndex
CREATE INDEX "test_queue_submitted_by_idx" ON "test_queue"("submitted_by");

-- CreateIndex
CREATE INDEX "test_queue_locks_active_expires_at_idx" ON "test_queue_locks"("active", "expires_at");

-- CreateIndex
CREATE INDEX "pull_requests_story_id_status_idx" ON "pull_requests"("story_id", "status");

-- CreateIndex
CREATE INDEX "pull_requests_pr_number_idx" ON "pull_requests"("pr_number");

-- CreateIndex
CREATE INDEX "pull_requests_status_idx" ON "pull_requests"("status");

-- CreateIndex
CREATE INDEX "metrics_aggregations_project_id_aggregation_type_aggregatio_idx" ON "metrics_aggregations"("project_id", "aggregation_type", "aggregation_date");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_aggregations_project_id_aggregation_type_aggregatio_key" ON "metrics_aggregations"("project_id", "aggregation_type", "aggregation_date");

-- CreateIndex
CREATE INDEX "releases_project_id_status_idx" ON "releases"("project_id", "status");

-- CreateIndex
CREATE INDEX "audit_log_project_id_at_idx" ON "audit_log"("project_id", "at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "deployment_locks_active_expires_at_idx" ON "deployment_locks"("active", "expires_at");

-- CreateIndex
CREATE INDEX "deployment_locks_story_id_idx" ON "deployment_locks"("story_id");

-- CreateIndex
CREATE INDEX "deployment_logs_status_created_at_idx" ON "deployment_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "deployment_logs_story_id_status_idx" ON "deployment_logs"("story_id", "status");

-- CreateIndex
CREATE INDEX "deployment_logs_pr_number_idx" ON "deployment_logs"("pr_number");

-- CreateIndex
CREATE INDEX "deployment_logs_environment_status_idx" ON "deployment_logs"("environment", "status");

-- CreateIndex
CREATE INDEX "deployment_logs_created_at_idx" ON "deployment_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_deployment_states_service_key" ON "service_deployment_states"("service");

-- CreateIndex
CREATE INDEX "service_deployment_states_service_idx" ON "service_deployment_states"("service");

-- CreateIndex
CREATE INDEX "service_deployment_states_last_deployed_at_idx" ON "service_deployment_states"("last_deployed_at");

-- CreateIndex
CREATE INDEX "disk_usage_alerts_created_at_idx" ON "disk_usage_alerts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "disk_usage_alerts_alert_type_created_at_idx" ON "disk_usage_alerts"("alert_type", "created_at");

-- CreateIndex
CREATE INDEX "disk_usage_reports_report_date_idx" ON "disk_usage_reports"("report_date" DESC);

-- CreateIndex
CREATE INDEX "disk_usage_reports_created_at_idx" ON "disk_usage_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_states_workflow_id_order_idx" ON "workflow_states"("workflow_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflow_id_name_key" ON "workflow_states"("workflow_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflow_id_order_key" ON "workflow_states"("workflow_id", "order");

-- CreateIndex
CREATE INDEX "runner_breakpoints_workflow_run_id_is_active_idx" ON "runner_breakpoints"("workflow_run_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "runner_breakpoints_workflow_run_id_state_id_position_key" ON "runner_breakpoints"("workflow_run_id", "state_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "remote_agents_hostname_key" ON "remote_agents"("hostname");

-- CreateIndex
CREATE INDEX "remote_agents_status_claude_code_available_idx" ON "remote_agents"("status", "claude_code_available");

-- CreateIndex
CREATE INDEX "remote_jobs_status_created_at_idx" ON "remote_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "remote_jobs_component_run_id_idx" ON "remote_jobs"("component_run_id");

-- CreateIndex
CREATE INDEX "remote_jobs_workflow_run_id_status_idx" ON "remote_jobs"("workflow_run_id", "status");

-- CreateIndex
CREATE INDEX "remote_jobs_status_reconnect_expires_at_idx" ON "remote_jobs"("status", "reconnect_expires_at");

-- CreateIndex
CREATE INDEX "artifact_definitions_workflow_id_idx" ON "artifact_definitions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_definitions_workflow_id_key_key" ON "artifact_definitions"("workflow_id", "key");

-- CreateIndex
CREATE INDEX "artifacts_workflow_run_id_idx" ON "artifacts"("workflow_run_id");

-- CreateIndex
CREATE INDEX "artifacts_definition_id_workflow_run_id_idx" ON "artifacts"("definition_id", "workflow_run_id");

-- CreateIndex
CREATE INDEX "artifact_access_state_id_idx" ON "artifact_access"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_access_definition_id_state_id_key" ON "artifact_access"("definition_id", "state_id");

-- CreateIndex
CREATE INDEX "agent_stream_events_component_run_id_sequence_number_idx" ON "agent_stream_events"("component_run_id", "sequence_number");

-- CreateIndex
CREATE INDEX "agent_stream_events_workflow_run_id_event_type_idx" ON "agent_stream_events"("workflow_run_id", "event_type");

-- CreateIndex
CREATE INDEX "agent_stream_events_component_run_id_event_type_timestamp_idx" ON "agent_stream_events"("component_run_id", "event_type", "timestamp");

-- AddForeignKey
ALTER TABLE "epics" ADD CONSTRAINT "epics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_assigned_framework_id_fkey" FOREIGN KEY ("assigned_framework_id") REFERENCES "agent_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_assigned_workflow_id_fkey" FOREIGN KEY ("assigned_workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_component_run_id_fkey" FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_metrics" ADD CONSTRAINT "code_metrics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_metrics_snapshots" ADD CONSTRAINT "code_metrics_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "use_cases" ADD CONSTRAINT "use_cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "use_case_versions" ADD CONSTRAINT "use_case_versions_use_case_id_fkey" FOREIGN KEY ("use_case_id") REFERENCES "use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "use_case_versions" ADD CONSTRAINT "use_case_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_use_case_links" ADD CONSTRAINT "story_use_case_links_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_use_case_links" ADD CONSTRAINT "story_use_case_links_use_case_id_fkey" FOREIGN KEY ("use_case_id") REFERENCES "use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_use_case_links" ADD CONSTRAINT "file_use_case_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_use_case_links" ADD CONSTRAINT "file_use_case_links_use_case_id_fkey" FOREIGN KEY ("use_case_id") REFERENCES "use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_files" ADD CONSTRAINT "commit_files_commit_hash_fkey" FOREIGN KEY ("commit_hash") REFERENCES "commits"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_use_case_id_fkey" FOREIGN KEY ("use_case_id") REFERENCES "use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_commit_hash_fkey" FOREIGN KEY ("commit_hash") REFERENCES "commits"("hash") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_frameworks" ADD CONSTRAINT "agent_frameworks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "agent_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_current_state_id_fkey" FOREIGN KEY ("current_state_id") REFERENCES "workflow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_runs" ADD CONSTRAINT "component_runs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_runs" ADD CONSTRAINT "component_runs_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otel_events" ADD CONSTRAINT "otel_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otel_events" ADD CONSTRAINT "otel_events_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otel_events" ADD CONSTRAINT "otel_events_component_run_id_fkey" FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_found_in_story_id_fkey" FOREIGN KEY ("found_in_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_story_id_fkey" FOREIGN KEY ("introduced_by_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_workflow_run_id_fkey" FOREIGN KEY ("introduced_by_workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_component_id_fkey" FOREIGN KEY ("introduced_by_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_workflows" ADD CONSTRAINT "active_workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_workflows" ADD CONSTRAINT "active_workflows_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worktrees" ADD CONSTRAINT "worktrees_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_queue" ADD CONSTRAINT "test_queue_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_aggregations" ADD CONSTRAINT "metrics_aggregations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_items" ADD CONSTRAINT "release_items_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_items" ADD CONSTRAINT "release_items_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_locks" ADD CONSTRAINT "deployment_locks_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runner_breakpoints" ADD CONSTRAINT "runner_breakpoints_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runner_breakpoints" ADD CONSTRAINT "runner_breakpoints_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_definitions" ADD CONSTRAINT "artifact_definitions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "artifact_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_component_id_fkey" FOREIGN KEY ("created_by_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_access" ADD CONSTRAINT "artifact_access_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "artifact_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_access" ADD CONSTRAINT "artifact_access_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stream_events" ADD CONSTRAINT "agent_stream_events_component_run_id_fkey" FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stream_events" ADD CONSTRAINT "agent_stream_events_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

