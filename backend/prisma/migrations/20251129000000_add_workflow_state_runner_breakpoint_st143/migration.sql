-- ST-143: Add WorkflowState and RunnerBreakpoint models for Story Runner

-- CreateEnum
CREATE TYPE "BreakpointPosition" AS ENUM ('before', 'after');

-- AlterTable: Add runner fields to workflow_runs
ALTER TABLE "workflow_runs" ADD COLUMN "current_state_id" UUID,
ADD COLUMN "runner_session_id" TEXT,
ADD COLUMN "is_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paused_at" TIMESTAMP(3),
ADD COLUMN "pause_reason" TEXT;

-- CreateTable: workflow_states
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable: runner_breakpoints
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

-- CreateIndex: workflow_states indexes
CREATE INDEX "workflow_states_workflow_id_order_idx" ON "workflow_states"("workflow_id", "order");
CREATE UNIQUE INDEX "workflow_states_workflow_id_name_key" ON "workflow_states"("workflow_id", "name");
CREATE UNIQUE INDEX "workflow_states_workflow_id_order_key" ON "workflow_states"("workflow_id", "order");

-- CreateIndex: runner_breakpoints indexes
CREATE INDEX "runner_breakpoints_workflow_run_id_is_active_idx" ON "runner_breakpoints"("workflow_run_id", "is_active");
CREATE UNIQUE INDEX "runner_breakpoints_workflow_run_id_state_id_position_key" ON "runner_breakpoints"("workflow_run_id", "state_id", "position");

-- CreateIndex: workflow_runs indexes for new fields
CREATE INDEX "workflow_runs_current_state_id_idx" ON "workflow_runs"("current_state_id");
CREATE INDEX "workflow_runs_is_paused_idx" ON "workflow_runs"("is_paused");

-- AddForeignKey: workflow_states -> workflows
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: workflow_states -> components
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: runner_breakpoints -> workflow_runs
ALTER TABLE "runner_breakpoints" ADD CONSTRAINT "runner_breakpoints_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: runner_breakpoints -> workflow_states
ALTER TABLE "runner_breakpoints" ADD CONSTRAINT "runner_breakpoints_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: workflow_runs -> workflow_states (currentState)
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_current_state_id_fkey" FOREIGN KEY ("current_state_id") REFERENCES "workflow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
