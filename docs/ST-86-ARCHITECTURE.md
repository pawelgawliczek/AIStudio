# Architecture Analysis: ST-86 Test Coverage for Core Execution Services

## Executive Summary

This architecture defines a comprehensive testing strategy to achieve 80%+ test coverage for 1,974 LOC across critical execution services and MCP tools. The design emphasizes deterministic testing with proper mocking, fixture reuse, and clear separation between unit, integration, and E2E tests. **Estimated technical complexity: 7/10** due to transcript parsing complexity (717 LOC), file system mocking requirements, and multi-transcript aggregation edge cases.

---

## 1. TEST ARCHITECTURE OVERVIEW

### 1.1 Coverage Targets (1,974 LOC Total)

| File | Lines | Current Coverage | Priority | Complexity |
|------|-------|-----------------|----------|-----------|
| **record_component_complete.ts** | 717 | 0% | CRITICAL | Very High |
| workflow-state.service.ts | 434 | 7% | High | Medium-High |
| update_workflow_status.ts | 410 | ~40% | High | High |
| workflows.service.ts | 303 | 0% | Medium | Medium |
| runs.service.ts | 194 | 0% | Medium | Medium |
| start_workflow_run.ts | 193 | ~60% | Medium | Medium |
| store_artifact.ts | 178 | ~50% | Low | Low |
| get_workflow_context.ts | 145 | ~50% | Low | Low |

**Key Insight**: `record_component_complete.ts` is the largest file with the most complex logic (transcript parsing, multi-file aggregation, time filtering) and currently has ZERO test coverage. This must be the primary focus.

### 1.2 Test Distribution Strategy

```
Total Tests: ~45 test cases across 18 use case test scenarios

Unit Tests (60%): ~27 tests
- Transcript parsing logic (8 tests)
- Metric aggregation calculations (6 tests)
- CRUD operations (7 tests)
- Validation and error handling (6 tests)

Integration Tests (30%): ~14 tests
- Database operations with Prisma (8 tests)
- Multi-component workflows (4 tests)
- File system operations (2 tests)

E2E Tests (10%): ~4 tests
- Complete workflow lifecycle (2 tests)
- Multi-transcript aggregation (2 tests)
```

---

## 2. TESTING PATTERNS & CONVENTIONS

### 2.1 Test File Organization

```
backend/src/
├── execution/
│   ├── workflow-state.service.ts
│   └── __tests__/
│       └── workflow-state.service.spec.ts (EXPAND)
├── workflows/
│   ├── workflows.service.ts
│   └── __tests__/
│       └── workflows.service.spec.ts (EXPAND)
├── runs/
│   ├── runs.service.ts
│   └── __tests__/
│       └── runs.service.spec.ts (EXPAND)
└── mcp/servers/execution/
    ├── record_component_complete.ts
    ├── update_workflow_status.ts
    ├── start_workflow_run.ts
    ├── store_artifact.ts
    ├── get_workflow_context.ts
    └── __tests__/
        ├── test-setup.ts (EXISTING - extend fixtures)
        ├── record_component_complete.test.ts (NEW - CRITICAL)
        ├── update_workflow_status.test.ts (NEW)
        ├── start_workflow_run.test.ts (EXISTING - expand)
        ├── store_artifact.test.ts (NEW)
        ├── get_workflow_context.test.ts (NEW)
        └── workflow-lifecycle.e2e.test.ts (NEW)
```

**Naming Convention**:
- Service tests: `*.service.spec.ts` (NestJS convention)
- MCP tool tests: `*.test.ts` (Node convention)
- E2E tests: `*.e2e.test.ts`

### 2.2 AAA Pattern (Arrange-Act-Assert)

**Every test must follow this structure:**

