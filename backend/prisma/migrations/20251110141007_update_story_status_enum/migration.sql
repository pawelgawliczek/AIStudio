-- Sprint 6: Update StoryStatus enum with new statuses
-- Add 'backlog' and 'blocked' statuses to support Kanban workflow

-- Add new enum values to StoryStatus
ALTER TYPE "StoryStatus" ADD VALUE IF NOT EXISTS 'backlog';
ALTER TYPE "StoryStatus" ADD VALUE IF NOT EXISTS 'blocked';

-- Note: If 'impl' exists, it should be renamed to 'implementation'
-- This requires data migration if any stories use 'impl' status
-- UPDATE stories SET status = 'implementation' WHERE status = 'impl';
-- Then manually remove 'impl' from enum (requires recreation)

-- The enum now supports the full Kanban workflow:
-- backlog -> planning -> analysis -> architecture -> design ->
-- implementation -> review -> qa -> done (with blocked as exception state)
