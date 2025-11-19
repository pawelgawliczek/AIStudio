-- ST-43: Add test queue locking for schema migrations
-- Epic: EP-7 - Git Workflow Agent
-- Date: 2025-11-19
-- Author: Full-Stack Developer Component
--
-- Purpose: Enable locking of test queue during breaking schema migrations
-- to prevent tests from executing against inconsistent database state.
--
-- Key Features:
-- - Singleton lock pattern (only one active lock at a time)
-- - Auto-expiry mechanism (default 60 minutes)
-- - Soft delete audit trail (active=false instead of DELETE)
-- - Composite index for fast lock queries (<5ms target)

-- Create test_queue_locks table
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

-- Create composite index for efficient lock queries
-- Query pattern: WHERE active = true AND expires_at > NOW()
-- Expected query time: <5ms (targeting sub-millisecond on indexed boolean + timestamp)
CREATE INDEX "test_queue_locks_active_expires_at_idx"
ON "test_queue_locks"("active", "expires_at");

-- Verification queries (commented out - for manual testing)
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'test_queue_locks';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'test_queue_locks';
