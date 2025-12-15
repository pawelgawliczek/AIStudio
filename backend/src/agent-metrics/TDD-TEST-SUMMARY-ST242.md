# ST-242: TDD Test Summary

## Overview
Comprehensive TDD tests written for ST-242: Telemetry metrics not populated.

These tests define the expected behavior BEFORE implementation. They will initially fail, and the implementer should make them pass.

## Test Files Created

### 1. Unit Tests: `backend/src/mcp/utils/__tests__/pricing.test.ts`
**Purpose**: Test the centralized pricing utility at `backend/src/mcp/utils/pricing.ts`

**Coverage**:
- ✅ Model family extraction from various model ID formats
  - New format: `claude-sonnet-4-5-20250929` → `claude-sonnet-4-5`
  - Legacy format: `claude-3-5-haiku-20241022` → `claude-haiku-3-5`
  - Edge cases: null, undefined, unknown models → `default`

- ✅ Cost calculation from token metrics
  - Input tokens only
  - Output tokens only
  - Combined input + output
  - Cache creation tokens (1.25x input price)
  - Cache read tokens (0.1x input price)
  - All token types combined

- ✅ Multi-model pricing support
  - Claude Opus 4.5: $5.00 input, $25.00 output
  - Claude Sonnet 4: $3.00 input, $15.00 output
  - Claude Haiku 3.5: $0.80 input, $4.00 output
  - Default fallback pricing

- ✅ Cost breakdown for debugging
  - Detailed breakdown with inputCost, outputCost, cacheWriteCost, cacheReadCost
  - Model family and pricing details included
  - Matches `calculateCost()` total

- ✅ Cost formatting for display
  - Zero costs: `$0.00`
  - Small costs: `$0.0123` (4 decimals)
  - Very small costs: exponential notation
  - Custom precision support

**Test Count**: 50+ test cases covering all edge cases

---

### 2. E2E Tests: `backend/src/e2e/ep8-story-runner/st242-telemetry-metrics.e2e.test.ts`
**Purpose**: End-to-end integration test using REAL MCP commands on PRODUCTION database

**Test Phases**:

#### Phase 0: Setup
- Create test project, epic, story
- Create 2 test components (Explorer, Architect)
- Create workflow with 2 states

#### Phase 1: Component Execution with Token Metrics
- **Component 1 (Explorer)**: Large cache creation
  - Input: 25K tokens
  - Output: 5K tokens
  - Cache creation: 100K tokens
  - Model: `claude-sonnet-4-20250514`
  - Expected cost: $0.525

- **Component 2 (Architect)**: Large cache read
  - Input: 15K tokens
  - Output: 8K tokens
  - Cache read: 80K tokens
  - Model: `claude-opus-4-5-20251101`
  - Expected cost: $0.315

#### Phase 2: Verify Component Run Metrics
- ✅ `ComponentRun.cost > 0` for both components
- ✅ Cost matches expected calculated value
- ✅ Token breakdown correct:
  - `tokensInput` stored correctly
  - `tokensOutput` stored correctly
  - `totalTokens = tokensInput + tokensOutput + tokensCacheCreation + tokensCacheRead`
- ✅ `modelId` stored correctly

#### Phase 3: Verify Workflow Run Aggregation
- ✅ `WorkflowRun.estimatedCost > 0`
- ✅ `WorkflowRun.estimatedCost = sum(ComponentRun.cost)`
- ✅ Token totals aggregated correctly:
  - `totalTokensInput = sum(ComponentRun.tokensInput)`
  - `totalTokensOutput = sum(ComponentRun.tokensOutput)`
  - `totalTokens = sum(ComponentRun.totalTokens)`

#### Phase 4: Edge Cases
- ✅ Null token values → cost = $0.00
- ✅ Unknown model ID → uses default pricing
- ✅ Zero tokens → cost = $0.00

**Test Count**: 20+ end-to-end scenarios

---

## Running the Tests

### Run Unit Tests Only
```bash
cd /Users/pawelgawliczek/projects/AIStudio/backend
npm test -- pricing.test.ts
```

