# Test Plan for task-prompt-builder Module

**Story:** ST-289 - Enhanced Task Spawning Instructions in get_current_step and advance_step
**Test File:** `backend/src/mcp/shared/__tests__/task-prompt-builder.test.ts`
**Status:** Tests written (FAILING - implementation pending)

## Test Coverage Summary

### 1. `deriveSubagentType()` Function
- **Purpose:** Maps Component.executionType to Task subagent type
- **Test Cases:**
  - ✓ `native_explore` → `"Explore"`
  - ✓ `native_plan` → `"Plan"`
  - ✓ `native_general` → `"general-purpose"`
  - ✓ `custom` → `"general-purpose"`
  - ✓ Unknown types → `"general-purpose"`
  - ✓ Empty string → `"general-purpose"`
  - ✓ Case insensitivity handling

### 2. `formatPreviousOutputs()` Function
- **Purpose:** Formats componentSummary from previous component runs for agent context
- **Test Cases:**
  - ✓ Empty array returns empty string
  - ✓ Single structured summary (JSON format)
  - ✓ Multiple structured summaries
  - ✓ Legacy text-only summaries (backward compatibility)
  - ✓ Null componentSummary handling
  - ✓ Invalid JSON handling
  - ✓ Structured format fields:
    - status (success/partial/blocked/failed)
    - summary
    - keyOutputs
    - nextAgentHints
    - artifactsProduced
    - errors

### 3. `formatArtifactInstructions()` Function
- **Purpose:** Generates artifact access instructions based on state's access rules
- **Test Cases:**
  - ✓ No artifact access rules → empty string
  - ✓ Read-only artifacts with get_artifact instructions
  - ✓ Write artifacts with upload_artifact instructions
  - ✓ Required artifacts (CRITICAL flag)
  - ✓ Grouping by access type (required, read, write)
  - ✓ Existing vs new artifact detection
  - ✓ Missing artifact definitions (graceful handling)
  - ✓ Section ordering: required → read → write

### 4. `buildTaskPrompt()` Function
- **Purpose:** Builds complete Task prompt from all components
- **Test Cases:**
  - ✓ Full prompt with all sections
  - ✓ Missing pre-execution instructions
  - ✓ Missing component instructions
  - ✓ No previous component runs
  - ✓ No artifact access rules
  - ✓ Correct section ordering:
    1. Context (pre-execution)
    2. Input
    3. Task
    4. Output
    5. Previous outputs
    6. Artifact instructions
  - ✓ Database error handling
  - ✓ Markdown special character preservation

### 5. Integration Tests
- **Purpose:** End-to-end workflow scenarios
- **Test Cases:**
  - ✓ Explorer component (native_explore) with required artifacts
  - ✓ Implementer component (custom) with previous runs and hints

## Expected Test Results

**Current Status:** ALL TESTS FAILING ✗
**Reason:** Implementation module `../task-prompt-builder.ts` does not exist yet

### Error Message:
```
Cannot find module '../task-prompt-builder' from 'src/mcp/shared/__tests__/task-prompt-builder.test.ts'
```

This is **expected behavior** for Test-Driven Development (TDD):
1. Write tests first (DONE)
2. Tests fail because implementation doesn't exist (CURRENT STATE)
3. Implement the module (NEXT STEP)
4. Tests pass (FINAL STATE)

## Running the Tests

```bash
# Run only task-prompt-builder tests
npm test -- --testPathPattern="task-prompt-builder"

# Run with coverage
npm test -- --testPathPattern="task-prompt-builder" --coverage

# Watch mode (for development)
npm test -- --testPathPattern="task-prompt-builder" --watch
```

## Implementation Requirements (from tests)

The implementation module must export:

```typescript
// Function signatures derived from test expectations
export function deriveSubagentType(executionType: string): string;

export function formatPreviousOutputs(
  componentRuns: Array<{
    id: string;
    componentName: string;
    componentSummary: string | null;
  }>
): string;

export async function formatArtifactInstructions(
  prisma: PrismaClient,
  stateId: string,
  storyId: string
): Promise<string>;

export async function buildTaskPrompt(
  prisma: PrismaClient,
  state: {
    id: string;
    preExecutionInstructions: string | null;
    component: {
      id: string;
      name: string;
      executionType: string;
      inputInstructions: string | null;
      operationInstructions: string | null;
      outputInstructions: string | null;
    };
  },
  runId: string,
  storyId: string
): Promise<string>;
```

## Test Statistics

- **Total Test Suites:** 1
- **Total Test Cases:** 40+
- **Test Categories:**
  - Unit tests: 35
  - Integration tests: 2
  - Edge case tests: 8

## Next Steps for Implementer

1. Create `/Users/pawelgawliczek/projects/AIStudio/backend/src/mcp/shared/task-prompt-builder.ts`
2. Implement the four exported functions according to test expectations
3. Run tests iteratively: `npm test -- --testPathPattern="task-prompt-builder" --watch`
4. Fix implementation until all tests pass
5. Integration: Update `get_current_step.ts` and `advance_step.ts` to use the new module

## Coverage Targets

- **Line Coverage:** 100% (all functions must be tested)
- **Branch Coverage:** >95% (all edge cases covered)
- **Function Coverage:** 100% (all exported functions tested)
