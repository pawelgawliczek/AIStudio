-- Agent Workflow MVP Migration
-- Add new models for Generic Component + Coordinator Pattern

-- Add RunStatus enum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'paused');

-- Update stories table
ALTER TABLE "stories" ADD COLUMN "assigned_workflow_id" UUID;
ALTER TABLE "stories" ADD COLUMN "defect_leakage_count" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "stories_assigned_workflow_id_idx" ON "stories"("assigned_workflow_id");

-- Update subtasks table
ALTER TABLE "subtasks" ADD COLUMN "component_run_id" UUID;
CREATE INDEX "subtasks_component_run_id_idx" ON "subtasks"("component_run_id");

-- Create components table
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

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "components_project_id_idx" ON "components"("project_id");
CREATE INDEX "components_project_id_active_idx" ON "components"("project_id", "active");
CREATE INDEX "components_tags_idx" ON "components" USING GIN ("tags");

-- Create coordinator_agents table
CREATE TABLE "coordinator_agents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "coordinator_instructions" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "tools" TEXT[],
    "decision_strategy" TEXT NOT NULL,
    "component_ids" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordinator_agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coordinator_agents_project_id_idx" ON "coordinator_agents"("project_id");
CREATE INDEX "coordinator_agents_project_id_active_idx" ON "coordinator_agents"("project_id", "active");
CREATE INDEX "coordinator_agents_domain_idx" ON "coordinator_agents"("domain");

-- Create workflows table
CREATE TABLE "workflows" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "coordinator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "trigger_config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflows_project_id_idx" ON "workflows"("project_id");
CREATE INDEX "workflows_coordinator_id_idx" ON "workflows"("coordinator_id");
CREATE INDEX "workflows_project_id_active_idx" ON "workflows"("project_id", "active");

-- Create workflow_runs table
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "story_id" UUID,
    "coordinator_id" UUID NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "total_tokens_in" INTEGER,
    "total_tokens_out" INTEGER,
    "total_cost" DOUBLE PRECISION,
    "total_runtime" INTEGER,
    "total_user_prompts" INTEGER,
    "total_iterations" INTEGER,
    "total_interventions" INTEGER,
    "avg_prompts_per_component" DOUBLE PRECISION,
    "coordinator_decisions" JSONB,
    "coordinator_metrics" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_runs_project_id_idx" ON "workflow_runs"("project_id");
CREATE INDEX "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");
CREATE INDEX "workflow_runs_story_id_idx" ON "workflow_runs"("story_id");
CREATE INDEX "workflow_runs_coordinator_id_idx" ON "workflow_runs"("coordinator_id");
CREATE INDEX "workflow_runs_started_at_idx" ON "workflow_runs"("started_at");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- Create component_runs table
CREATE TABLE "component_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "execution_order" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "input_data" JSONB NOT NULL,
    "output_data" JSONB,
    "tokens_input" INTEGER NOT NULL,
    "tokens_output" INTEGER NOT NULL,
    "runtime" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "iterations" INTEGER NOT NULL DEFAULT 1,
    "loc_generated" INTEGER,
    "user_prompts" INTEGER NOT NULL DEFAULT 0,
    "system_iterations" INTEGER NOT NULL DEFAULT 1,
    "human_interventions" INTEGER NOT NULL DEFAULT 0,
    "iteration_log" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_type" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "artifacts" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "component_runs_workflow_run_id_idx" ON "component_runs"("workflow_run_id");
CREATE INDEX "component_runs_component_id_idx" ON "component_runs"("component_id");
CREATE INDEX "component_runs_started_at_idx" ON "component_runs"("started_at");
CREATE INDEX "component_runs_status_idx" ON "component_runs"("status");

-- Create defects_new table (enhanced defect tracking)
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

CREATE UNIQUE INDEX "defects_new_key_key" ON "defects_new"("key");
CREATE INDEX "defects_new_project_id_idx" ON "defects_new"("project_id");
CREATE INDEX "defects_new_found_in_story_id_idx" ON "defects_new"("found_in_story_id");
CREATE INDEX "defects_new_introduced_by_story_id_idx" ON "defects_new"("introduced_by_story_id");
CREATE INDEX "defects_new_status_idx" ON "defects_new"("status");

-- Create active_workflows table
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "active_workflows_project_id_key" ON "active_workflows"("project_id");
CREATE INDEX "active_workflows_workflow_id_idx" ON "active_workflows"("workflow_id");

-- Create metrics_aggregations table
CREATE TABLE "metrics_aggregations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "aggregation_type" TEXT NOT NULL,
    "aggregation_date" TIMESTAMP(3) NOT NULL,
    "project_id" UUID NOT NULL,
    "metrics" JSONB NOT NULL,
    "last_calculated_at" TIMESTAMP(3) NOT NULL,
    "calculation_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_aggregations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metrics_aggregations_project_id_aggregation_type_aggregation_date_key" ON "metrics_aggregations"("project_id", "aggregation_type", "aggregation_date");
CREATE INDEX "metrics_aggregations_project_id_aggregation_type_aggregation_date_idx" ON "metrics_aggregations"("project_id", "aggregation_type", "aggregation_date");

-- Add foreign key constraints
ALTER TABLE "stories" ADD CONSTRAINT "stories_assigned_workflow_id_fkey" FOREIGN KEY ("assigned_workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_component_run_id_fkey" FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_agents" ADD CONSTRAINT "coordinator_agents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "coordinator_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "coordinator_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "component_runs" ADD CONSTRAINT "component_runs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "component_runs" ADD CONSTRAINT "component_runs_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_found_in_story_id_fkey" FOREIGN KEY ("found_in_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_story_id_fkey" FOREIGN KEY ("introduced_by_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_workflow_run_id_fkey" FOREIGN KEY ("introduced_by_workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defects_new" ADD CONSTRAINT "defects_new_introduced_by_component_id_fkey" FOREIGN KEY ("introduced_by_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "active_workflows" ADD CONSTRAINT "active_workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "active_workflows" ADD CONSTRAINT "active_workflows_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "metrics_aggregations" ADD CONSTRAINT "metrics_aggregations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