### Run E2E Tests Only
```bash
cd /Users/pawelgawliczek/projects/AIStudio/backend
npm run test:e2e -- st242-telemetry-metrics.e2e.test.ts
```

### Run All ST-242 Tests
```bash
cd /Users/pawelgawliczek/projects/AIStudio/backend
npm test -- --testNamePattern="ST-242|pricing"
```

---

## Expected Test Results (Before Fix)

### Currently FAILING (Expected)
These tests will fail until the implementation is fixed:

1. **Unit Tests**: All pricing utility tests should PASS (utility already exists)
2. **E2E Tests**: Will FAIL because:
   - ❌ `ComponentRun.cost` is NULL or 0 (not calculated)
   - ❌ `WorkflowRun.estimatedCost` is NULL or 0 (not aggregated)
   - ❌ `totalTokens` calculation incorrect (missing cache tokens)

### After Implementation (Expected)
All tests should PASS:
- ✅ Cost calculated correctly using pricing utility
- ✅ Token breakdown includes cache tokens
- ✅ Workflow-level aggregation working
- ✅ Edge cases handled gracefully

---

## Implementation Guidance

The tests reveal the fixes needed in `record_component_complete.ts`:

1. **Import pricing utility**:
   ```typescript
   import { calculateCost } from '../../utils/pricing';
   ```

2. **Calculate cost when storing ComponentRun**:
   ```typescript
   const cost = calculateCost({
     tokensInput: transcriptMetrics?.inputTokens || 0,
     tokensOutput: transcriptMetrics?.outputTokens || 0,
     tokensCacheCreation: transcriptMetrics?.cacheCreationTokens || 0,
     tokensCacheRead: transcriptMetrics?.cacheReadTokens || 0,
     modelId: transcriptMetrics?.model || component.config.modelId,
   });
   ```

3. **Fix totalTokens calculation**:
   ```typescript
   const totalTokens =
     (transcriptMetrics?.inputTokens || 0) +
     (transcriptMetrics?.outputTokens || 0) +
     (transcriptMetrics?.cacheCreationTokens || 0) +
     (transcriptMetrics?.cacheReadTokens || 0);
   ```

4. **Update ComponentRun**:
   ```typescript
   await prisma.componentRun.update({
     where: { id: componentRunId },
     data: {
       cost,
       totalTokens,
       // ... other fields
     },
   });
   ```

5. **Aggregate to WorkflowRun**:
   ```typescript
   const allRuns = await prisma.componentRun.findMany({
     where: { workflowRunId },
   });

   const estimatedCost = allRuns.reduce((sum, run) => sum + (run.cost || 0), 0);

   await prisma.workflowRun.update({
     where: { id: workflowRunId },
     data: { estimatedCost },
   });
   ```

---

## Test Patterns Used

### From `st147-session-telemetry.e2e.test.ts`
- ✅ Component execution with transcript metrics
- ✅ Token metrics validation
- ✅ Turn counting patterns (not used in ST-242, but available)

### From `st161-real-mcp-commands.e2e.test.ts`
- ✅ Real MCP command execution
- ✅ Production database access
- ✅ Full workflow lifecycle testing

### From `content-security.test.ts`
- ✅ TDD approach (tests before implementation)
- ✅ Comprehensive edge case coverage
- ✅ Clear test organization

---

## Success Criteria

All tests must pass with:
1. ✅ No failing assertions
2. ✅ Cost values > 0 for components with tokens
3. ✅ Cost values = 0 for components with null/zero tokens
4. ✅ Aggregation math correct (sum matches)
5. ✅ Token breakdown matches formula
6. ✅ Edge cases handled without errors

---

## Notes for Implementer

- The pricing utility (`pricing.ts`) already exists and is correct
- Tests are written in TDD style - they define the contract
- DO NOT modify the tests to make them pass
- ONLY modify the implementation (`record_component_complete.ts`)
- Run tests frequently during implementation
- All tests should pass before marking ST-242 as complete
