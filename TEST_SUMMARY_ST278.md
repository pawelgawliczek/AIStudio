# ST-278: Test Summary - Accurate Per-Phase LOC Tracking

## TDD Approach - Tests Written BEFORE Implementation

Following Test-Driven Development (TDD) principles, all tests for ST-278 have been written **before** the actual feature implementation. These tests are expected to **FAIL** until the implementation is complete.

---

## Test Files Created

### 1. `/scripts/__tests__/exec-command.test.ts`

**Purpose:** Test whitelisting of `git rev-parse` commands in exec-command.ts

**Test Categories:**
- **Git Rev-Parse Command Whitelist** (6 tests)
  - `git rev-parse HEAD`
  - `git rev-parse --short HEAD`
  - `git rev-parse --verify HEAD`
  - `git rev-parse main`
  - Various ref formats (HEAD~1, HEAD^, origin/main)

- **Existing Whitelist Still Works** (2 tests)
  - `git diff` commands continue to work
  - `git status` commands continue to work

- **Security: Dangerous Commands Still Blocked** (3 tests)
  - `git push` blocked
  - `git reset` blocked
  - Arbitrary shell commands blocked

- **Parameter Validation** (3 tests)
  - --command parameter required
  - --cwd parameter required
  - cwd must be valid directory

- **Return Value Format** (2 tests)
  - Returns stdout, stderr, exitCode, command
  - Commit hash format validation

**Total:** 16 tests

---

### 2. `/backend/src/mcp/shared/__tests__/agent-tracking.test.ts` (ST-278 section added)

**Purpose:** Test startCommitHash capture and usage in agent tracking

**Test Categories:**
- **startCommitHash Tracking for Accurate LOC** (4 tests)
  - Capture startCommitHash when starting agent
  - Use startCommitHash for git diff when completing agent
  - Fallback to main...HEAD when startCommitHash is null
  - Handle git rev-parse failure gracefully

**Total:** 4 new tests added to existing file

**Key Assertions:**
```typescript
// Test 1: startCommitHash captured
expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
  'exec-command',
  expect.arrayContaining([
    '--command=git rev-parse HEAD',
    '--cwd=/opt/stack/worktrees/st-278',
  ]),
  expect.objectContaining({ requestedBy: 'startAgentTracking' })
);

expect(prisma.componentRun.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
    metadata: expect.objectContaining({
      startCommitHash: 'abc123def456',
    }),
  }),
});

// Test 2: startCommitHash used for diff
expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
  'exec-command',
  expect.arrayContaining([
    '--command=git diff start-commit-hash...HEAD --numstat',
  ]),
  expect.any(Object)
);

// Test 3: Fallback to main...HEAD
expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
  'exec-command',
  expect.arrayContaining([
    '--command=git diff main...HEAD --numstat',
  ]),
  expect.any(Object)
);
```

---

### 3. `/backend/src/mcp/servers/runner/__tests__/get_current_step-st278.test.ts`

**Purpose:** Test orchestrator-driven commit instructions in workflowSequence

**Test Categories:**
- **Code-Modifying Components - Commit Step in workflowSequence** (5 tests)
  - Implementer gets commit step
  - Developer gets commit step
  - Tester gets commit step
  - Reviewer gets commit step
  - Commit message format validation

- **Non-Code-Modifying Components - No Commit Step** (4 tests)
  - Explorer does NOT get commit step
  - Architect does NOT get commit step
  - PM does NOT get commit step
  - Analyst does NOT get commit step

- **Step Numbering with Commit Step** (1 test)
  - Steps numbered correctly: 1=spawn, 2=commit, 3=advance

- **Commit Command Format** (2 tests)
  - Includes --cwd parameter
  - Uses `git add -A && git commit`

**Total:** 12 tests

**Key Assertions:**
```typescript
// Code-modifying component gets 3 steps
expect(result.workflowSequence.length).toBe(3);
expect(result.workflowSequence[0].type).toBe('agent_spawn');
expect(result.workflowSequence[1].type).toBe('mcp_tool');
expect(result.workflowSequence[1].tool).toBe('exec-command');
expect(result.workflowSequence[1].description).toContain('Commit');
expect(result.workflowSequence[2].tool).toBe('advance_step');

// Non-code component gets 2 steps (no commit)
expect(result.workflowSequence.length).toBe(2);
expect(result.workflowSequence[0].type).toBe('agent_spawn');
expect(result.workflowSequence[1].tool).toBe('advance_step');

const hasCommitStep = result.workflowSequence.some(
  (step: any) => step.tool === 'exec-command'
);
expect(hasCommitStep).toBe(false);
```

---

### 4. `/backend/src/mcp/servers/runner/__tests__/advance_step-st278.test.ts`

**Purpose:** Test commitBeforeAdvance return value for orchestrator guidance

**Test Categories:**
- **Code-Modifying Components - Return commitBeforeAdvance** (4 tests)
  - Implementer returns commitBeforeAdvance
  - Developer returns commitBeforeAdvance
  - Tester returns commitBeforeAdvance
  - Reviewer returns commitBeforeAdvance

- **Non-Code-Modifying Components - No commitBeforeAdvance** (3 tests)
  - Explorer does NOT return commitBeforeAdvance
  - Architect does NOT return commitBeforeAdvance
  - PM does NOT return commitBeforeAdvance

- **commitBeforeAdvance Structure** (3 tests)
  - Correct parameters structure
  - Story key included in commit message
  - Component name included in commit message

- **Edge Cases** (3 tests)
  - No commitBeforeAdvance when advancing pre -> agent
  - No commitBeforeAdvance for failed agents
  - No commitBeforeAdvance when state has no component

**Total:** 13 tests

