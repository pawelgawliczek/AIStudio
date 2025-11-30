-- ST-148: Approval Gates - Human-in-the-Loop
-- This migration creates the approval_requests table and related enums
-- for implementing human approval gates in the Story Runner

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalResolution" AS ENUM ('approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ReExecutionMode" AS ENUM ('feedback_injection', 'artifact_edit', 'both', 'none');

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "state_name" TEXT NOT NULL,
    "state_order" INTEGER NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "context_summary" TEXT,
    "artifact_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution" "ApprovalResolution",
    "reason" TEXT,
    "re_execution_mode" "ReExecutionMode",
    "feedback" TEXT,
    "edited_artifacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint (only one pending approval per run+state)
CREATE UNIQUE INDEX "approval_requests_workflow_run_id_state_id_key" ON "approval_requests"("workflow_run_id", "state_id");

-- CreateIndex: Query pending approvals by run
CREATE INDEX "approval_requests_workflow_run_id_status_idx" ON "approval_requests"("workflow_run_id", "status");

-- CreateIndex: Query pending approvals by project
CREATE INDEX "approval_requests_project_id_status_idx" ON "approval_requests"("project_id", "status");

-- CreateIndex: Query all pending approvals ordered by time
CREATE INDEX "approval_requests_status_requested_at_idx" ON "approval_requests"("status", "requested_at");

-- AddForeignKey: Link to workflow_runs
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link to workflow_states
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link to projects
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
