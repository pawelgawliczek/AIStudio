# Story: Unify Coverage Data Sources for Code Quality Dashboard

**Epic:** EP-2 (Code Quality Dashboard)
**Priority:** High
**Estimated Effort:** 8 hours
**Created:** 2025-11-23
**Status:** Draft

## Problem Statement

The Code Quality Dashboard currently pulls coverage data from multiple sources, leading to inconsistent values displayed to users:

### Current Inconsistency
1. **Test Summary endpoint** (`/api/code-metrics/project/:id/test-summary`)
   - Data Source: Reads directly from `coverage/coverage-summary.json` file
   - Value Shown: **23.61%** ✅ (correct, real-time)

2. **Main Project endpoint** (`/api/code-metrics/project/:id`)
   - Data Source: Reads from `CodeMetricsSnapshot` database table
   - Value Shown: **12%** ❌ (outdated, cached)

### User Impact
- Users see **different coverage percentages** in different sections of the same dashboard
- Health Score tile shows 12% while Test Coverage section shows 23.61%
- Causes confusion and distrust in metrics accuracy
- Requires manual code analysis trigger to sync data

## Acceptance Criteria

- [ ] All coverage data on the Code Quality Dashboard pulls from a **single, consistent source**
- [ ] Coverage percentage is identical across all dashboard sections:
  - Health score tile
  - Test coverage section
  - Comparison/delta charts
  - Recent analyses list
  - Any other coverage displays
- [ ] Coverage data is always up-to-date when viewing the dashboard (no stale cached data)
- [ ] Performance is maintained (no significant slowdown from reading files vs database)
- [ ] Backend API endpoints return consistent coverage values
- [ ] Frontend components use a single data source/service for coverage information
- [ ] No manual intervention required to sync coverage data
- [ ] Documentation updated to reflect unified data flow

## Proposed Solutions

### Option 1: CodeMetricsSnapshot as Single Source of Truth
**Approach:** Update snapshot automatically whenever coverage files change

**Implementation:**
- Add file watcher or post-test hook to detect coverage file changes
- Automatically trigger snapshot update when coverage files modified
- All endpoints read from CodeMetricsSnapshot table
- Remove direct file reading from endpoints

**Pros:**
- Fast database queries (indexed, optimized)
- Built-in historical tracking for trends
- Consistent data across all endpoints

**Cons:**
- Requires keeping snapshot in sync with coverage files
- Potential for sync failures
- Additional complexity in file monitoring

### Option 2: Coverage Files as Single Source of Truth
**Approach:** All endpoints read directly from coverage files

**Implementation:**
- Modify main project endpoint to read from coverage file
- Update `getProjectHealthMetrics()` to call `getTestSummaryFromCoverage()`
- CodeMetricsSnapshot stores historical copy but is not authoritative
- Remove coverage field from snapshot-based responses

**Pros:**
- Always shows real-time coverage (source of truth)
- No sync issues between file and database
- Simpler data flow (one direction)

**Cons:**
- File I/O on every request (slower than database)
- No automatic historical data for trends
- Requires file system access from container

### Option 3: Hybrid Approach with Smart Caching (✅ Recommended)
**Approach:** File is authoritative, snapshot is cached with timestamp validation

**Implementation:**
1. Primary source: Coverage file (real-time, authoritative)
2. Snapshot table: Cached copy with timestamp
3. On each request:
   ```typescript
   if (coverageFile.mtime > snapshot.lastUpdate) {
     // File is newer - read from file and update snapshot
     coverage = readFromFile();
     updateSnapshot(coverage);
   } else {
     // Snapshot is current - use cached value
     coverage = snapshot.avgCoverage;
   }
   ```
4. Frontend uses single service to fetch coverage (no direct file reads)

**Pros:**
- Real-time accuracy (always shows latest)
- Performance optimization (database cache)
- Historical tracking (snapshot history)
- Self-healing (auto-updates when out of sync)

**Cons:**
- Slightly more complex logic
- Need to handle file timestamp edge cases

## Technical Implementation Tasks