**Key Assertions:**
```typescript
// Code-modifying component returns commitBeforeAdvance
expect(result.commitBeforeAdvance).toBeDefined();
expect(result.commitBeforeAdvance.tool).toBe('exec-command');
expect(result.commitBeforeAdvance.parameters).toEqual(
  expect.objectContaining({
    command: expect.stringMatching(/git add -A.*&&.*git commit/),
    cwd: expect.stringMatching(/worktrees|AIStudio/),
  })
);
expect(result.commitBeforeAdvance.description).toContain('Implementer');
expect(result.commitBeforeAdvance.parameters.command).toContain('ST-278');

// Non-code component does NOT return commitBeforeAdvance
expect(result.commitBeforeAdvance).toBeUndefined();
```

---

## Component Classification

### Code-Modifying Components (GET commit steps)
- **Implementer** - Writes production code
- **Developer** - General development work
- **Tester** - Writes test code
- **Reviewer** - Makes review-driven code changes

### Non-Code-Modifying Components (NO commit steps)
- **Explorer** - Reads and analyzes codebase
- **Architect** - Creates design documents
- **PM** - Planning and analysis
- **Analyst** - Business analysis

---

## Running the Tests

### Run All ST-278 Tests
```bash
# Backend tests
npm test -- agent-tracking.test
npm test -- get_current_step-st278.test
npm test -- advance_step-st278.test

# Scripts tests
npx jest scripts/__tests__/exec-command.test.ts
```

### Expected Result
**ALL TESTS SHOULD FAIL** until the implementation is complete. This is the expected behavior in TDD.

---

## Implementation Checklist

Based on the tests, the following implementations are required:

### A. `scripts/exec-command.ts`
- [ ] Add `git rev-parse` to ALLOWED_COMMANDS whitelist
- [ ] Update whitelist regex: `/^git rev-parse(\s|$)/`

### B. `backend/src/mcp/shared/agent-tracking.ts`

**startAgentTracking:**
- [ ] Add helper function `getHeadCommit(projectPath: string): Promise<string | null>`
- [ ] Call `git rev-parse HEAD` before creating ComponentRun
- [ ] Store commit hash in ComponentRun.metadata.startCommitHash
- [ ] Handle git failure gracefully (non-fatal warning)

**completeAgentTracking:**
- [ ] Check for ComponentRun.metadata.startCommitHash
- [ ] If present, use `git diff {startCommitHash}...HEAD --numstat`
- [ ] If missing, fallback to `git diff main...HEAD --numstat`
- [ ] Update git diff call logic

### C. `backend/src/mcp/servers/runner/get_current_step.ts`
- [ ] Detect code-modifying components (Implementer, Developer, Tester, Reviewer)
- [ ] Insert commit step in workflowSequence for agent phase
- [ ] Commit step structure:
  ```typescript
  {
    step: 2,
    type: 'mcp_tool',
    tool: 'exec-command',
    description: 'Commit {component} changes before advancing',
    parameters: {
      command: 'git add -A && git commit -m "wip: {storyKey} - {component} phase"',
      cwd: '{projectPath}',
    },
    notes: 'Orchestrator executes this commit to capture code changes',
  }
  ```
- [ ] Renumber subsequent steps (advance_step becomes step 3)

### D. `backend/src/mcp/servers/runner/advance_step.ts`
- [ ] Detect code-modifying components when advancing agent -> post
- [ ] Return `commitBeforeAdvance` object in response
- [ ] Structure:
  ```typescript
  {
    tool: 'exec-command',
    parameters: {
      command: 'git add -A && git commit -m "wip: {storyKey} - {component} phase"',
      cwd: '{projectPath}',
    },
    description: 'Commit {component} changes',
  }
  ```
- [ ] Do NOT return commitBeforeAdvance for:
  - Non-code components
  - Failed agents (agentStatus === 'failed')
  - Phase transitions other than agent -> post

---

## Test Coverage Summary

| File | Tests Added | Focus Area |
|------|-------------|------------|
| `exec-command.test.ts` | 16 | Git rev-parse whitelist |
| `agent-tracking.test.ts` | 4 | Commit hash tracking |
| `get_current_step-st278.test.ts` | 12 | Orchestrator commit steps |
| `advance_step-st278.test.ts` | 13 | commitBeforeAdvance logic |
| **TOTAL** | **45 tests** | **Full feature coverage** |

---

## Success Criteria

When implementation is complete, all 45 tests should pass:

✅ `git rev-parse` whitelisted in exec-command
✅ startCommitHash captured when agent starts
✅ startCommitHash used for precise git diff
✅ Fallback to main...HEAD when startCommitHash missing
✅ Code-modifying components get commit steps in workflowSequence
✅ Non-code components do NOT get commit steps
✅ advance_step returns commitBeforeAdvance for code components
✅ advance_step does NOT return commitBeforeAdvance for non-code components

---

## Commands to Run Tests

```bash
# Test exec-command whitelist
npx jest --testNamePattern="exec-command"

# Test agent tracking
npx jest --testNamePattern="ST-278: startCommitHash"

# Test get_current_step
npx jest --testPathPattern="get_current_step-st278"

# Test advance_step
npx jest --testPathPattern="advance_step-st278"

# Run all ST-278 tests
npx jest --testNamePattern="ST-278"
```

---

## Notes

1. **All tests are intentionally failing** - This is correct TDD behavior
2. **Tests define expected behavior** - Implementation should make tests pass
3. **No implementation code was written** - Tests written first
4. **Tests follow existing patterns** - Based on existing test files in codebase
5. **Comprehensive coverage** - Tests cover happy paths, edge cases, and error scenarios

---

**Next Step:** Implement the features to make these tests pass!
