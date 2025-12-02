-- ST-160: Native Subagent Support and Agent Question Handling
-- This migration adds support for:
-- 1. Native subagent types (Explore, Plan, General) as execution types for Components
-- 2. AgentQuestion model for tracking questions asked by Claude CLI agents during execution

-- CreateEnum
CREATE TYPE "AgentQuestionStatus" AS ENUM ('pending', 'answered', 'skipped', 'cancelled');

-- AlterTable: Add execution type fields to components
ALTER TABLE "components" ADD COLUMN "execution_type" TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE "components" ADD COLUMN "native_agent_config" JSONB;

-- CreateTable: agent_questions
CREATE TABLE "agent_questions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "component_run_id" UUID,
    "session_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "status" "AgentQuestionStatus" NOT NULL DEFAULT 'pending',
    "answer" TEXT,
    "answered_by" TEXT,
    "answered_at" TIMESTAMP(3),
    "can_handoff" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_questions_workflow_run_id_status_idx" ON "agent_questions"("workflow_run_id", "status");

-- CreateIndex
CREATE INDEX "agent_questions_session_id_idx" ON "agent_questions"("session_id");

-- CreateIndex
CREATE INDEX "agent_questions_status_created_at_idx" ON "agent_questions"("status", "created_at");
