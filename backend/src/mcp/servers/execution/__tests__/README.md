# Workflow Execution Tests

Comprehensive test suite for UC-EXEC-001 through UC-EXEC-006 (Workflow Execution MCP Tools).

## Test Structure

### Test Files

| File | Use Case | Test Type | Count |
|------|----------|-----------|-------|
| `execute_story_with_workflow.test.ts` | UC-EXEC-001 | Unit | 4 tests |
| `execute_epic_with_workflow.test.ts` | UC-EXEC-002 | Unit | 3 tests |
| `get_workflow_run_results.test.ts` | UC-EXEC-003 | Unit | 2 tests |
| `list_workflows.test.ts` | UC-EXEC-004 | Unit | 2 tests |
| `assign_workflow_to_story.test.ts` | UC-EXEC-005 | Unit | 3 tests |
| `list_workflow_runs.test.ts` | UC-EXEC-006 | Unit | 3 tests |
| `execute_story_with_workflow.integration.test.ts` | UC-EXEC-001 | Integration | 2 tests |
| `execute_story_with_workflow.e2e.test.ts` | UC-EXEC-001 | E2E | 1 test |
| `integration-e2e-tests.ts` | UC-EXEC-002-006 | Integration/E2E | 10 tests |

**Total: 30 test specifications** (17 unit, 8 integration, 6 E2E)

### Test Setup

- `test-setup.ts` - Common fixtures, mocks, and test utilities
- `jest.config.js` - Jest configuration (root level)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test execute_story_with_workflow.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Validate story exists"
```

## Test Coverage

Current implementation status:
- ✅ **Unit tests**: Fully implemented with mocks
- ⚠️ **Integration tests**: Specifications created, require database setup
- ⚠️ **E2E tests**: Specifications created, require full system setup

### Unit Test Coverage

Unit tests use `jest-mock-extended` to mock Prisma Client:
- No database required
- Fast execution
- Focus on validation logic and error handling
- Test individual handler functions in isolation

### Integration Test Requirements

Integration tests are currently marked as `.skip` and require:
- Test database connection
- Test data fixtures
- Transaction rollback for cleanup
- Real Prisma Client (not mocked)

To enable integration tests:
1. Set up test database
2. Configure `DATABASE_URL` for tests
3. Create test data fixtures
4. Implement cleanup/teardown
5. Remove `.skip` from tests

### E2E Test Requirements

E2E tests are specifications and require:
- Complete system running (backend + database)
- Workflow components configured
- Real MCP tool execution
- Full request/response cycle testing

## Test Specifications in Database

All 31 test cases are documented in the database (`TestCase` table):
- Linked to use cases via `useCaseId`
- Include preconditions, test steps, expected results
- Track implementation status (pending → implemented → automated)
- Enable traceability: Use Case → Test Case → Test File

Query test cases:
```typescript
// Get all test cases for a use case
await prisma.testCase.findMany({
  where: { useCaseId: 'UC-EXEC-001-id' }
});

// Check test coverage
const coverage = await get_use_case_coverage({
  useCaseId: 'UC-EXEC-001-id'
});
```

## Test Fixtures

Common test fixtures are defined in `test-setup.ts`:
- `fixtures.project` - Test project
- `fixtures.epic` - Test epic
- `fixtures.story` - Test story (planning status)
- `fixtures.storyDone` - Completed story
- `fixtures.workflow` - Active workflow
- `fixtures.workflowInactive` - Inactive workflow
- `fixtures.workflowRun` - Running workflow execution
- `fixtures.component` - Test component
- `fixtures.componentRun` - Completed component run

Helper functions:
- `createStoryWithRunningWorkflow()` - Story with active execution
- `createEpicWithStories(count)` - Epic with N stories
- `createWorkflowWithComponents()` - Workflow with components

## Example Test

```typescript
describe('Validate story exists', () => {
  it('should throw error when story not found', async () => {
    // Arrange
    const params = {
      storyId: 'non-existent',
      workflowId: fixtures.workflow.id,
    };

    prismaMock.story.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(handler(prismaMock, params)).rejects.toThrow(
      'Story with ID non-existent not found'
    );

    // Verify no WorkflowRun created
    expect(prismaMock.workflowRun.create).not.toHaveBeenCalled();
  });
});
```

## Next Steps

1. **Run unit tests**: `npm test` (should pass immediately)
2. **Set up integration tests**: Configure test database
3. **Implement E2E tests**: Set up full system test environment
4. **Update test statuses**: Mark tests as "implemented" in database
5. **Add CI/CD**: Run tests on every commit

## Traceability

Each test maps to:
- **Test Case** in database (TC-EXEC-XXX-YZ)
- **Use Case** (UC-EXEC-001 through UC-EXEC-006)
- **Story** (ST-12: MCP execution tool)
- **Implementation file** (e.g., `execute_story_with_workflow.ts`)

Query traceability:
```bash
# View use case coverage
npm run mcp:dev
# Then call: get_use_case_coverage({ useCaseId: "..." })

# View component coverage
# Call: get_component_test_coverage({ projectId: "...", component: "Workflow Execution" })
```
