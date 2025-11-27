# Testing & Coverage Guide - AI Studio

This project uses **THREE** test runners to provide comprehensive test coverage:

1. **Jest** - Backend unit & integration tests
2. **Vitest** - Frontend component tests
3. **Playwright** - E2E tests

---

## 🚀 Quick Start Commands

### Run All Tests with Coverage (Recommended)
```bash
# From root directory - runs backend + frontend coverage
npm run test:coverage

# Include E2E tests too
npm run test:coverage:all
```

### Individual Test Runners

#### Backend Tests (Jest)
```bash
# Run all backend tests
cd backend && npm test

# Run with coverage
cd backend && npm run test:cov

# Run specific test file
cd backend && npm test src/mcp/servers/execution/__tests__/record_component_complete.test.ts

# Coverage for execution services only
cd backend && npm run test:cov:execution

# Quick coverage summary
cd backend && npm run test:cov:summary

# Full HTML coverage report
cd backend && npm run test:cov:html
```

#### Frontend Tests (Vitest)
```bash
# Run all frontend tests
cd frontend && npm test

# Run with coverage
cd frontend && npm run test:coverage

# Watch mode
cd frontend && npm run test:watch

# UI mode (visual test runner)
cd frontend && npm run test:ui
```

#### E2E Tests (Playwright)
```bash
# Run all E2E tests
npm run test:e2e

# UI mode (visual test runner)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View last test report
npm run test:e2e:report
```

---

## 📊 Coverage Reports

### Unified Coverage (Backend + Frontend)

**NEW in ST-83:** The project now generates a unified coverage report that combines backend and frontend coverage.

```bash
# Generate unified coverage report
npm run test:coverage:unified
```

**Output:** `coverage/coverage-summary.json` (consumed by Code Quality Dashboard)

The unified coverage is calculated by:
1. Running backend tests with Jest coverage → `backend/coverage/coverage-summary.json`
2. Running frontend tests with Vitest coverage → `frontend/coverage/coverage-summary.json`
3. Merging both reports with weighted averages → `coverage/coverage-summary.json`

**Merge Script:** `scripts/merge-coverage.ts`

### Backend Coverage (Jest)

**Configuration:** `backend/jest.config.js`

**Coverage Thresholds:**
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

**Coverage Output:**
- **Text:** Displayed in terminal
- **HTML:** `backend/coverage/index.html`
- **LCOV:** `backend/coverage/lcov.info`
- **JSON:** `backend/coverage/coverage-final.json`

**Excluded from Coverage:**
- Test files (`**/*.test.ts`, `**/*.spec.ts`)
- Type definitions (`**/*.d.ts`)
- DTOs and entities (`**/dto/**`, `**/entities/**`)
- Test utilities (`src/test-utils/**`)
- Entry point (`src/main.ts`)

### Frontend Coverage (Vitest)

**Configuration:** `frontend/vitest.config.ts`

**Coverage Thresholds:**
- Statements: 60%
- Branches: 50%
- Functions: 60%
- Lines: 60%

**Coverage Output:**
- **Text:** Displayed in terminal
- **HTML:** `frontend/coverage/index.html`
- **LCOV:** `frontend/coverage/lcov.info`
- **JSON:** `frontend/coverage/coverage-final.json`

**Excluded from Coverage:**
- Test files (`**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`)
- Type definitions (`**/*.d.ts`)
- Entry points (`src/main.tsx`, `src/vite-env.d.ts`)
- Test setup (`src/test/**`)

### E2E Coverage (Playwright)

**Configuration:** `playwright.config.ts`

**Reports:**
- **HTML:** `playwright-report/index.html`
- **JUnit:** `playwright-results.xml`

**Coverage Notes:**
- E2E tests provide integration coverage, not code coverage
- Tests verify complete user workflows across backend + frontend
- Includes visual regression testing capabilities

---

## 📁 Coverage Report Locations

After running coverage commands, find reports here:

```
/opt/stack/AIStudio/
├── coverage/                         ← NEW: Unified coverage
│   └── coverage-summary.json         ← Code Quality Dashboard reads this
│
├── backend/
│   └── coverage/
│       ├── index.html          ← Open in browser
│       ├── lcov.info
│       ├── coverage-summary.json
│       └── coverage-final.json
│
├── frontend/
│   └── coverage/
│       ├── index.html          ← Open in browser
│       ├── lcov.info
│       ├── coverage-summary.json
│       └── coverage-final.json
│
└── playwright-report/
    └── index.html              ← Open in browser
```

### Code Quality Dashboard Integration

The Code Quality Dashboard displays unified coverage from:

**Endpoint:** `GET /code-metrics/project/:projectId/test-summary`

**Implementation:** `backend/src/code-metrics/code-metrics.service.ts:957`

**Data Source:** `/coverage/coverage-summary.json` (merged report)

**Dashboard URL:** `https://vibestudio.example.com/code-quality/:projectId`

The dashboard reads:
- `total.lines.pct` for coverage percentage
- Counts test files for total tests metric
- Updates automatically when coverage file is regenerated

---

## 🎯 Test Organization

### Backend Test Structure
```
backend/src/
├── mcp/servers/
│   ├── execution/__tests__/           # 13 test files
│   ├── versioning/__tests__/          # 7 test files
│   ├── git/__tests__/                 # 5 test files
│   ├── test-queue/__tests__/          # 6 test files
│   └── ... other modules
│
└── services/__tests__/                # Service layer tests
```

