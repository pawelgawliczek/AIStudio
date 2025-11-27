# Unified Coverage System Architecture

**Created:** November 23, 2025
**Story:** ST-83 (Comprehensive Test Coverage)
**Status:** ✅ Implemented

## Overview

The project now has a unified coverage reporting system that combines coverage from multiple test runners (Jest, Vitest, Playwright) into a single report consumed by the Code Quality Dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Test Execution                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Backend   │  │  Frontend   │  │     E2E     │             │
│  │    Tests    │  │   Tests     │  │   Tests     │             │
│  │   (Jest)    │  │  (Vitest)   │  │ (Playwright)│             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                 │                 │                     │
│         ▼                 ▼                 ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Backend    │  │  Frontend   │  │  Playwright │             │
│  │  Coverage   │  │  Coverage   │  │   Report    │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
│         │                 │                                       │
└─────────┼─────────────────┼───────────────────────────────────┘
          │                 │
          │                 │
          ▼                 ▼
    ┌─────────────────────────────────┐
    │   scripts/merge-coverage.ts     │
    │   (Weighted Average Merger)     │
    └─────────────┬───────────────────┘
                  │
                  ▼
          ┌───────────────────┐
          │    Unified        │
          │   Coverage        │
          │   Report          │
          └─────────┬─────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  Code Quality Dashboard   │
        │  API Endpoint             │
        │  (getTestSummary)         │
        └───────────┬───────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │    Frontend UI            │
        │  Coverage Display         │
        │  Metrics & Tiles          │
        └───────────────────────────┘
```

## Components

### 1. Test Runners

#### Jest (Backend)
- **Location:** `backend/`
- **Config:** `backend/jest.config.js`
- **Output:** `backend/coverage/coverage-summary.json`
- **Thresholds:** 70% statements, 60% branches, 70% functions, 70% lines
- **Command:** `npm run test:cov --workspace=backend`

#### Vitest (Frontend)
- **Location:** `frontend/`
- **Config:** `frontend/vitest.config.ts`
- **Output:** `frontend/coverage/coverage-summary.json`
- **Thresholds:** 60% statements, 50% branches, 60% functions, 60% lines
- **Command:** `npm run test:coverage --workspace=frontend`

#### Playwright (E2E)
- **Location:** `e2e/`
- **Config:** `playwright.config.ts`
- **Output:** `playwright-report/`
- **Coverage:** Not measured (integration testing only)
- **Command:** `npm run test:e2e`

### 2. Coverage Merge Script

**Location:** `scripts/merge-coverage.ts`

**Algorithm:**
1. Load `backend/coverage/coverage-summary.json`
2. Load `frontend/coverage/coverage-summary.json`
3. Merge metrics using weighted averages:
   ```
   merged.lines.total = backend.lines.total + frontend.lines.total
   merged.lines.covered = backend.lines.covered + frontend.lines.covered
   merged.lines.pct = (covered / total) × 100
   ```
4. Write merged report to `coverage/coverage-summary.json`

**Features:**
- Handles missing reports gracefully (uses available data)
- Prefixes file paths with `backend/` or `frontend/` for clarity
- Displays detailed summary with per-component breakdown
- Exit code 0 on success, 1 on error

### 3. Unified Coverage Commands

**Added to root `package.json`:**

```json
{
  "scripts": {
    "test:coverage": "npm run test:cov --workspace=backend && npm run test:coverage --workspace=frontend && npm run coverage:merge",
    "test:coverage:summary": "npm run test:cov:summary --workspace=backend && npm run test:coverage --workspace=frontend && npm run coverage:merge",
    "test:coverage:all": "npm run test:coverage && npm run test:e2e",
    "test:coverage:unified": "npm run test:coverage && echo '\\n📊 Unified coverage report: coverage/coverage-summary.json'",
    "coverage:merge": "ts-node scripts/merge-coverage.ts"
  }
}
```

**Recommended Command:**
```bash
npm run test:coverage:unified
```

### 4. Code Quality Dashboard Integration

**API Endpoint:** `GET /code-metrics/project/:projectId/test-summary`

**Implementation:** `backend/src/code-metrics/code-metrics.service.ts:957-1038`

**Data Flow:**
1. Dashboard sends request to `/code-metrics/project/:projectId/test-summary`
2. Service calls `getTestSummaryFromCoverage(projectId)`
3. Service reads `/coverage/coverage-summary.json` from project's `localPath`
4. Extracts `total.lines.pct` for coverage percentage
5. Counts test files matching `**/*.test.{ts,tsx}` and `**/*.spec.{ts,tsx}`
6. Returns summary:
   ```json
   {
     "totalTests": 90,
     "passing": 90,
     "failing": 0,
     "skipped": 0,
     "lastExecution": "2025-11-23T11:32:00.000Z",
     "coveragePercentage": 11.88
   }
   ```

**Dashboard URL:** `https://vibestudio.example.com/code-quality/:projectId`

## File Locations