```typescript
it('TC-EXEC-001-U1: should aggregate metrics with valid data', async () => {
  // ========== ARRANGE ==========
  const mockWorkflowRun = {
    ...fixtures.workflowRun,
    componentRuns: [
      { ...fixtures.componentRun, tokensInput: 1000, tokensOutput: 500 },
      { ...fixtures.componentRun, tokensInput: 2000, tokensOutput: 1000 },
    ],
  };
  prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

  // ========== ACT ==========
  const result = await service.getWorkflowRunStatus('run-id');

  // ========== ASSERT ==========
  expect(result.metrics.totalInputTokens).toBe(3000);
  expect(result.metrics.totalOutputTokens).toBe(1500);
  expect(result.metrics.totalTokens).toBe(4500);
  expect(result.metrics.avgCacheHitRate).toBeGreaterThanOrEqual(0);
});
```

### 2.3 Test Case Naming Convention

**Format**: `TC-{USE_CASE}-{LEVEL}{NUMBER}: {description}`

Examples:
- `TC-EXEC-001-U1`: Use Case 1, Unit Test 1
- `TC-EXEC-003-I2`: Use Case 3, Integration Test 2
- `TC-EXEC-004-E1`: Use Case 4, E2E Test 1

**Test Levels**:
- `U` = Unit (isolated, mocked dependencies)
- `I` = Integration (real database, mocked external services)
- `E` = E2E (full lifecycle, minimal mocking)

---

## 3. MOCKING STRATEGY

### 3.1 Prisma Database Mocking (jest-mock-extended)

**Pattern**: Use `mockDeep` for deep method chaining

```typescript
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrisma = DeepMockProxy<PrismaClient>;
export const prismaMock = mockDeep<PrismaClient>() as MockPrisma;

beforeEach(() => {
  mockReset(prismaMock);
});

// Usage in tests
prismaMock.workflowRun.findUnique.mockResolvedValue({
  ...fixtures.workflowRun,
  componentRuns: [...],
} as any);

// For method chains
prismaMock.componentRun.findMany.mockResolvedValue([...] as any);
prismaMock.workflowRun.count.mockResolvedValue(10);
```

**Key Guidelines**:
- Always reset mocks in `beforeEach` using `mockReset(prismaMock)`
- Use fixtures from `test-setup.ts` as base objects
- Type assertion `as any` required for complex nested objects
- Mock both query and mutation methods

### 3.2 File System Mocking (fs module)

**Pattern**: Use Jest's built-in `jest.mock('fs')` for file operations

```typescript
import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.existsSync.mockReturnValue(false);
  mockFs.readdirSync.mockReturnValue([]);
});

// Mock transcript file existence
mockFs.existsSync.mockReturnValue(true);
mockFs.createReadStream.mockReturnValue({
  /* mock stream */
} as any);

// Mock transcript directory listing
mockFs.readdirSync.mockReturnValue(['transcript-1.jsonl', 'transcript-2.jsonl'] as any);
mockFs.statSync.mockImplementation((filePath) => ({
  mtime: new Date('2025-01-01T10:05:00Z'),
  mtimeMs: new Date('2025-01-01T10:05:00Z').getTime(),
} as any));
```

**Critical Mocks for Transcript Parsing**:
- `fs.existsSync()` - Check if transcript file exists
- `fs.readdirSync()` - List transcript files in directory
- `fs.statSync()` - Get file modification time
- `fs.createReadStream()` - Read transcript line by line
- `fs.writeFileSync()` - Truncate cleanup
- `fs.unlinkSync()` - Delete cleanup
- `readline.createInterface()` - Parse JSON Lines format

### 3.3 Date/Time Mocking

**Pattern**: Use fixed timestamps for deterministic tests

```typescript
const FIXED_START_TIME = new Date('2025-01-01T10:00:00.000Z');
const FIXED_END_TIME = new Date('2025-01-01T10:05:00.000Z');

const mockComponentRun = {
  ...fixtures.componentRun,
  startedAt: FIXED_START_TIME,
  finishedAt: FIXED_END_TIME,
};

// Calculate expected duration
const expectedDuration = Math.round(
  (FIXED_END_TIME.getTime() - FIXED_START_TIME.getTime()) / 1000
);
expect(result.durationSeconds).toBe(expectedDuration); // 300 seconds
```