**Test Naming Convention:** `TC-MODULE-###-TYPE`
- Example: `TC-EXEC-003-U1` (Test Case - Execution - #3 - Unit Test #1)

### Frontend Test Structure
```
frontend/src/
├── components/
│   └── __tests__/                    # Component tests
├── hooks/
│   └── __tests__/                    # Hook tests
└── utils/
    └── __tests__/                    # Utility tests
```

### E2E Test Structure
```
e2e/
├── 01-story-workflow.spec.ts
├── 02-subtask-management.spec.ts
├── 03-story-filtering.spec.ts
└── ... other E2E tests
```

---

## 🔧 Advanced Usage

### Run Specific Test Suites

```bash
# Backend: Only execution service tests
npm test -- backend/src/mcp/servers/execution

# Frontend: Only component tests
cd frontend && npm test -- src/components

# E2E: Only specific test file
npx playwright test e2e/01-story-workflow.spec.ts
```

### Watch Mode

```bash
# Backend: Watch mode
cd backend && npm run test:watch

# Frontend: Watch mode (default)
cd frontend && npm run test:watch
```

### Coverage Options

```bash
# Backend: Coverage with specific reporters
cd backend && npm test -- --coverage --coverageReporters=html,text-summary

# Frontend: Coverage for specific directory
cd frontend && npm test -- --coverage src/components

# Combine coverage from multiple runs
# (Advanced: requires Istanbul coverage merger)
```

---

## 📈 Current Test Coverage

**Last Updated:** November 23, 2025 (Post ST-83)

### Overall Metrics
- **Total Test Files:** 90+ test files
- **Total Test Code:** 34,328 lines
- **Backend Tests:** ~500+ tests across all modules
- **Frontend Tests:** (Run `npm run test:coverage` to see current numbers)
- **E2E Tests:** 14 spec files

### Module Coverage (Backend)

| Module | Test Files | Coverage | Status |
|--------|-----------|----------|---------|
| Execution Services | 13 | >90% | ✅ Excellent |
| Versioning System | 7 | ~85% | ✅ High |
| Git Workflow | 5 | ~80% | ✅ Good |
| Test Queue | 6 | ~80% | ✅ Good |
| Services Layer | 6+ | ~85% | ✅ High |

---

## 🐛 Troubleshooting

### Coverage Not Collecting

**Problem:** Coverage shows 0% or incomplete

**Solutions:**
1. Check you're in the correct directory (root vs backend vs frontend)
2. Verify `collectCoverageFrom` patterns in config files
3. Run with `--no-cache` flag: `npm test -- --no-cache --coverage`
4. Delete coverage folder and re-run: `rm -rf coverage && npm run test:cov`

### Tests Timing Out

**Problem:** Tests exceed timeout limits

**Solutions:**
1. Increase timeout in jest.config.js or vitest.config.ts
2. Use `--maxWorkers=1` for sequential execution
3. Check for hanging async operations in tests
4. Ensure test database is properly set up

### Playwright Tests Failing

**Problem:** E2E tests fail with timeout or connection errors

**Solutions:**
1. Ensure backend and frontend are running: `npm run dev`
2. Check DATABASE_URL is set correctly
3. Install Playwright browsers: `npx playwright install`
4. Run in headed mode to see what's happening: `npm run test:e2e:headed`

---

## 📚 Best Practices

### Writing Tests

1. **Use AAA Pattern:** Arrange, Act, Assert
2. **Clear Test Names:** Use descriptive TC-* identifiers
3. **Mock External Dependencies:** Use jest-mock-extended or vitest mocks
4. **Test Edge Cases:** Null, undefined, empty arrays, errors
5. **Keep Tests Fast:** Mock I/O, database, network calls

### Coverage Goals

- **Aim for 70%+** statement coverage as baseline
- **Critical paths:** 90%+ coverage (auth, payments, execution)
- **UI components:** 60%+ coverage (harder to test, focus on logic)
- **E2E tests:** Cover critical user journeys, not every path

### Maintenance

1. **Run tests before commits:** `npm test`
2. **Check coverage trends:** Monitor coverage reports
3. **Update tests with code changes:** Keep tests in sync
4. **Review failing tests immediately:** Don't let them pile up

---

## 📦 CI/CD Integration

### GitHub Actions Example

```yaml
name: Test & Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # Backend tests
      - run: cd backend && npm ci
      - run: cd backend && npm run test:cov

      # Frontend tests
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:coverage

      # E2E tests
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

      # Upload coverage reports
      - uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
```

---

## 🎓 Additional Resources

- **Jest Documentation:** https://jestjs.io/
- **Vitest Documentation:** https://vitest.dev/
- **Playwright Documentation:** https://playwright.dev/
- **Test Architecture Guide:** `/backend/docs/ST-86-ARCHITECTURE.md`
- **Database Safety Guide:** `/backend/docs/testing/DATABASE_SAFETY.md`

---

## ✅ Summary

**To generate a complete coverage report with ONE command:**

```bash
npm run test:coverage
```

This will:
1. Run backend tests with coverage (Jest)
2. Run frontend tests with coverage (Vitest)
3. Generate HTML reports for both
4. Display summary in terminal

**View the reports:**
- Backend: `open backend/coverage/index.html`
- Frontend: `open frontend/coverage/index.html`

---

**Last Updated:** November 23, 2025
**Maintained By:** AI Studio Team
**Related Stories:** ST-83 (Backend Coverage), ST-86 (Test Infrastructure)
