# Quick Reference: Coverage Investigation Results

## TL;DR

**Problem:** Dashboard shows 5% in Overview tab, 11.88% in Test Coverage tab
**Root Cause:** getProjectMetrics() calculates weighted average from file-level data instead of using snapshot
**Solution:** Use snapshot value (11.88%) in getProjectMetrics()
**Impact:** HIGH (incorrect data shown to users)
**Effort:** 6-10 hours
**Risk:** LOW

---

## The Numbers

| Metric | Value | Source |
|--------|-------|--------|
| **CORRECT Coverage** | **11.88%** | coverage-summary.json total.lines.pct |
| Snapshot (database) | 11.88% | code_metrics_snapshots.avg_coverage |
| Test Summary API | 11.88% | GET /test-summary |
| Test Coverage Tab | 11.88% | Frontend (correct) |
| **WRONG Coverage** | **~5%** | Calculated from file-level data |
| Project Metrics API | ~5% | GET /project/{id} |
| Overview Tab | ~5% | Frontend (wrong) |
| **Discrepancy** | **6.88 pp** | 136% error |

---

## What's Wrong

```typescript
// backend/src/code-metrics/code-metrics.service.ts:72-76
const weightedCoverage = metrics.reduce((sum, m) =>
  sum + ((m.testCoverage || 0) * m.linesOfCode), 0);
const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
// ↑ This averages PERCENTAGES - mathematically incorrect!
// Returns: ~5% ✗
```

---

## The Fix

```typescript
// backend/src/code-metrics/code-metrics.service.ts:72-76
// Add this BEFORE the existing calculations:
const snapshot = await this.prisma.codeMetricsSnapshot.findFirst({
  where: { projectId },
  orderBy: { snapshotDate: 'desc' },
  select: { avgCoverage: true },
});
const avgCoverage = snapshot?.avgCoverage || 0;
// Returns: 11.88% ✓
```

---

## File Locations

### Backend
- **Bug:** `backend/src/code-metrics/code-metrics.service.ts:72-76,108`
- **Coverage file:** `backend/coverage/coverage-summary.json`
- **Database table:** `code_metrics_snapshots`

### Frontend
- **Wrong display:** `frontend/src/pages/CodeQualityDashboard.tsx:201,399` (Overview tab)
- **Correct display:** `frontend/src/pages/CodeQualityDashboard.tsx:941-943` (Test Coverage tab)

### Tests (to add)
- `backend/src/code-metrics/__tests__/coverage-consistency.test.ts`
- `e2e/coverage-consistency.spec.ts`

---

## Database Queries

### Verify Snapshot Value
```sql
SELECT avg_coverage, snapshot_date
FROM code_metrics_snapshots
WHERE project_id = '345a29ee-d6ab-477d-8079-c5dda0844d77'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 11.88
```

### Compare Calculations
```sql
WITH snapshot AS (
  SELECT avg_coverage FROM code_metrics_snapshots
  WHERE project_id = '345a29ee-d6ab-477d-8079-c5dda0844d77'
  ORDER BY created_at DESC LIMIT 1
),
weighted AS (
  SELECT SUM(test_coverage * lines_of_code) / SUM(lines_of_code) as avg
  FROM code_metrics
  WHERE project_id = '345a29ee-d6ab-477d-8079-c5dda0844d77'
)
SELECT
  snapshot.avg_coverage as correct,
  weighted.avg as wrong,
  snapshot.avg_coverage - weighted.avg as difference
FROM snapshot, weighted;
-- Expected: correct=11.88, wrong=5.02, difference=6.86
```

---

## API Endpoints

### Wrong Endpoint
```bash
curl http://localhost:3000/api/code-metrics/project/345a29ee-d6ab-477d-8079-c5dda0844d77
# Response: { "healthScore": { "coverage": 5 } }  ✗ WRONG
```

### Correct Endpoint
```bash
curl http://localhost:3000/api/code-metrics/project/345a29ee-d6ab-477d-8079-c5dda0844d77/test-summary
# Response: { "coveragePercentage": 11.88 }  ✓ CORRECT
```

---

## Math Explained

### Why You Can't Average Percentages

**Coverage File Data:**
```
Total Lines: 10,782
Covered Lines: 1,281
Coverage: 1,281 / 10,782 = 11.88%  ✓ CORRECT
```