**Why Fixed Dates**:
- Eliminates flaky tests due to timing issues
- Makes duration calculations predictable
- Enables precise time filtering validation
- Supports millisecond precision testing

---

## 4. CRITICAL TEST SCENARIOS

### 4.1 UC-EXEC-003: Transcript Parsing (HIGHEST PRIORITY)

**record_component_complete.ts (717 LOC) - 8 Unit Tests**

#### TC-EXEC-003-U1: Valid transcript parsing with all metrics
- Parse valid JSON Lines transcript
- Extract token usage (input, output, cache read/write)
- Count cache hits/misses
- Track tool calls and errors
- Extract LOC metrics from Write/Edit tools
- Count user prompts and system iterations

#### TC-EXEC-003-U2: Malformed JSON line handling
- Skip malformed lines gracefully
- Continue parsing after errors
- Verify metrics count only valid lines

#### TC-EXEC-003-U3: Time filtering precision (millisecond accuracy)
- Filter entries by component execution window
- Test boundary conditions (start time, end time)
- Verify millisecond precision
- Test buffer period handling

#### TC-EXEC-003-U4: Multi-transcript aggregation
- Parse multiple transcript files
- Aggregate metrics across files
- Merge unique file paths
- Combine tool breakdown statistics

#### TC-EXEC-003-U5: Cleanup policy execution
- Test 'delete' policy (unlinks file)
- Test 'truncate' policy (empties file)
- Test 'archive' policy (moves to archive dir)
- Test 'keep' policy (no changes)

#### TC-EXEC-003-U6: Cost calculation (Sonnet 4 pricing)
- Verify $3/M input tokens
- Verify $15/M output tokens
- Verify $0.30/M cache read tokens
- Test precision with large numbers

#### TC-EXEC-003-U7: LOC extraction from Write/Edit tools
- Count lines added from Write tool
- Calculate net lines from Edit tool (added - deleted)
- Count modified lines (min of old/new)
- Track unique file paths

#### TC-EXEC-003-U8: Test file detection
- Detect files with 'test' in path
- Detect files with 'spec' in path
- Detect files in '__tests__' directory
- Increment testsGenerated counter

### 4.2 UC-EXEC-001: Workflow State Metrics Aggregation

**workflow-state.service.ts (434 LOC) - 4 Tests**

#### TC-EXEC-001-U1: Metric aggregation with valid data
- Sum tokens across component runs
- Sum cache hits/misses
- Sum LOC metrics
- Calculate total cost

#### TC-EXEC-001-U2: NULL value handling in aggregation
- Treat NULL as 0 in sums
- Avoid division by zero
- Return 0 for empty results

#### TC-EXEC-001-U3: Cache hit rate formula validation
- Test formula: hits / (hits + misses)
- Test edge case: 0 hits, 0 misses
- Test perfect cache (100% hits)
- Test no cache (0% hits)

#### TC-EXEC-001-I1: Workflow not found error
- Throw error for invalid run ID
- Include run ID in error message

### 4.3 UC-EXEC-004: Workflow Lifecycle Management

**update_workflow_status.ts (410 LOC) - 3 Tests**

#### TC-EXEC-004-U1: Status transition with orchestrator transcript parsing
- Parse orchestrator transcript on completion
- Update orchestrator ComponentRun
- Extract user prompts (only from orchestrator)
- Calculate orchestrator metrics

#### TC-EXEC-004-U2: Metadata cleanup (_transcriptTracking removal)
- Remove internal _transcriptTracking field
- Preserve other metadata fields
- Clean up on terminal states only

#### TC-EXEC-004-I1: Orchestrator vs agent metric separation
- Separate orchestrator metrics (executionOrder=0)
- Calculate agent totals (executionOrder>0)
- Report unified total
- Backward compatibility with coordinatorMetrics JSONB

---

## 5. IMPLEMENTATION GUIDELINES

### 5.1 Test Execution Workflow

