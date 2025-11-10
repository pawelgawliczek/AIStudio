# E2E Tests with Playwright

Comprehensive end-to-end tests for AI Studio MCP Control Plane Sprint 4 features.

## Test Coverage

### 01. Story Workflow (`01-story-workflow.spec.ts`)
- ✅ Display story in planning state by default
- ✅ Transition story from planning to analysis
- ✅ Transition through all 8 workflow states
- ✅ Prevent invalid state transitions
- ✅ Allow admin to override workflow
- ✅ Display workflow history
- ✅ Require complexity fields before implementation

### 02. Subtask Management (`02-subtask-management.spec.ts`)
- ✅ Create new subtask
- ✅ Update subtask status
- ✅ Edit subtask details
- ✅ Delete subtask
- ✅ Filter subtasks by layer
- ✅ Assign subtask to agent or human
- ✅ Display subtasks grouped by status

### 03. Story Filtering (`03-story-filtering.spec.ts`)
- ✅ Display all stories by default
- ✅ Filter stories by status
- ✅ Filter stories by epic
- ✅ Filter stories by complexity
- ✅ Search stories by title
- ✅ Search stories by description
- ✅ Combine multiple filters
- ✅ Sort stories by created date
- ✅ Sort stories by complexity
- ✅ Clear all filters
- ✅ Paginate stories

### 04. WebSocket Real-time Updates (`04-websocket-realtime.spec.ts`)
- ✅ Receive real-time story creation notification
- ✅ Receive real-time story status update
- ✅ Receive real-time subtask creation
- ✅ Receive real-time subtask status update
- ✅ Show active users indicator
- ✅ Show typing indicator
- ✅ Handle connection loss gracefully
- ✅ Sync missed updates after reconnection

### 05. Epic & Navigation (`05-epic-project-navigation.spec.ts`)
- ✅ Display project selector in navbar
- ✅ Switch between projects
- ✅ Create new epic
- ✅ Display epic key automatically
- ✅ Update epic details
- ✅ Delete epic with confirmation
- ✅ Prevent deleting epic with stories
- ✅ View epic details with story list
- ✅ Navigate using breadcrumbs
- ✅ Search projects in selector

## Running Tests

### Prerequisites

1. **Start Docker services:**
   ```bash
   npm run docker:up
   ```

2. **Run database migrations:**
   ```bash
   npm run db:migrate:dev
   ```

### Run All Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

### Run Specific Tests

```bash
# Run story workflow tests only
npx playwright test 01-story-workflow

# Run subtask tests only
npx playwright test 02-subtask-management

# Run with specific browser
npx playwright test --project=chromium
```

### View Test Report

```bash
# Open HTML report
npm run test:e2e:report
```

## Test Data

Tests use the following test users:
- **Admin**: `admin@aistudio.local` / `Admin123!`
- **PM**: `pm@aistudio.local` / `PM123!`
- **Developer**: `dev@aistudio.local` / `Dev123!`

Test data is:
- Created in `beforeAll` hooks
- Cleaned up in `afterAll` hooks
- Isolated per test file

## Test Architecture

### Utilities (`utils/`)
- **auth.helper.ts**: Authentication utilities (login, logout, get token)
- **api.helper.ts**: API client for direct API calls
- **db.helper.ts**: Database seeding and cleanup

### Test Strategy
1. **Setup**: Create test users and base project data
2. **Test**: Execute user interactions via Playwright
3. **Verify**: Check both UI and API state
4. **Cleanup**: Remove test data

### Data-testid Convention

All interactive elements have `data-testid` attributes:
- `story-{id}`: Story card
- `subtask-{id}`: Subtask card
- `epic-{id}`: Epic card
- `project-option-{id}`: Project in selector
- Action buttons: `create-story`, `edit-story`, `delete-story`
- Status indicators: `current-status`, `story-status`
- Filters: `filter-status`, `filter-epic`, `filter-tech-complexity`
- Search: `search-stories`, `search-projects`

## CI/CD Integration

Tests are configured to run in CI with:
- Sequential execution (no parallel)
- 2 retries on failure
- Screenshot on failure
- Video on failure
- JUnit XML report output

### GitHub Actions Example

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/aistudio_test
```

## Debugging

### View Test in Browser

```bash
npm run test:e2e:headed
```

### Debug Specific Test

```bash
npx playwright test 01-story-workflow --debug
```

### Inspect Test Report

```bash
npm run test:e2e:report
```

### View Screenshots

After test failures, screenshots are saved to:
```
playwright-report/
└── test-results/
    └── {test-name}/
        └── screenshot.png
```

## Best Practices

1. **Use data-testid**: Always select elements by `data-testid` for stability
2. **Wait for elements**: Use `waitForSelector` before interactions
3. **Verify via API**: Confirm state changes via API after UI actions
4. **Clean up**: Always clean up test data in `afterAll`
5. **Isolation**: Each test should be independent
6. **Real scenarios**: Test actual user workflows, not just happy paths

## Common Issues

### Tests Timeout

**Cause**: Backend/frontend not started or DB not ready

**Solution**:
```bash
# Ensure services are running
npm run docker:up
npm run db:migrate:dev

# Check backend is running
curl http://localhost:3000/health
```

### WebSocket Tests Fail

**Cause**: WebSocket connection issues

**Solution**:
- Check backend WebSocket gateway is running
- Verify CORS configuration
- Check firewall/network settings

### Cleanup Errors

**Cause**: Data dependencies (e.g., deleting epic with stories)

**Solution**:
- Ensure proper cascade deletes in schema
- Delete in correct order (stories → epics → projects)

## Future Enhancements

- [ ] Visual regression testing with Percy or Playwright screenshots
- [ ] Performance testing (load time, API response time)
- [ ] Accessibility testing (a11y audits)
- [ ] Cross-browser testing (Firefox, Safari)
- [ ] Mobile responsive testing

## Maintenance

Update tests when:
- Adding new features
- Changing UI structure
- Modifying data models
- Updating workflows

Keep tests:
- Fast (< 5 minutes total)
- Reliable (no flaky tests)
- Readable (clear test names and comments)
- Maintainable (use helpers and utilities)
