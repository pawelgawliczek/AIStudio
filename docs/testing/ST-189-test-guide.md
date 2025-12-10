# ST-189 Test Execution Guide

Quick reference for running the ST-189 Docker Runner Transcript Registration tests.

## Test Files

1. **Backend Service:** `backend/src/runner/__tests__/runner.service.registerTranscript.test.ts`
2. **Agent Session:** `runner/src/cli/__tests__/agent-session.test.ts`
3. **Master Session:** `runner/src/cli/__tests__/master-session.test.ts`

## Quick Commands

### Run All ST-189 Tests

```bash
# Backend tests
cd /Users/pawelgawliczek/projects/AIStudio/backend
npm test -- runner.service.registerTranscript

# Runner tests
cd /Users/pawelgawliczek/projects/AIStudio/runner
npm test -- "agent-session|master-session"
```

### Run Individual Test Files

```bash
# Backend service tests (38 tests)
cd backend
npm test src/runner/__tests__/runner.service.registerTranscript.test.ts

# Agent session tests (35 tests)
cd runner
npm test src/cli/__tests__/agent-session.test.ts

# Master session tests (31 tests)
cd runner
npm test src/cli/__tests__/master-session.test.ts
```

### Run Specific Test Suites

```bash
# Just master transcript registration tests
npm test -- -t "Master Transcript Registration"

# Just agent transcript registration tests
npm test -- -t "Agent Transcript Registration"

# Just validation tests
npm test -- -t "Validation and Error Handling"

# Just path formatting tests
npm test -- -t "Transcript Path Formatting"
```

### Watch Mode (Development)

```bash
# Backend tests in watch mode
cd backend
npm test -- --watch runner.service.registerTranscript

# Runner tests in watch mode
cd runner
npm test -- --watch "agent-session|master-session"
```

### Coverage Report

```bash
# Backend tests with coverage
cd backend
npm test -- --coverage runner.service.registerTranscript

# Runner tests with coverage
cd runner
npm test -- --coverage "agent-session|master-session"
```

## Test Output Examples

### Success Output
```
PASS  src/runner/__tests__/runner.service.registerTranscript.test.ts
  RunnerService.registerTranscript - ST-189
    Master Transcript Registration
      ✓ should register master transcript successfully (5 ms)
      ✓ should append to existing masterTranscriptPaths array (3 ms)
      ✓ should not duplicate master transcript paths (2 ms)
      ...
    Agent Transcript Registration
      ✓ should register agent transcript successfully (4 ms)
      ✓ should append to existing spawnedAgentTranscripts array (3 ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total
Snapshots:   0 total
Time:        2.145 s
```

### Failure Output
```
FAIL  src/runner/__tests__/runner.service.registerTranscript.test.ts
  ● RunnerService.registerTranscript - ST-189 › Master Transcript Registration › should register master transcript successfully

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: objectContaining({"data": objectContaining({"masterTranscriptPaths": ["/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-abc123.jsonl"]})})
    Received: {"where": {"id": "run-123"}, "data": {"masterTranscriptPaths": []}}

      125 |       // Verify database update
      126 |       expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
    > 127 |         where: { id: 'run-123' },
          |                                          ^
      128 |         data: {
      129 |           masterTranscriptPaths: [dto.transcriptPath],
      130 |           metadata: expect.objectContaining({
```

## Test Debugging

### Enable Verbose Logging
```bash
# Run tests with console output
npm test -- --verbose runner.service.registerTranscript

# Run tests with full error messages
npm test -- --expand runner.service.registerTranscript
```

### Run Single Test
```bash
# Use .only() in test file temporarily
it.only('should register master transcript successfully', async () => {
  // test code
});

# Or filter by name
npm test -- -t "should register master transcript successfully"
```

### Check Test File Syntax
```bash
# TypeScript compilation check
cd backend
npx tsc --noEmit src/runner/__tests__/runner.service.registerTranscript.test.ts

cd runner
npx tsc --noEmit src/cli/__tests__/agent-session.test.ts
npx tsc --noEmit src/cli/__tests__/master-session.test.ts
```

## Troubleshooting

### Issue: "Cannot find module '@prisma/client'"

**Solution:**
```bash
cd backend
npm install
npx prisma generate
```

### Issue: "Jest mock not working"

**Solution:**
```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Tests timing out"

**Solution:**
```bash
# Increase Jest timeout
npm test -- --testTimeout=10000
```

### Issue: "Module resolution errors in runner tests"

**Solution:**
```bash
cd runner
npm install
npm run build
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: ST-189 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Backend tests
      - name: Run Backend Tests
        run: |
          cd backend
          npm ci
          npm test -- runner.service.registerTranscript

      # Runner tests
      - name: Run Runner Tests
        run: |
          cd runner
          npm ci
          npm test -- "agent-session|master-session"
```

## Pre-Commit Hook

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash

echo "Running ST-189 tests..."

# Backend tests
cd backend && npm test -- --bail runner.service.registerTranscript
BACKEND_EXIT=$?

# Runner tests
cd ../runner && npm test -- --bail "agent-session|master-session"
RUNNER_EXIT=$?

if [ $BACKEND_EXIT -ne 0 ] || [ $RUNNER_EXIT -ne 0 ]; then
  echo "❌ ST-189 tests failed. Commit aborted."
  exit 1
fi

echo "✅ ST-189 tests passed."
exit 0
```

## Test Maintenance

### Adding New Tests

1. Follow existing test structure
2. Use descriptive test names starting with "should"
3. Group related tests in `describe()` blocks
4. Mock all external dependencies
5. Test both success and error cases

### Updating Tests After Code Changes

1. Run tests to identify failures
2. Update test expectations to match new behavior
3. Add new tests for new functionality
4. Remove obsolete tests
5. Verify coverage remains >90%

## Related Commands

```bash
# Lint test files
npm run lint -- --fix **/__tests__/*.test.ts

# Format test files
npm run format -- **/__tests__/*.test.ts

# Type check test files
npx tsc --noEmit --project tsconfig.test.json
```

## Test Quality Metrics

Target metrics for ST-189 tests:
- **Execution Time:** < 5 seconds total
- **Line Coverage:** > 90%
- **Branch Coverage:** > 85%
- **Mutation Score:** > 80% (if using mutation testing)
- **Flakiness:** 0% (tests should be deterministic)
