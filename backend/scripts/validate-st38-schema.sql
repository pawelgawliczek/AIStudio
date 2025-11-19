-- ST-38: Schema Validation SQL Script
-- Epic: EP-7 - Git Workflow Agent
-- QA Automation Component: Manual Validation Checks

\echo '============================================================'
\echo 'ST-38: Database Schema Validation'
\echo '============================================================'
\echo ''

-- ============================================================================
-- AC-SCHEMA-004: Verify Enums Created
-- ============================================================================
\echo '1. Verifying Enum Creation (Expected: 4 enums)'
\echo '-----------------------------------------------------------'

SELECT typname as enum_name
FROM pg_type
WHERE typname IN ('WorktreeStatus', 'QueueStatus', 'PRStatus', 'StoryPhase')
ORDER BY typname;

\echo ''
\echo '   WorktreeStatus values:'
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'WorktreeStatus'::regtype ORDER BY enumsortorder;

\echo ''
\echo '   QueueStatus values:'
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'QueueStatus'::regtype ORDER BY enumsortorder;

\echo ''
\echo '   PRStatus values:'
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'PRStatus'::regtype ORDER BY enumsortorder;

\echo ''
\echo '   StoryPhase values:'
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'StoryPhase'::regtype ORDER BY enumsortorder;

-- ============================================================================
-- AC-SCHEMA-001/002/003: Verify Tables Created
-- ============================================================================
\echo ''
\echo '2. Verifying Table Creation (Expected: 3 tables)'
\echo '-----------------------------------------------------------'

SELECT tablename
FROM pg_tables
WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests')
ORDER BY tablename;

\echo ''
\echo '   Worktree table structure:'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'worktrees'
ORDER BY ordinal_position;

\echo ''
\echo '   TestQueue table structure:'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'test_queue'
ORDER BY ordinal_position;

\echo ''
\echo '   PullRequest table structure:'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pull_requests'
ORDER BY ordinal_position;

-- ============================================================================
-- AC-SCHEMA-005: Verify Story Model Extension
-- ============================================================================
\echo ''
\echo '3. Verifying Story Model Extension'
\echo '-----------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'stories' AND column_name = 'current_phase';

-- ============================================================================
-- AC-MIGRATION-004: Verify Indexes Created
-- ============================================================================
\echo ''
\echo '4. Verifying Index Creation (Expected: 12 indexes + 3 PKs)'
\echo '-----------------------------------------------------------'

\echo '   Worktree indexes:'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'worktrees'
ORDER BY indexname;

\echo ''
\echo '   TestQueue indexes:'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'test_queue'
ORDER BY indexname;

\echo ''
\echo '   PullRequest indexes:'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pull_requests'
ORDER BY indexname;

-- ============================================================================
-- AC-MIGRATION-003: Verify Foreign Key Constraints
-- ============================================================================
\echo ''
\echo '5. Verifying Foreign Key Constraints (Expected: 3 constraints)'
\echo '-----------------------------------------------------------'

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    CASE confdeltype
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'a' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete,
    CASE confupdtype
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'a' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_update
FROM pg_constraint
WHERE conname LIKE '%story_id_fkey%'
AND conrelid::regclass::text IN ('worktrees', 'test_queue', 'pull_requests')
ORDER BY conname;

-- ============================================================================
-- AC-DATA-001: Verify UUID Generation Works
-- ============================================================================
\echo ''
\echo '6. Verifying UUID Auto-Generation'
\echo '-----------------------------------------------------------'

SELECT
    column_name,
    column_default
FROM information_schema.columns
WHERE table_name IN ('worktrees', 'test_queue', 'pull_requests')
AND column_name = 'id';

-- ============================================================================
-- AC-DATA-003: Verify Default Values
-- ============================================================================
\echo ''
\echo '7. Verifying Default Values'
\echo '-----------------------------------------------------------'

\echo '   Worktree defaults:'
SELECT
    column_name,
    column_default
FROM information_schema.columns
WHERE table_name = 'worktrees'
AND column_default IS NOT NULL;

\echo ''
\echo '   TestQueue defaults:'
SELECT
    column_name,
    column_default
FROM information_schema.columns
WHERE table_name = 'test_queue'
AND column_default IS NOT NULL;

\echo ''
\echo '   PullRequest defaults:'
SELECT
    column_name,
    column_default
FROM information_schema.columns
WHERE table_name = 'pull_requests'
AND column_default IS NOT NULL;

-- ============================================================================
-- Edge Case: Verify JSONB Type for test_results
-- ============================================================================
\echo ''
\echo '8. Verifying JSONB Type for test_results'
\echo '-----------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'test_queue'
AND column_name = 'test_results';

-- ============================================================================
-- Performance: Check Index Usage Potential
-- ============================================================================
\echo ''
\echo '9. Index Analysis'
\echo '-----------------------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests')
ORDER BY tablename, indexname;

-- ============================================================================
-- Data Integrity: Count Existing Records
-- ============================================================================
\echo ''
\echo '10. Existing Data Check (Should be 0 for new tables)'
\echo '-----------------------------------------------------------'

SELECT 'worktrees' as table_name, COUNT(*) as record_count FROM worktrees
UNION ALL
SELECT 'test_queue', COUNT(*) FROM test_queue
UNION ALL
SELECT 'pull_requests', COUNT(*) FROM pull_requests;

-- ============================================================================
-- Summary Statistics
-- ============================================================================
\echo ''
\echo '============================================================'
\echo 'VALIDATION SUMMARY'
\echo '============================================================'

\echo ''
\echo 'Enums Created:'
SELECT COUNT(*) as count FROM pg_type WHERE typname IN ('WorktreeStatus', 'QueueStatus', 'PRStatus', 'StoryPhase');

\echo ''
\echo 'Tables Created:'
SELECT COUNT(*) as count FROM pg_tables WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests');

\echo ''
\echo 'Story.currentPhase Field:'
SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'current_phase';

\echo ''
\echo 'Indexes Created:'
SELECT COUNT(*) as count FROM pg_indexes WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests');

\echo ''
\echo 'Foreign Keys Created:'
SELECT COUNT(*) as count FROM pg_constraint
WHERE conname LIKE '%story_id_fkey%'
AND conrelid::regclass::text IN ('worktrees', 'test_queue', 'pull_requests');

\echo ''
\echo '============================================================'
\echo 'VALIDATION COMPLETE'
\echo '============================================================'
