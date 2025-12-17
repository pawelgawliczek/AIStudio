# Analytics KPI Verification E2E Test Suite (ST-263)

## Overview

This test suite verifies that KPIs displayed on analytics pages match actual database/API values. It ensures data integrity and accuracy across the analytics features.

## Test Coverage

### 1. Workflow Monitor Page (`/team-runs/{runId}/monitor`)

**Test: Token Usage Metrics**
- ✅ Total Tokens
- ✅ Input Tokens
- ✅ Output Tokens
- ✅ Cache Creation Tokens
- ✅ Cache Read Tokens

**Test: Efficiency & Cost Metrics**
- ✅ Tokens per LOC (with 2% tolerance for calculated values)
- ✅ Total Cost (with 1% tolerance)
- ✅ Cost per LOC (with 2% tolerance)
- ✅ Duration (with 1 second tolerance for rounding)

**Test: Code Impact Metrics**
- ✅ Lines Added
- ✅ Lines Modified
- ✅ Lines Deleted
- ✅ LOC Generated
- ✅ Tests Added

**Test: Execution Metrics**
- ✅ Components Completed / Total (Agents)
- ✅ Human Prompts
- ✅ Iterations
- ✅ Interventions

### 2. Performance Dashboard (`/analytics/performance`)

**Test: Story Counts per Workflow**
- ✅ Verifies each workflow shows correct story count
- ✅ Verifies each workflow shows correct bugs count
- ✅ Verifies total story counts match API
- ✅ Specifically tests that workflows with multiple stories show ALL stories (not capped at 1)

### 3. Team Details Page (`/analytics/team-details`)

**Test: Aggregated KPIs**
- ⚠️ Placeholder test - needs expansion based on actual page structure
- Currently verifies page loads and data is available
- TODO: Add specific KPI assertions once page structure is confirmed

## Test Strategy

### 1. Data Source
- Tests use **real completed workflow runs** from the database
- No hardcoded test data or mocked runs
- Finds runs with non-zero metrics automatically

### 2. Comparison Approach
- Fetches data from API endpoints directly
- Extracts displayed values from UI
- Compares API values with displayed values
- Uses tolerance for calculated averages (±1% to ±2%)

### 3. API Endpoints Used
- `GET /projects/{projectId}/workflow-runs?status=completed` - Find completed runs
- `GET /projects/{projectId}/workflow-runs/{runId}/status` - Individual run metrics
- `GET /agent-metrics/performance-dashboard?projectId={projectId}` - Performance dashboard data
- `GET /agent-metrics/workflow-details?projectId={projectId}&workflowAId={workflowId}` - Team details data

### 4. Value Extraction Helpers

**`extractNumber(text: string): number | null`**
- Handles "N/A", empty strings, formatted numbers (e.g., "1,234")
- Removes currency symbols and commas
- Returns null for non-numeric values

**`extractDuration(text: string): number | null`**
- Parses duration strings like "5m 30s" or "45s"
- Returns duration in seconds
- Handles "N/A" gracefully

**`compareWithTolerance(actual, expected, tolerancePercent): boolean`**
- Compares numbers with percentage-based tolerance
- Used for calculated values that may have rounding differences
- Handles null values appropriately

## Running the Tests

### Prerequisites
1. Backend must be running on port 3001
2. Frontend must be running on port 5174
3. Database must have at least one completed workflow run with metrics

### Run All Tests
```bash
npx playwright test e2e/20-analytics-kpi-verification.spec.ts
```

### Run Specific Test Suite
```bash
# Workflow Monitor tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Workflow Monitor"

# Performance Dashboard tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Performance Dashboard"

# Team Details tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Team Details"
```

### Run in Headed Mode (for debugging)
```bash
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --headed
```

### Debug Mode
```bash
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --debug
```

## Test Data Requirements

### Minimum Requirements
- At least 1 project
- At least 1 completed workflow run with:
  - Total tokens > 0
  - At least some code changes (lines added/modified/deleted)
  - Preferably with cache metrics
  - At least 1 completed component

### Ideal Test Data
- Multiple completed workflow runs
- Various workflows with different story counts
- Workflows with diverse metrics (high/low tokens, costs, etc.)
- Workflows with multiple stories (to test the "show ALL stories" requirement)

## Known Limitations & Future Improvements

### Current Limitations
1. **Team Details Page**: Test is placeholder - needs expansion once page structure is finalized
2. **N/A Handling**: Some metrics may show "N/A" instead of "0" - test handles both
3. **Rounding**: Calculated values may differ slightly due to rounding - tests use tolerance

### Future Improvements
1. Add visual regression testing for KPI cards
2. Add tests for KPI change indicators (e.g., "+5%" trends)
3. Add tests for date range filtering on Performance Dashboard
4. Add tests for workflow filtering
5. Add tests for complexity filtering (business/technical)
6. Expand Team Details page tests with specific KPI assertions
7. Add tests for chart data accuracy (trend lines match KPIs)

## Troubleshooting

### Test Fails: "No completed workflow runs found"
**Solution**: Run at least one workflow to completion before running tests.

### Test Fails: Metric mismatch
**Possible Causes**:
1. **Cache issue**: Frontend may be showing stale data - check if refetch is working
2. **Calculation difference**: Backend may use different rounding - check tolerance values
3. **Data inconsistency**: Database may have stale aggregations - verify DB queries
4. **UI extraction issue**: Selector may not be finding the correct element - check HTML structure

### Test Fails: Element not found
**Possible Causes**:
1. **Timing issue**: Page may not be fully loaded - increase timeout
2. **Selector change**: UI structure may have changed - update selectors
3. **Conditional rendering**: Element may be hidden for certain data - check display logic

## Integration with CI/CD

These tests should run:
- ✅ Before merging PRs that touch analytics pages
- ✅ After database migrations
- ✅ As part of nightly regression suite
- ✅ After backend metric calculation changes

## Related Stories
- **ST-263**: Write E2E Tests for Analytics KPI Verification (this test suite)
- **ST-27**: Token Breakdown (Input/Output/Cache metrics)
- **ST-234**: Cache Metrics Restoration
- **ST-147**: Session Telemetry KPIs

## Maintenance Notes

### Updating Tests
When adding new KPIs to analytics pages:
1. Add interface definition to `WorkflowRunMetrics` type
2. Add API endpoint call to fetch the new metric
3. Add UI extraction logic with helper function
4. Add comparison assertion with appropriate tolerance
5. Document the new KPI in this coverage file

### Selectors
Current selectors use `text=` locators (e.g., `text=Total Tokens`).
If UI text changes, update selectors accordingly.
Consider adding `data-testid` attributes for more stable selectors.
