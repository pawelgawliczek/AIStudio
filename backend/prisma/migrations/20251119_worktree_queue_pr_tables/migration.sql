-- ST-38: Add database schema for worktree, test queue, and pull request management
-- Epic: EP-7 - Git Workflow Agent
-- Date: 2025-11-19

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

-- WorktreeStatus enum
CREATE TYPE "WorktreeStatus" AS ENUM (
  'active',
  'idle',
  'cleaning',
  'removed'
);

-- QueueStatus enum
CREATE TYPE "QueueStatus" AS ENUM (
  'pending',
  'running',
  'passed',
  'failed',
  'cancelled',
  'skipped'
);

-- PRStatus enum
CREATE TYPE "PRStatus" AS ENUM (
  'draft',
  'open',
  'approved',
  'changes_requested',
  'merged',
  'closed',
  'conflict'
);

-- StoryPhase enum
CREATE TYPE "StoryPhase" AS ENUM (
  'context',
  'ba',
  'design',
  'architecture',
  'implementation',
  'testing',
  'review',
  'done'
);

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- Worktree table
CREATE TABLE "worktrees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "story_id" UUID NOT NULL,
    "branch_name" TEXT NOT NULL,
    "worktree_path" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL DEFAULT 'main',
    "status" "WorktreeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worktrees_pkey" PRIMARY KEY ("id")
);

-- TestQueue table
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

-- PullRequest table
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

-- ============================================================================
-- STEP 3: EXTEND STORY TABLE
-- ============================================================================

-- Add currentPhase field to stories table
ALTER TABLE "stories" ADD COLUMN "current_phase" "StoryPhase";

-- ============================================================================
-- STEP 4: CREATE INDEXES
-- ============================================================================

-- Worktree indexes
CREATE INDEX "worktrees_story_id_status_idx" ON "worktrees"("story_id", "status");
CREATE INDEX "worktrees_status_idx" ON "worktrees"("status");
CREATE INDEX "worktrees_branch_name_idx" ON "worktrees"("branch_name");

-- TestQueue indexes
CREATE INDEX "test_queue_story_id_idx" ON "test_queue"("story_id");
CREATE INDEX "test_queue_status_position_idx" ON "test_queue"("status", "position");
CREATE INDEX "test_queue_status_priority_idx" ON "test_queue"("status", "priority");
CREATE INDEX "test_queue_submitted_by_idx" ON "test_queue"("submitted_by");

-- PullRequest indexes
CREATE INDEX "pull_requests_story_id_status_idx" ON "pull_requests"("story_id", "status");
CREATE INDEX "pull_requests_pr_number_idx" ON "pull_requests"("pr_number");
CREATE INDEX "pull_requests_status_idx" ON "pull_requests"("status");

-- ============================================================================
-- STEP 5: ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Worktree foreign key (CASCADE delete)
ALTER TABLE "worktrees"
  ADD CONSTRAINT "worktrees_story_id_fkey"
  FOREIGN KEY ("story_id")
  REFERENCES "stories"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- TestQueue foreign key (CASCADE delete)
ALTER TABLE "test_queue"
  ADD CONSTRAINT "test_queue_story_id_fkey"
  FOREIGN KEY ("story_id")
  REFERENCES "stories"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- PullRequest foreign key (CASCADE delete)
ALTER TABLE "pull_requests"
  ADD CONSTRAINT "pull_requests_story_id_fkey"
  FOREIGN KEY ("story_id")
  REFERENCES "stories"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