**Development Cycle**:
```bash
# 1. Run tests in watch mode during development
cd /opt/stack/worktrees/st-86-test-coverage-core-execution-services/backend
npm run test:watch -- record_component_complete

# 2. Run full test suite with coverage
npm run test:cov

# 3. View coverage report
open coverage/lcov-report/index.html

# 4. Target: 80%+ line coverage for all files
```

### 5.2 Coverage Validation Checklist

**Before marking story as done**:

- [ ] `record_component_complete.ts`: 80%+ coverage (currently 0%)
- [ ] `workflow-state.service.ts`: 80%+ coverage (currently 7%)
- [ ] `update_workflow_status.ts`: 80%+ coverage (currently ~40%)
- [ ] `workflows.service.ts`: 80%+ coverage (currently 0%)
- [ ] `runs.service.ts`: 80%+ coverage (currently 0%)
- [ ] All tests pass with 0 failures
- [ ] No console errors during test execution
- [ ] Test suite executes in < 30 seconds

### 5.3 Test Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Individual test time | < 100ms avg | Fast feedback loop |
| Full suite execution | < 30s | CI/CD efficiency |
| Coverage threshold | 80%+ | Production confidence |
| Mock reset overhead | < 10ms | Efficient beforeEach |

### 5.4 Error Handling Testing

**Every service method must test**:
1. **Happy path**: Valid inputs, expected output
2. **Validation errors**: Missing required fields, invalid types
3. **Not found errors**: Non-existent resources
4. **Constraint violations**: Duplicate keys, foreign key failures
5. **Edge cases**: NULL values, empty arrays, boundary conditions

---

## 6. TECHNICAL COMPLEXITY ASSESSMENT

### 6.1 Complexity Breakdown

| Component | Complexity | Factors |
|-----------|------------|---------|
| **Transcript Parsing** | **Very High (9/10)** | JSON Lines format, line-by-line streaming, malformed line handling, time filtering with millisecond precision, multi-file aggregation |
| **Metric Aggregation** | **High (7/10)** | NULL handling across multiple components, derived metric calculations (cache hit rate, cost per LOC), division by zero protection |
| **File System Mocking** | **High (7/10)** | Multiple fs methods, async stream operations, file modification time checks, cleanup policies |
| **Database Mocking** | **Medium (5/10)** | Deep method chaining with jest-mock-extended, complex includes and relations, aggregation queries |
| **CRUD Operations** | **Medium (4/10)** | Standard validation, constraint handling, status transitions |

**Overall Complexity: 7/10**

**Justification**:
- Transcript parsing (717 LOC) is the single most complex component with multiple edge cases
- Multi-transcript aggregation with time filtering requires precise logic
- File system operations add external dependency complexity
- NULL handling in metrics requires defensive programming
- Overall scope of 1,974 LOC is substantial but manageable with proper fixtures

### 6.2 Risk Mitigation

**High-Risk Areas**:
1. **Transcript parsing malformed JSON**: Use try-catch per line, comprehensive error logging
2. **Time filtering precision**: Use fixed timestamps in tests, validate millisecond accuracy
3. **Multi-transcript cross-contamination**: Test time window boundaries, verify file filtering logic
4. **Division by zero in metrics**: Always use `|| 1` fallback in denominators
5. **File system operation failures**: Mock all fs methods, test error scenarios

**Mitigation Strategies**:
- Start with simplest tests (happy path unit tests)
- Incrementally add edge cases
- Use parameterized tests (`it.each`) for repetitive scenarios
- Isolate complex logic into helper functions with dedicated tests
- Leverage existing test-setup.ts fixtures

---

## 7. TEST FILE PRIORITY MATRIX

**Recommended implementation order** (highest ROI first):