### Backend Changes
- [ ] Create `getCoverageWithCache()` method in CodeMetricsService
- [ ] Update `getProjectHealthMetrics()` to use unified coverage method
- [ ] Modify `getTestSummaryFromCoverage()` to update snapshot as side effect
- [ ] Add timestamp comparison logic for cache validation
- [ ] Update all endpoints that return coverage data:
  - [ ] `/api/code-metrics/project/:id` (main project)
  - [ ] `/api/code-metrics/project/:id/test-summary`
  - [ ] `/api/code-metrics/project/:id/comparison`
  - [ ] Any other coverage-returning endpoints
- [ ] Add service method tests for coverage consistency
- [ ] Update API response DTOs if needed

### Frontend Changes
- [ ] Audit all components that display coverage:
  - [ ] Health score tile
  - [ ] Test coverage section
  - [ ] Coverage trend charts
  - [ ] Recent analyses cards
  - [ ] Any other coverage displays
- [ ] Create unified `useCoverage()` hook or service
- [ ] Update all components to use single data source
- [ ] Remove duplicate API calls
- [ ] Add loading states and error handling
- [ ] Test coverage consistency across dashboard

### Testing
- [ ] Unit tests: Coverage retrieval logic
- [ ] Integration tests: API endpoint consistency
- [ ] E2E tests: Dashboard displays same value everywhere
- [ ] Performance tests: Response time comparison
- [ ] Edge case tests: Missing files, corrupt data, etc.

### Documentation
- [ ] Update API documentation with unified coverage flow
- [ ] Document coverage data architecture
- [ ] Add troubleshooting guide for coverage sync issues
- [ ] Update CODE_QUALITY_DASHBOARD_STATUS.md

## Related Files

**Backend:**
- `/backend/src/code-metrics/code-metrics.service.ts` - Main service (lines 957-1038 for test-summary, needs main project update)
- `/backend/src/code-metrics/code-metrics.controller.ts` - API endpoints
- `/backend/src/workers/processors/code-analysis.processor.ts` - Analysis worker (lines 914-930)

**Frontend:**
- `/frontend/src/pages/CodeQualityDashboard.tsx` - Main dashboard component
- `/frontend/src/components/CodeQuality/*.tsx` - Coverage display components
- `/frontend/src/hooks/useCodeQualityMetrics.ts` - Data fetching hook

**Coverage System:**
- `/scripts/merge-coverage.ts` - Unified coverage generation
- `/frontend/scripts/generate-coverage-summary.cjs` - V8 format converter
- `/coverage/coverage-summary.json` - Unified coverage file (23.61%)

## Current State (Post ST-83)

**Unified Coverage System:** ✅ Implemented
- Backend coverage: 11.88% (Jest)
- Frontend coverage: 28.00% (Vitest)
- Unified coverage: **23.61%** (merged)
- Coverage file: `/coverage/coverage-summary.json`

**Discovered Issue:**
- Dashboard health score tile: **12%** (from CodeMetricsSnapshot)
- Dashboard test summary: **23.61%** (from coverage file)
- **Gap:** 11.61 percentage points difference

**Root Cause:**
- CodeMetricsSnapshot not updated after unified coverage generation
- Requires manual code analysis trigger to sync
- Main project endpoint reads from outdated snapshot

## Dependencies

- ST-83: Comprehensive Test Coverage (✅ Completed)
- Unified coverage system must be in place
- Docker container must have access to coverage files

## Success Metrics

- Coverage percentage **identical** across all dashboard sections
- Zero manual interventions needed for coverage sync
- Response time < 500ms for coverage queries
- 100% test coverage for new unified coverage logic
- Zero regression in existing dashboard functionality

## Notes

- This issue was discovered during ST-83 testing (2025-11-23)
- Current workaround: Trigger code analysis to update snapshot
- Permanent solution: Implement unified data source as described above
- Consider adding webhook/event when coverage files change

## Recommended Approach

Implement **Option 3 (Hybrid)** for best balance of:
- Real-time accuracy
- Performance
- Historical tracking
- Automatic sync

Start with backend changes, then update frontend to use consistent API.