**File-Level Data (562 files):**
```
File 1: 100 lines, 25% coverage
File 2: 200 lines, 10% coverage
...
File 562: 50 lines, 0% coverage

Weighted Avg = Σ(coverage% × LOC) / Σ(LOC)
             = (25×100 + 10×200 + ... + 0×50) / 97,527
             = 489,488.79 / 97,527
             = 5.02%  ✗ WRONG
```

**Why Different?**
- Coverage% is already calculated per-file
- Averaging percentages ≠ total percentage
- Need raw counts (covered/total), not percentages

**Correct Formula:**
```
Total Coverage = Σ(lines_covered) / Σ(lines_total)
```

**Wrong Formula (current code):**
```
Weighted Avg = Σ(coverage% × LOC) / Σ(LOC)
```

---

## Testing Checklist

### Pre-Deployment
- [ ] Unit test: Coverage from snapshot
- [ ] Unit test: Consistency between APIs
- [ ] Integration test: API returns correct value
- [ ] E2E test: Frontend displays 11.88%
- [ ] Manual test: Check all tabs match

### Post-Deployment
- [ ] Verify Overview tab: ~12% (rounded)
- [ ] Verify Test Coverage tab: 11.88%
- [ ] Check API response: 11.88%
- [ ] Monitor error logs
- [ ] User feedback: No confusion

---

## Deployment Plan

1. **Stage 1: Unit Tests** (1 hour)
   - Add coverage consistency tests
   - Verify tests fail with current code

2. **Stage 2: Fix Implementation** (2 hours)
   - Modify getProjectMetrics()
   - Verify tests pass

3. **Stage 3: Integration Tests** (2 hours)
   - Add E2E coverage tests
   - Test API endpoints

4. **Stage 4: Code Review** (1 hour)
   - Peer review
   - Approval

5. **Stage 5: Staging Deployment** (1 hour)
   - Deploy to staging
   - Manual verification

6. **Stage 6: Production Deployment** (1 hour)
   - Deploy to production
   - Monitor metrics

---

## Rollback Plan

**If issues occur:**

1. **Immediate:** Revert commit
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Verify:** Check Overview tab shows previous value

3. **Investigate:** Review error logs

4. **Fix:** Address issue in new PR

**Note:** Safe to rollback - no database changes required

---

## Communication Templates

### For Users
```
We fixed a display bug in the Code Quality Dashboard.
The Overview tab was showing 5% coverage due to a calculation error.
The correct value is 11.88%, which was already shown in the Test Coverage tab.
All tabs now show the accurate coverage percentage.
```

### For Developers
```
Fixed getProjectMetrics() to use snapshot value instead of recalculating
from file-level data. This resolves the coverage mismatch between Overview
tab (was showing ~5%) and Test Coverage tab (showing correct 11.88%).

Change: Query code_metrics_snapshots instead of aggregating code_metrics
Reason: Averaging percentages ≠ total percentage (mathematical error)
Impact: Overview tab now shows correct coverage
Risk: Low (isolated change, snapshot already correct)
```

### For QA Team
```
Test Plan:
1. Navigate to Overview tab → Expect ~12% coverage
2. Navigate to Test Coverage tab → Expect 11.88% coverage
3. Verify both values match (±1% for rounding)
4. Check trend chart shows consistent values
5. Verify API returns 11.88% (not ~5%)
```

---

## Related Issues

- **ST-37**: Code Quality Dashboard data accuracy (parent)
- **ST-37 Issue #1**: Test metrics hardcoded (FIXED)
- **ST-37 Issue #2**: Fake commit hashes (FIXED)
- **ST-37 Issue #3**: Coverage mismatch (THIS ISSUE)

---

## Investigation Files

All investigation artifacts stored in:
```
/opt/stack/AIStudio/screenshots/coverage-investigation/
├── COVERAGE_INVESTIGATION_REPORT.md (full analysis)
├── DATA_FLOW_DIAGRAM.md (architecture diagrams)
├── EXECUTIVE_SUMMARY.md (stakeholder summary)
├── QUICK_REFERENCE.md (this file)
└── coverage-report.json (raw test data)
```

---

**Investigation Complete:** ✓
**Root Cause Identified:** ✓
**Fix Proposed:** ✓
**Testing Plan:** ✓
**Ready to Implement:** ✓

---

**Last Updated:** 2025-11-19 09:00 UTC
**Version:** 1.0
**Status:** READY FOR IMPLEMENTATION
