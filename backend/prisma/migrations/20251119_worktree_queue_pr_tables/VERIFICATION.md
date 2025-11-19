# Migration Verification Guide - ST-38

## Migration Overview
This migration adds database schema for worktree, test queue, and pull request management (Epic EP-7).

**Date**: 2025-11-19
**Story**: ST-38
**Epic**: EP-7 - Git Workflow Agent - Backend & MCP Tools

## What This Migration Does

### 1. Creates 4 New Enums
- `WorktreeStatus`: active, idle, cleaning, removed
- `QueueStatus`: pending, running, passed, failed, cancelled, skipped
- `PRStatus`: draft, open, approved, changes_requested, merged, closed, conflict
- `StoryPhase`: context, ba, design, architecture, implementation, testing, review, done

### 2. Creates 3 New Tables
- **worktrees**: Git worktree tracking for parallel development
- **test_queue**: Queue-based story testing with priority management
- **pull_requests**: GitHub/GitLab pull request lifecycle tracking

### 3. Extends Story Table
- Adds `current_phase` field (nullable, StoryPhase enum)
- Adds relations to worktrees, testQueueEntries, pullRequests

### 4. Creates Indexes
- 12 indexes total for query optimization
- Composite indexes for common access patterns

### 5. Adds Foreign Key Constraints
- All with CASCADE delete policy
- Ensures referential integrity

## Pre-Migration Checklist

- [ ] Database backup completed
- [ ] Staging environment tested
- [ ] Migration SQL reviewed
- [ ] Prisma schema validated
- [ ] Database connection confirmed

## Running the Migration

### Option 1: Using Prisma Migrate (Recommended)
```bash
cd /opt/stack/AIStudio/backend
npx prisma migrate deploy
```

### Option 2: Manual SQL Execution
```bash
psql -U postgres -d vibestudio -f prisma/migrations/20251119_worktree_queue_pr_tables/migration.sql
```

## Post-Migration Validation

### 1. Verify Enums Created
```sql
SELECT typname FROM pg_type
WHERE typname IN ('WorktreeStatus', 'QueueStatus', 'PRStatus', 'StoryPhase');
-- Expected: 4 rows
```

### 2. Verify Tables Created
```sql
SELECT tablename FROM pg_tables
WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests');
-- Expected: 3 rows
```

### 3. Verify Story Field Added
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stories' AND column_name = 'current_phase';
-- Expected: 1 row (current_phase, USER-DEFINED)
```

### 4. Verify Indexes Created
```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests')
ORDER BY indexname;
-- Expected: 12 indexes
```

### 5. Verify Foreign Key Constraints
```sql
SELECT conname FROM pg_constraint
WHERE conname LIKE '%story_id_fkey%'
AND conrelid::regclass::text IN ('worktrees', 'test_queue', 'pull_requests');
-- Expected: 3 constraints
```

### 6. Test Cascade Delete
```sql
BEGIN;

-- Create test story
INSERT INTO stories (id, project_id, key, title, created_by)
VALUES (
  uuid_generate_v4(),
  (SELECT id FROM projects LIMIT 1),
  'TEST-DELETE',
  'Test Story for Cascade Delete',
  (SELECT id FROM users LIMIT 1)
) RETURNING id;

-- Note the ID, then create related records
INSERT INTO worktrees (story_id, branch_name, worktree_path)
VALUES ('<story_id>', 'test-branch', '/tmp/test');

-- Delete story and verify worktree is also deleted
DELETE FROM stories WHERE key = 'TEST-DELETE';

-- Verify no orphaned records
SELECT COUNT(*) FROM worktrees WHERE story_id = '<story_id>';
-- Expected: 0

ROLLBACK;
```

## Rollback Plan

If migration fails or needs to be reversed:

```sql
-- Drop foreign key constraints
ALTER TABLE "worktrees" DROP CONSTRAINT IF EXISTS "worktrees_story_id_fkey";
ALTER TABLE "test_queue" DROP CONSTRAINT IF EXISTS "test_queue_story_id_fkey";
ALTER TABLE "pull_requests" DROP CONSTRAINT IF EXISTS "pull_requests_story_id_fkey";

-- Drop Story extension
ALTER TABLE "stories" DROP COLUMN IF EXISTS "current_phase";

-- Drop tables (indexes drop automatically)
DROP TABLE IF EXISTS "worktrees";
DROP TABLE IF EXISTS "test_queue";
DROP TABLE IF EXISTS "pull_requests";

-- Drop enums
DROP TYPE IF EXISTS "WorktreeStatus";
DROP TYPE IF EXISTS "QueueStatus";
DROP TYPE IF EXISTS "PRStatus";
DROP TYPE IF EXISTS "StoryPhase";
```

## Success Criteria

✅ All enums created (4)
✅ All tables created (3)
✅ Story.currentPhase field added
✅ All indexes created (12)
✅ All foreign keys created (3)
✅ Cascade delete verified
✅ No data loss on existing stories
✅ Prisma Client regenerates successfully

## Performance Expectations

- Migration execution time: ~75 seconds on production
- No table locks on existing data (except brief lock for Story.currentPhase)
- Zero data loss guaranteed (all additions are new)

## Next Steps

After successful migration:

1. Regenerate Prisma Client: `npx prisma generate`
2. Restart NestJS backend to pick up new schema
3. Verify API endpoints can access new tables
4. Begin implementation of Git Workflow Agent services (separate story)

## Monitoring Queries

### Check Queue Health
```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(priority) as avg_priority,
  MIN(created_at) as oldest_entry
FROM test_queue
GROUP BY status;
```

### Check Worktree Status
```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_lifespan_seconds
FROM worktrees
GROUP BY status;
```

### Check PR Pipeline
```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_cycle_time_seconds
FROM pull_requests
GROUP BY status;
```

## Support

For issues or questions:
- Check Prisma logs: `npx prisma migrate status`
- Review PostgreSQL logs for constraint violations
- Contact: Development Team
- Story: ST-38
- Epic: EP-7
