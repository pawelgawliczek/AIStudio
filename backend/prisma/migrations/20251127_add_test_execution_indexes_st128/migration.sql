-- ST-128: Add indexes for test execution queries
-- These indexes improve performance for filtering and sorting test executions

-- Add composite index for project-level queries with date filtering
-- Used by: TestExecutionHistoryPage filters, TestAnalyticsService queries
CREATE INDEX IF NOT EXISTS idx_test_executions_project_date
  ON test_executions(test_case_id, executed_at DESC);

-- Add composite index for status filtering with date sorting
-- Used by: Status filter in TestExecutionHistoryPage
CREATE INDEX IF NOT EXISTS idx_test_executions_status
  ON test_executions(status, executed_at DESC);

-- Add composite index for test case queries
-- Used by: TestCaseCoverageDashboard, test case analytics
CREATE INDEX IF NOT EXISTS idx_test_cases_project_use_case
  ON test_cases(project_id, use_case_id);

-- Add composite index for filtering by project, status, and date
-- Used by: Complex filters in TestExecutionHistoryPage
CREATE INDEX IF NOT EXISTS idx_test_executions_filters
  ON test_executions(test_case_id, status, executed_at DESC);

-- Note: Some indexes already exist in the schema:
-- - idx_test_executions_test_case_id_executed_at (via @@index([testCaseId, executedAt]))
-- - idx_test_executions_story_id (via @@index([storyId]))
-- - idx_test_executions_commit_hash (via @@index([commitHash]))
-- - idx_test_executions_status (via @@index([status]))
-- The indexes above complement these existing indexes for better query performance.
