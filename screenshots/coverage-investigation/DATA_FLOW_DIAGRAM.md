# Coverage Data Flow Diagram

## Current Architecture (WITH MISMATCH)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SOURCE OF TRUTH                                   │
│  backend/coverage/coverage-summary.json                              │
│  {                                                                   │
│    "total": {                                                        │
│      "lines": { "pct": 11.88 }  ← CORRECT VALUE                    │
│    },                                                                │
│    "path/to/file1.ts": { "statements": { "pct": 25.5 } },          │
│    "path/to/file2.ts": { "statements": { "pct": 10.2 } },          │
│    ...                                                               │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Analysis Worker reads this
                              ▼
        ┌──────────────────────────────────────────────┐
        │  code-analysis.processor.ts                  │
        │  loadCoverageData()                          │
        │                                              │
        │  Line 940: totalCoverage = 11.88            │
        │  Line 647: coverageToStore = 11.88          │
        └──────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
        ┌────────────────────┐  ┌────────────────────┐
        │ code_metrics_snapshots│  │ code_metrics (per file)│
        │                    │  │                    │
        │ avg_coverage: 11.88│  │ file1: coverage: 25.5│
        │ ✓ CORRECT          │  │ file2: coverage: 10.2│
        │                    │  │ ... (562 files)    │
        └────────────────────┘  └────────────────────┘
                    │                    │
                    │                    │
                    │                    │
        ┌───────────▼─────────┐ ┌────────▼───────────┐
        │ GET /test-summary   │ │ GET /project/{id}  │
        │                     │ │                     │
        │ Reads coverage file │ │ Calculates weighted │
        │ directly            │ │ average from files  │
        │                     │ │                     │
        │ Returns: 11.88%     │ │ Σ(cov×loc)/Σ(loc)  │
        │ ✓ CORRECT           │ │ = 5.02%            │
        │                     │ │ ✗ INCORRECT        │
        └─────────────────────┘ └────────────────────┘
                    │                    │
                    │                    │
                    ▼                    ▼
        ┌─────────────────────────────────────────────┐
        │         FRONTEND DISPLAY                    │
        │                                             │
        │  ┌──────────────────┐  ┌─────────────────┐ │
        │  │ Overview Tab     │  │ Test Coverage   │ │
        │  │                  │  │ Tab             │ │
        │  │ Shows: ~5%       │  │ Shows: 11.88%   │ │
        │  │ ✗ INCORRECT      │  │ ✓ CORRECT       │ │
        │  └──────────────────┘  └─────────────────┘ │
        └─────────────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │  USER SEES CONFLICTING VALUES   │
        │  "Which one is correct??"        │
        └─────────────────────────────────┘
```

---

## Why Weighted Average ≠ Total Coverage

### Example with 3 files:

```
File 1: 100 lines,  50% coverage  →  50 lines covered
File 2: 100 lines,  50% coverage  →  50 lines covered
File 3: 800 lines,   0% coverage  →   0 lines covered
───────────────────────────────────────────────────
Total:  1000 lines, 100 lines covered → 10% actual coverage
```

**Correct Calculation (from coverage-summary.json total):**
```
Total Coverage = 100 covered / 1000 total = 10%  ✓
```

**Incorrect Calculation (LOC-weighted average from files):**
```
Weighted Avg = (50×100 + 50×100 + 0×800) / 1000
             = (5000 + 5000 + 0) / 1000
             = 10000 / 1000
             = 10%  ✓ (works in this example)
```

**BUT in real project:**
```
File 1: coverage = 25.5%, LOC = 150
File 2: coverage = 10.2%, LOC = 200
... (560 more files)

Weighted Avg = Σ(coverage_pct × LOC) / Σ(LOC)
             ≠ Total lines covered / Total lines

Because: coverage_pct is already a percentage, not raw count!
```

**The Issue:**
- Coverage summary stores **percentages** per file
- To calculate total coverage, you need **raw counts** (covered/total)
- Averaging percentages ≠ total percentage

**Correct Formula:**
```
Total Coverage = Σ(lines_covered) / Σ(lines_total)
```

**What we're doing (WRONG):**
```
Weighted Avg = Σ(coverage_pct × LOC) / Σ(LOC)
```

This is mathematically incorrect because you can't average already-calculated percentages!

---

## Proposed Fix Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SOURCE OF TRUTH                                   │
│  backend/coverage/coverage-summary.json                              │
│  { "total": { "lines": { "pct": 11.88 } } }                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │  code-analysis.processor.ts                  │
        │  Stores: 11.88% → code_metrics_snapshots     │
        └──────────────────────────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────────────────────┐
        │ code_metrics_snapshots                             │
        │ avg_coverage: 11.88  ← SINGLE SOURCE OF TRUTH      │
        └────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
        ┌───────────────────┐  ┌────────────────────┐
        │ GET /test-summary │  │ GET /project/{id}  │
        │                   │  │                    │
        │ Reads coverage    │  │ Reads SNAPSHOT     │
        │ file OR snapshot  │  │ (not file-level)   │
        │                   │  │                    │
        │ Returns: 11.88%   │  │ Returns: 11.88%    │
        │ ✓ CORRECT         │  │ ✓ CORRECT (FIXED)  │
        └───────────────────┘  └────────────────────┘
                    │                    │
                    └────────┬───────────┘
                             │
                             ▼
        ┌─────────────────────────────────────────────┐
        │         FRONTEND DISPLAY                    │
        │                                             │
        │  ┌──────────────────┐  ┌─────────────────┐ │
        │  │ Overview Tab     │  │ Test Coverage   │ │
        │  │                  │  │ Tab             │ │
        │  │ Shows: 11.88%    │  │ Shows: 11.88%   │ │
        │  │ ✓ CONSISTENT     │  │ ✓ CONSISTENT    │ │
        │  └──────────────────┘  └─────────────────┘ │
        └─────────────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │  USER SEES CONSISTENT VALUES    │
        │  "Great, 11.88% coverage!"       │
        └─────────────────────────────────┘
```

---

## Code Changes Required

### File: `backend/src/code-metrics/code-metrics.service.ts`

**Before (Lines 68-108):**
```typescript
// Calculate aggregates (using LOC-weighted averages for accuracy)
const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
const weightedCoverage = metrics.reduce((sum, m) =>
  sum + ((m.testCoverage || 0) * m.linesOfCode), 0);
const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
// ... later ...
coverage: Math.round(avgCoverage),  // Returns ~5% ✗
```

**After (Option A - Use Snapshot):**
```typescript
// Get most recent snapshot for accurate coverage
const snapshot = await this.prisma.codeMetricsSnapshot.findFirst({
  where: { projectId },
  orderBy: { snapshotDate: 'desc' },
  select: { avgCoverage: true },
});
const avgCoverage = snapshot?.avgCoverage || 0;

// Calculate other metrics from file-level data
const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
// ... (complexity, maintainability, etc) ...

// ... later ...
coverage: Math.round(avgCoverage),  // Returns 11.88% ✓
```

**After (Option B - Recalculate from Coverage File):**
```typescript
// Get coverage from same source as snapshot (coverage file)
let avgCoverage = 0;
try {
  const testSummary = await this.getTestSummaryFromCoverage(projectId);
  avgCoverage = testSummary.coveragePercentage || 0;
} catch (error) {
  this.logger.warn('Could not load coverage from file, using file-level average');
  const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
  const weightedCoverage = metrics.reduce((sum, m) =>
    sum + ((m.testCoverage || 0) * m.linesOfCode), 0);
  avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
}

// ... later ...
coverage: Math.round(avgCoverage),  // Returns 11.88% ✓
```

**Recommendation:** Option A (use snapshot) is preferred because:
1. Faster (no file I/O)
2. Consistent with other dashboard data
3. Already validated during snapshot creation
4. Handles missing coverage file gracefully

---

## Impact Analysis

### What Changes
- ✓ Overview tab coverage value
- ✓ API response from `/project/{id}`
- ✓ Trend calculations (if based on this value)

### What Stays the Same
- ✓ Test Coverage tab (already correct)
- ✓ Snapshot creation (already correct)
- ✓ File-level metrics (not used for totals)
- ✓ Coverage file parsing (already correct)

### Performance Impact
- **Improvement:** Snapshot query is faster than file-level aggregation
- **Before:** Aggregates 562 file records
- **After:** Single snapshot lookup

### Data Migration
- **Not Required:** Snapshots already have correct values
- **Backwards Compatible:** Old snapshots have correct coverage too

---

## Testing Strategy

### Unit Tests
```typescript
describe('getProjectMetrics - Coverage Calculation', () => {
  it('should return coverage from snapshot, not file-level average', async () => {
    // Setup: Create snapshot with 11.88% coverage
    await prisma.codeMetricsSnapshot.create({
      data: { projectId, avgCoverage: 11.88, /* ... */ }
    });

    // Setup: Create files with different coverage (averaging to ~5%)
    await prisma.codeMetrics.createMany({
      data: [
        { projectId, filePath: 'f1', testCoverage: 4.0, linesOfCode: 500 },
        { projectId, filePath: 'f2', testCoverage: 5.5, linesOfCode: 500 },
      ]
    });

    const result = await service.getProjectMetrics(projectId, {});

    // Should return snapshot value, not file-level average
    expect(result.healthScore.coverage).toBe(12); // Rounded 11.88
  });
});
```

### Integration Tests
```typescript
describe('Coverage Consistency', () => {
  it('should show same coverage in all endpoints', async () => {
    const projectMetrics = await request(app)
      .get(`/code-metrics/project/${projectId}`)
      .expect(200);

    const testSummary = await request(app)
      .get(`/code-metrics/project/${projectId}/test-summary`)
      .expect(200);

    expect(projectMetrics.body.healthScore.coverage)
      .toBeCloseTo(testSummary.body.coveragePercentage, 0);
  });
});
```

### E2E Tests
```typescript
test('Overview and Test Coverage tabs show same percentage', async ({ page }) => {
  await page.goto(`/projects/${projectId}/code-quality`);

  // Get Overview tab coverage
  const overviewCoverage = await page.locator('[data-testid="overview-coverage"]')
    .textContent();

  // Navigate to Test Coverage tab
  await page.click('text=Test Coverage');

  // Get Test Coverage tab coverage
  const testCoverage = await page.locator('[data-testid="test-coverage-pct"]')
    .textContent();

  expect(overviewCoverage).toBe(testCoverage);
});
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Author:** Coverage Investigation System
