# Executive Summary: Coverage Percentage Investigation
## Code Quality Dashboard - ST-37

**Date:** November 19, 2025
**Investigator:** Automated Coverage Analysis System
**Project:** AIStudio (Vibe Studio)
**Project ID:** 345a29ee-d6ab-477d-8079-c5dda0844d77

---

## The Problem

Users see **different coverage percentages** in different parts of the Code Quality Dashboard:
- **Overview Tab:** ~5%
- **Test Coverage Tab:** 11.88%

This creates confusion and erodes trust in the data.

---

## What We Found

### Database Values (Source of Truth)

**Most Recent Snapshot:**
```
Snapshot Date: 2025-11-19 06:33:02 UTC
Average Coverage: 11.88%
Total Files: 562
```

**Coverage File (backend/coverage/coverage-summary.json):**
```json
{
  "total": {
    "lines": {
      "total": 10,782,
      "covered": 1,281,
      "pct": 11.88
    }
  }
}
```

**Calculation:** 1,281 / 10,782 = **11.88%** ✓ This is CORRECT

### File-Level Metrics (Database)

**Query Result:**
```
Total Files: 562
Total LOC: 97,527
Weighted Average Coverage: 5.02%
Simple Average Coverage: 4.27%
```

**Why Different?**
- File-level coverage values are **percentages** (not raw counts)
- Averaging percentages ≠ total percentage
- Mathematical error in aggregation logic

---

## The Bug

### Current Implementation (WRONG)

**File:** `backend/src/code-metrics/code-metrics.service.ts`
**Lines:** 68-76, 108

```typescript
// Calculates LOC-weighted average from file-level percentages
const weightedCoverage = metrics.reduce((sum, m) =>
  sum + ((m.testCoverage || 0) * m.linesOfCode), 0);
const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;

// Later returns:
coverage: Math.round(avgCoverage)  // Returns ~5% ✗ WRONG
```

**Problem:** You cannot average percentages! This gives incorrect result.

### Correct Implementation (used in test-summary)

**File:** `backend/src/code-metrics/code-metrics.service.ts`
**Lines:** 951-1032

```typescript
// Reads coverage-summary.json directly
const coveragePercentage = coverage.total?.lines?.pct || 0;
return { coveragePercentage };  // Returns 11.88% ✓ CORRECT
```

---

## Evidence

### Layer 1: Database
```sql
-- Snapshot table has correct value
SELECT avg_coverage FROM code_metrics_snapshots
WHERE project_id = '...'
ORDER BY created_at DESC LIMIT 1;
→ Result: 11.88%
```

### Layer 2: API Endpoints

**GET /api/code-metrics/project/{id}**
```json
{
  "healthScore": {
    "coverage": 5  // ✗ WRONG (from getProjectMetrics)
  }
}
```

**GET /api/code-metrics/project/{id}/test-summary**
```json
{
  "coveragePercentage": 11.88  // ✓ CORRECT (from coverage file)
}
```

### Layer 3: Frontend Display

**Overview Tab** (`CodeQualityDashboard.tsx:201,399`)
```typescript
const coverage = metrics.projectMetrics?.healthScore.coverage || 0;
// Shows: ~5% ✗ WRONG
```

**Test Coverage Tab** (`CodeQualityDashboard.tsx:941-943`)
```typescript
{metrics.testSummary?.coveragePercentage.toFixed(2)}%
// Shows: 11.88% ✓ CORRECT
```

---

## The Fix

### Option A: Use Snapshot Value (RECOMMENDED)

**Change in `getProjectMetrics()`:**

```typescript
// BEFORE (Lines 68-76)
const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
const weightedCoverage = metrics.reduce((sum, m) =>
  sum + ((m.testCoverage || 0) * m.linesOfCode), 0);
const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;

// AFTER (use snapshot)
const snapshot = await this.prisma.codeMetricsSnapshot.findFirst({
  where: { projectId },
  orderBy: { snapshotDate: 'desc' },
  select: { avgCoverage: true },
});
const avgCoverage = snapshot?.avgCoverage || 0;
```

**Benefits:**
- ✓ Consistent with snapshot data
- ✓ Faster (no aggregation needed)
- ✓ Same source of truth as Test Coverage tab
- ✓ No migration needed (snapshots already correct)

---

## Why This Happened

### Root Cause

The codebase has **two different coverage calculation methods**:

1. **Snapshot Creation** (code-analysis.processor.ts):
   - Reads coverage-summary.json → stores 11.88% ✓
   - Used by: Snapshots, Test Coverage tab

2. **Project Metrics API** (code-metrics.service.ts):
   - Averages file-level percentages → calculates 5% ✗
   - Used by: Overview tab, health score

### History

**ST-37 Fix Attempt:**
- Fixed snapshot creation to use coverage file total ✓
- Did NOT fix getProjectMetrics calculation ✗
- Result: Inconsistent data shown to users

---

## Impact

### Severity: HIGH

**Affected Features:**
- Overview tab coverage display
- Health score calculation
- Trend charts (if based on getProjectMetrics)
- User decision-making