```
/opt/stack/AIStudio/
├── coverage/                         ← Unified coverage (merged)
│   └── coverage-summary.json         ← Dashboard reads this
│
├── backend/
│   └── coverage/
│       ├── coverage-summary.json     ← Jest output
│       ├── lcov.info
│       └── index.html
│
├── frontend/
│   └── coverage/
│       ├── coverage-summary.json     ← Vitest output
│       ├── lcov.info
│       └── index.html
│
├── scripts/
│   └── merge-coverage.ts             ← Merge logic
│
└── playwright-report/
    └── index.html
```

## Usage Examples

### Generate Unified Coverage

```bash
# Full coverage with all test runners
npm run test:coverage:unified

# Quick summary only
npm run test:coverage:summary

# Coverage + E2E tests
npm run test:coverage:all

# Manual merge (if reports already exist)
npm run coverage:merge
```

### View Reports

```bash
# Unified coverage summary
cat coverage/coverage-summary.json | jq .total

# Backend HTML report
open backend/coverage/index.html

# Frontend HTML report
open frontend/coverage/index.html

# Dashboard
open https://vibestudio.example.com/code-quality/345a29ee-d6ab-477d-8079-c5dda0844d77
```

## Current Coverage Metrics

**Last Generated:** November 23, 2025 11:32 AM

```
📊 Coverage Summary:
   Lines:      11.88% (1281/10782)
   Statements: 12.48% (1415/11332)
   Functions:  10.06% (187/1858)
   Branches:   13.74% (547/3980)
```

**Breakdown:**
- Backend Coverage: 11.88% (baseline, improving)
- Frontend Coverage: Not yet generated (pending dependency fix)
- E2E Coverage: N/A (integration testing only)

## Known Issues

### Frontend Tests Dependency Issue

**Problem:** Frontend tests fail with:
```
Error: Cannot find module '@testing-library/dom'
```

**Root Cause:** Missing peer dependency in frontend/package.json

**Fix Required:**
```bash
cd frontend
npm install --save-dev @testing-library/dom
```

**Impact:** Frontend coverage cannot be generated until this is resolved. Current unified coverage only includes backend metrics.

**Workaround:** Merge script handles missing frontend coverage gracefully and uses backend-only coverage.

## CI/CD Integration

### Recommended GitHub Actions Workflow

```yaml
name: Test Coverage

on: [push, pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Generate unified coverage
        run: npm run test:coverage:unified

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-summary.json
```

## Benefits

1. **Single Source of Truth:** One unified coverage report for the entire codebase
2. **Dashboard Integration:** Code Quality Dashboard displays accurate coverage
3. **Developer Experience:** One command to generate complete coverage
4. **Weighted Accuracy:** Larger codebases (more lines) have proportional weight
5. **Graceful Degradation:** Works with partial coverage (backend-only or frontend-only)
6. **Transparency:** Shows both combined and per-component metrics

## Future Enhancements

### Planned
- [ ] Fix frontend test dependencies (@testing-library/dom)
- [ ] Add Playwright code coverage (using V8 coverage)
- [ ] Integrate coverage trends over time
- [ ] Add coverage diff in PRs (before/after comparison)

### Considered
- [ ] LCOV file merging (in addition to summary)
- [ ] HTML report merging (single unified HTML report)
- [ ] Coverage badges in README
- [ ] Automated coverage regression alerts

## Related Documentation

- [Testing Guide](/TESTING_GUIDE.md) - Comprehensive testing documentation
- [ST-83 Completion Report](/ST-83-COMPLETION-REPORT.md) - Test coverage story
- [Code Metrics Service](/backend/src/code-metrics/code-metrics.service.ts) - API implementation
- [Backend Jest Config](/backend/jest.config.js) - Backend coverage settings
- [Frontend Vitest Config](/frontend/vitest.config.ts) - Frontend coverage settings

## Troubleshooting

### Coverage Not Updating in Dashboard

1. **Verify file exists:**
   ```bash
   ls -lh coverage/coverage-summary.json
   ```

2. **Check file timestamp:**
   ```bash
   stat coverage/coverage-summary.json
   ```

3. **Validate JSON structure:**
   ```bash
   cat coverage/coverage-summary.json | jq .total
   ```

4. **Test API endpoint:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://vibestudio.example.com/code-metrics/project/$PROJECT_ID/test-summary
   ```

### Merge Script Errors

**Error: Coverage file not found**
```bash
# Generate backend coverage first
npm run test:cov --workspace=backend

# Then merge
npm run coverage:merge
```

**Error: ts-node not found**
```bash
# Install root dependencies
npm install
```

## References

- **Jest Coverage:** https://jestjs.io/docs/configuration#collectcoveragefrom-array
- **Vitest Coverage:** https://vitest.dev/guide/coverage.html
- **Istanbul Coverage:** https://istanbul.js.org/
- **LCOV Format:** http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php

---

**Maintained By:** AI Studio Team
**Last Updated:** November 23, 2025
**Version:** 1.0.0
