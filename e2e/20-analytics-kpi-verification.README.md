# Analytics KPI Verification Test Suite (ST-263)

## Quick Start

```bash
# Run all analytics KPI tests
npx playwright test e2e/20-analytics-kpi-verification.spec.ts

# Run with UI mode for debugging
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --ui

# Run specific test
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "token usage"
```

## What This Tests

This test suite verifies that KPIs (Key Performance Indicators) displayed on analytics pages **exactly match** the values stored in the database and returned by the API.

### Pages Tested

1. **Workflow Monitor** (`/team-runs/{runId}/monitor`)
   - Token usage (total, input, output, cache)
   - Efficiency metrics (tokens/LOC, cost)
   - Code impact (lines added/modified/deleted)
   - Execution metrics (agents, prompts, iterations)

2. **Performance Dashboard** (`/analytics/performance`)
   - Story counts per workflow
   - Verifies ALL stories are shown (not capped at 1)

3. **Team Details** (`/analytics/team-details`)
   - Aggregated workflow KPIs (placeholder for now)

## Prerequisites

### 1. Running Services
```bash
# Backend must be running
cd backend && npm run start:dev  # Port 3001

# Frontend must be running
cd frontend && npm run dev  # Port 5174
```

### 2. Test Data
You need at least one completed workflow run with metrics:
- Total tokens > 0
- Some code changes (lines added/modified/deleted)
- At least 1 completed component

To create test data:
1. Run a workflow to completion through the UI, OR
2. Use the API to create a workflow run

### 3. Test User
The tests use `admin@aistudio.local` / `admin123` credentials (defined in `e2e/utils/auth.helper.ts`).

Make sure this user exists in your test database.

## Running Tests

### All Tests
```bash
npx playwright test e2e/20-analytics-kpi-verification.spec.ts
```

### By Page
```bash
# Workflow Monitor tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Workflow Monitor"

# Performance Dashboard tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Performance Dashboard"

# Team Details tests only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "Team Details"
```

### By Metric Type
```bash
# Token metrics only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "token usage"

# Cost metrics only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "efficiency"

# Code impact only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "code impact"

# Execution metrics only
npx playwright test e2e/20-analytics-kpi-verification.spec.ts -g "execution metrics"
```

### Debug Mode
```bash
# Open Playwright inspector
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --debug

# Show browser (headed mode)
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --headed

# Both debug and headed
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --debug --headed
```

### Verbose Output
```bash
# Show all console logs and API calls
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --reporter=list

# Show full traces
npx playwright test e2e/20-analytics-kpi-verification.spec.ts --trace=on
```

## Understanding Test Results

### Success
```
✓ should display accurate token usage metrics (5s)
✓ should display accurate efficiency & cost metrics (4s)
✓ should display accurate code impact metrics (3s)
✓ should display accurate execution metrics (3s)
```

All KPIs match between UI and API.

### Failure Examples

**Metric Mismatch**
```
Error: KPI "Total Tokens" mismatch: displayed 150000, expected 148523
```
**Cause**: Frontend is showing stale data or calculation is wrong.

**Element Not Found**
```
Error: Timeout waiting for selector "text=Total Tokens"
```
**Cause**: Page structure changed or KPI label changed.

**Tolerance Exceeded**
```
Error: KPI "Tokens/LOC" mismatch: displayed 42.5, expected 40.0 (tolerance: ±2%)
```
**Cause**: Calculated value differs by more than allowed tolerance.

## Test Architecture

### Helper Functions
All test helpers are in `/e2e/utils/kpi.helper.ts`:

```typescript
// Extract metrics from page
const tokenMetrics = await extractTokenMetrics(page);
const efficiencyMetrics = await extractEfficiencyMetrics(page);
const codeMetrics = await extractCodeImpactMetrics(page);
const executionMetrics = await extractExecutionMetrics(page);

// Assert KPI matches expected value
assertKPI({
  label: 'Total Tokens',
  displayed: tokenMetrics.totalTokens,
  expected: apiMetrics.totalTokens,
  tolerance: 1, // Optional: allow 1% difference
});
```