**User Experience:**
- Confusing: "Which percentage is correct?"
- Loss of trust: "Is the data accurate?"
- Wrong priorities: "Low coverage = urgent work needed?"

**Business Impact:**
- QA team makes decisions based on incorrect data
- Developers prioritize wrong areas
- Stakeholders see misleading metrics

---

## Testing Recommendations

### Before Deploying Fix

1. **Unit Tests:**
   ```typescript
   ✓ Coverage from getProjectMetrics matches snapshot
   ✓ Coverage from getTestSummary matches coverage file
   ✓ Both APIs return same value
   ```

2. **Integration Tests:**
   ```typescript
   ✓ API endpoint consistency
   ✓ Database snapshot creation
   ✓ Historical data integrity
   ```

3. **E2E Tests:**
   ```typescript
   ✓ Overview tab shows correct percentage
   ✓ Test Coverage tab shows same percentage
   ✓ Trend chart updates correctly
   ```

4. **Manual Verification:**
   ```
   ✓ Check coverage-summary.json
   ✓ Verify database snapshot
   ✓ Confirm frontend display
   ✓ Compare all tabs show same value
   ```

---

## Action Items

### Immediate (Priority 1)
- [ ] Fix getProjectMetrics to use snapshot value
- [ ] Add unit test for coverage consistency
- [ ] Verify fix in staging environment

### Short-term (Priority 2)
- [ ] Add E2E test comparing all tabs
- [ ] Update API documentation
- [ ] Add logging for coverage source

### Long-term (Priority 3)
- [ ] Consider removing file-level coverage (redundant)
- [ ] Document coverage calculation methodology
- [ ] Add monitoring for data consistency

---

## Verification Steps (Post-Fix)

### Step 1: Check Database
```sql
SELECT avg_coverage FROM code_metrics_snapshots
WHERE project_id = '345a29ee-d6ab-477d-8079-c5dda0844d77'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 11.88
```

### Step 2: Check API Endpoints
```bash
curl /api/code-metrics/project/{id} | jq '.healthScore.coverage'
# Expected: 12 (rounded from 11.88)

curl /api/code-metrics/project/{id}/test-summary | jq '.coveragePercentage'
# Expected: 11.88
```

### Step 3: Check Frontend
- Navigate to Overview tab → Should show ~12%
- Navigate to Test Coverage tab → Should show 11.88%
- Both values should match (±1% for rounding)

---

## Actual Values Summary

| Source | Value | Status |
|--------|-------|--------|
| **Coverage File (total.lines.pct)** | 11.88% | ✓ Correct |
| **Database Snapshot (avg_coverage)** | 11.88% | ✓ Correct |
| **API: getTestSummary** | 11.88% | ✓ Correct |
| **API: getProjectMetrics** | ~5% | ✗ **WRONG** |
| **Frontend: Test Coverage Tab** | 11.88% | ✓ Correct |
| **Frontend: Overview Tab** | ~5% | ✗ **WRONG** |

**Conclusion:**
- ✓ **True Coverage:** 11.88% (1,281 lines covered out of 10,782)
- ✗ **Displayed in Overview:** ~5% (incorrect calculation)
- ✗ **Discrepancy:** 6.88 percentage points (136% error!)

---

## Files Modified (Proposed)

### Backend
- `backend/src/code-metrics/code-metrics.service.ts` (1 method, ~10 lines)

### Tests (New)
- `backend/src/code-metrics/__tests__/coverage-consistency.test.ts`
- `e2e/coverage-consistency.spec.ts`

### Documentation (Updated)
- `docs/architecture/code-metrics.md` (coverage calculation)
- `backend/src/code-metrics/README.md` (API documentation)

---

## Risk Assessment

**Risk Level:** LOW

**Why Low Risk:**
- Isolated change (single method)
- Snapshot data already correct
- No database migration needed
- Easy rollback (revert commit)
- Extensive test coverage planned

**Mitigation:**
- Deploy to staging first
- Monitor API response times
- Verify with real users
- Keep old calculation as fallback

---

## Estimated Effort

- **Development:** 2-3 hours
- **Testing:** 2-3 hours
- **Review:** 1 hour
- **Deployment:** 1 hour
- **Total:** 6-10 hours (1-2 days)

---

## Stakeholder Communication

### Message to Users

> "We discovered that the Overview tab was showing an incorrect coverage percentage (~5%) due to a calculation error. The correct coverage is 11.88%, which is already shown in the Test Coverage tab. We're deploying a fix to ensure all tabs show the correct value."

### Message to Development Team

> "ST-37 investigation revealed that getProjectMetrics uses LOC-weighted average from file-level data, while snapshots correctly use coverage file total. Fix: Use snapshot value instead of recalculating. See full report in screenshots/coverage-investigation/"

---

**Report Status:** COMPLETE
**Confidence Level:** HIGH (verified through all layers)
**Recommended Action:** Proceed with fix
**Timeline:** Deploy within 1-2 days