| Priority | File | LOC | Current Coverage | Impact | Effort | ROI |
|----------|------|-----|-----------------|--------|--------|-----|
| **1** | record_component_complete.ts | 717 | 0% | Critical | High | **Highest** |
| **2** | workflow-state.service.ts | 434 | 7% | High | Medium | **High** |
| **3** | update_workflow_status.ts | 410 | ~40% | High | Medium | **High** |
| **4** | workflows.service.ts | 303 | 0% | Medium | Low | **Medium** |
| **5** | runs.service.ts | 194 | 0% | Medium | Low | **Medium** |
| **6** | start_workflow_run.ts | 193 | ~60% | Medium | Low | **Low** |
| **7** | store_artifact.ts | 178 | ~50% | Low | Low | **Low** |
| **8** | get_workflow_context.ts | 145 | ~50% | Low | Low | **Low** |

**Implementation Sprint**:
- **Week 1**: Priority 1-2 (record_component_complete, workflow-state) → 60% overall coverage
- **Week 2**: Priority 3-5 (update_workflow_status, workflows, runs) → 80%+ overall coverage
- **Optional**: Priority 6-8 (expand existing tests) → 90%+ coverage

---

## 8. SUCCESS METRICS

### 8.1 Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Line Coverage | 7% (avg) | 80%+ | Jest --coverage |
| Test Count | ~50 | ~95 | Jest reporter |
| Test Suite Duration | N/A | < 30s | Jest timing |
| Test Files | 8 | 11 | Directory count |
| Test LOC | ~1,200 | ~2,700 | Grep count |

### 8.2 Qualitative Metrics

- [ ] All critical paths tested (transcript parsing, metric aggregation)
- [ ] All error scenarios covered (validation, not found, constraints)
- [ ] All edge cases tested (NULL values, empty arrays, malformed data)
- [ ] Tests are deterministic (no flaky tests due to timing)
- [ ] Test code is maintainable (fixtures reused, AAA pattern followed)
- [ ] CI/CD integration ready (fast, isolated, no external dependencies)

---

## 9. DESIGN DECISIONS & RATIONALE

### 9.1 Why jest-mock-extended over manual mocks?

**Decision**: Use `mockDeep` from jest-mock-extended for Prisma mocking

**Rationale**:
- Supports deep method chaining (e.g., `prisma.workflowRun.findUnique().include()`)
- Type-safe mocking with TypeScript inference
- Automatic mock reset with `mockReset()`
- Already established pattern in codebase (test-setup.ts)

**Alternative Considered**: Manual mock factory functions
- Rejected: Too verbose, no type safety, manual reset required

### 9.2 Why separate unit/integration/e2e tests?

**Decision**: 60% unit, 30% integration, 10% e2e distribution

**Rationale**:
- Unit tests are fast, isolated, test logic in isolation
- Integration tests validate database operations, Prisma query correctness
- E2E tests ensure full workflow lifecycle works end-to-end
- Aligns with testing pyramid best practices

**Alternative Considered**: All integration tests with real database
- Rejected: Slow, flaky, difficult to test edge cases

### 9.3 Why fixed timestamps instead of Date.now()?

**Decision**: Use fixed dates (e.g., `new Date('2025-01-01T10:00:00Z')`)

**Rationale**:
- Eliminates timing-based flakiness
- Makes duration calculations predictable
- Enables precise time filtering validation
- Easier to debug when tests fail

**Alternative Considered**: Mock Date.now() with Jest timers
- Rejected: More complex, harder to reason about, global state mutation

---

## CONCLUSION

This architecture provides a comprehensive, pragmatic approach to achieving 80%+ test coverage for 1,974 LOC of critical execution services. The design prioritizes:

1. **Deterministic testing** with fixed timestamps and proper mocking
2. **Maintainability** through fixture reuse and AAA pattern
3. **Coverage efficiency** by focusing on high-impact files first
4. **Developer experience** with clear patterns and templates

**Estimated Implementation Effort**: 8-12 hours
- Transcript parsing tests: 4-5 hours (most complex)
- Service metric tests: 2-3 hours
- Status/lifecycle tests: 2-3 hours
- Documentation/review: 1 hour

**Expected Outcome**: 80%+ line coverage, ~95 test cases, comprehensive error handling validation, production-ready test suite.