### Test Flow
```
1. beforeAll: Find a completed workflow run with metrics
2. Test: Navigate to analytics page
3. Test: Extract displayed KPI values using helpers
4. Test: Fetch expected values from API
5. Test: Compare displayed vs expected using assertKPI()
6. Report: Pass/Fail with detailed error messages
```

## Troubleshooting

### No Completed Workflow Runs
**Error**: `No completed workflow runs found`

**Solution**:
1. Run a workflow to completion through the UI, OR
2. Use the backend API:
```bash
curl -X POST http://localhost:3001/api/projects/{projectId}/workflow-runs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"workflowId": "...", "status": "completed", ...}'
```

### Test User Doesn't Exist
**Error**: `Login failed: 401 Unauthorized`

**Solution**:
```bash
# Seed test users
cd backend
npm run seed:test-users
```

### Page Not Loading
**Error**: `Navigation timeout of 30000ms exceeded`

**Solution**:
1. Check frontend is running: `curl http://localhost:5174`
2. Check backend is running: `curl http://localhost:3001/health`
3. Check no CORS errors in browser console

### Metric Mismatch (Consistently Off)
**Possible Causes**:
1. **Frontend caching**: Clear browser cache or use `?nocache=1`
2. **Stale aggregations**: Re-run metric calculation job
3. **Rounding differences**: Increase tolerance in test
4. **Bug in calculation**: Debug backend metric service

### Flaky Tests
**Symptoms**: Tests pass sometimes, fail sometimes

**Common Causes**:
1. **Race condition**: Increase wait timeouts
2. **Async data loading**: Add explicit waits for data
3. **Concurrent test runs**: Ensure tests run sequentially
4. **Shared test data**: Use isolated test data per test

## Advanced Usage

### Custom Test Data
```typescript
// In your test file
test.beforeAll(async ({ request }) => {
  // Create custom workflow run with specific metrics
  const customRun = await api.post('/workflow-runs', {
    totalTokens: 100000,
    totalCost: 0.5,
    // ... other metrics
  });

  completedRunId = customRun.data.id;
});
```

### Testing Edge Cases
```typescript
// Test with zero metrics
completedRunMetrics.metrics.totalTokens = 0;
// Should display "N/A" or "0"

// Test with null metrics
completedRunMetrics.metrics.totalCost = null;
// Should display "N/A"

// Test with very large numbers
completedRunMetrics.metrics.totalTokens = 999999999;
// Should display "999,999,999"
```

### Adding New KPI Tests
1. Add interface to `WorkflowRunMetrics` type
2. Add extraction logic to helper (e.g., `extractNewMetric()`)
3. Add test case:
```typescript
test('should display accurate new metric', async ({ page }) => {
  await page.goto(`/team-runs/${completedRunId}/monitor`);
  const displayed = await extractNewMetric(page);
  assertKPI({
    label: 'New Metric',
    displayed: displayed.value,
    expected: apiMetrics.newMetric,
  });
});
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Analytics KPI Tests
  run: npx playwright test e2e/20-analytics-kpi-verification.spec.ts

- name: Upload Test Results
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### Pre-Merge Checks
These tests should run:
- Before merging analytics-related PRs
- After database schema changes
- After backend metric calculation changes
- As part of nightly regression suite

## Maintenance

### When UI Changes
Update selectors in helper functions:
```typescript
// Old
await page.locator('text=Total Tokens').locator('..').locator('h5')

// New (if using data-testid)
await page.locator('[data-testid="total-tokens-value"]')
```

### When Adding New Pages
1. Create new test describe block
2. Add page-specific helper functions
3. Document new tests in COVERAGE.md

### When KPI Calculations Change
1. Review tolerance values (may need adjustment)
2. Update expected value extraction from API
3. Add comments explaining calculation logic

## Resources

- **Test Coverage**: See `20-analytics-kpi-verification.COVERAGE.md`
- **Helper Functions**: See `utils/kpi.helper.ts`
- **Playwright Docs**: https://playwright.dev
- **Test Strategy**: See test comments in spec file

## Support

For questions or issues:
1. Check this README
2. Check COVERAGE.md for detailed test breakdown
3. Check helper function JSDoc comments
4. Run tests in debug mode to inspect failures
5. Ask the team in #testing-help channel
