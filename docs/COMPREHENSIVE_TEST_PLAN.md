# Comprehensive Test Plan - Agent Workflow MVP

**Created**: 2025-11-13
**Status**: In Progress
**Coverage Goal**: 80%+ for critical paths, 60%+ overall

---

## Testing Strategy

### Test Pyramid
```
                    /\
                   /  \
                  / E2E \          10% - Full user workflows
                 /______\
                /        \
               /Integration\       30% - API + Services
              /____________\
             /              \
            /   Unit Tests   \     60% - Business logic
           /                  \
          /____________________\
```

### Testing Infrastructure
- **Unit Tests**: Jest + @nestjs/testing (backend), Jest + React Testing Library (frontend)
- **Integration Tests**: Jest + Supertest (backend API)
- **E2E Tests**: Playwright (full user workflows)

---

## Phase 1: Database & CRUD APIs - Unit Tests

### 1.1 Components Service (`backend/src/components/components.service.spec.ts`)

**Test Cases**:
- ✅ `create()` - Should create component with valid data
- ✅ `create()` - Should validate required fields (name, inputInstructions, operationInstructions, outputInstructions)
- ✅ `create()` - Should throw error if project not found
- ✅ `findAll()` - Should return all components for project
- ✅ `findAll()` - Should filter by active status
- ✅ `findAll()` - Should filter by tags
- ✅ `findAll()` - Should search by name and description
- ✅ `findOne()` - Should return component with usage stats
- ✅ `findOne()` - Should throw error if component not found
- ✅ `update()` - Should update component fields
- ✅ `update()` - Should throw error if component not found
- ✅ `remove()` - Should soft delete component if no executions
- ✅ `remove()` - Should throw error if component has execution history
- ✅ `activate()` - Should set isActive to true
- ✅ `deactivate()` - Should set isActive to false

**Mock Dependencies**: PrismaService

**Metrics to Verify**:
- Usage count calculation
- Success rate calculation
- Avg duration, tokens, cost

---

### 1.2 Coordinators Service (`backend/src/coordinators/coordinators.service.spec.ts`)

**Test Cases**:
- ✅ `create()` - Should create coordinator with valid data
- ✅ `create()` - Should validate decision strategy (sequential, adaptive, parallel, conditional)
- ✅ `create()` - Should validate component IDs exist
- ✅ `create()` - Should throw error if project not found
- ✅ `findAll()` - Should return all coordinators for project
- ✅ `findAll()` - Should filter by active status
- ✅ `findAll()` - Should filter by domain (business, technical)
- ✅ `findOne()` - Should return coordinator with component details
- ✅ `findOne()` - Should calculate usage stats
- ✅ `update()` - Should update coordinator and validate components
- ✅ `remove()` - Should throw error if coordinator has workflows
- ✅ `activate()` - Should set isActive to true
- ✅ `deactivate()` - Should set isActive to false

**Mock Dependencies**: PrismaService

---

### 1.3 Workflows Service (`backend/src/workflows/workflows.service.spec.ts`)

**Test Cases**:
- ✅ `create()` - Should create workflow with coordinator
- ✅ `create()` - Should validate trigger type (manual, webhook)
- ✅ `create()` - Should validate coordinator exists
- ✅ `create()` - Should throw error if project not found
- ✅ `findAll()` - Should return all workflows for project
- ✅ `findAll()` - Should filter by active status
- ✅ `findOne()` - Should return workflow with coordinator and components
- ✅ `findOne()` - Should calculate execution stats
- ✅ `update()` - Should update workflow fields
- ✅ `remove()` - Should throw error if workflow has runs
- ✅ `activate()` - Should set isActive to true and track activation
- ✅ `deactivate()` - Should set isActive to false

**Mock Dependencies**: PrismaService

---

## Phase 3+6: MCP Execution Tracking - Unit Tests

### 3.1 MCP Execution Tools

#### 3.1.1 start_workflow_run (`backend/src/mcp/servers/execution/start_workflow_run.spec.ts`)

**Test Cases**:
- ✅ Should create WorkflowRun with status 'running'
- ✅ Should return runId and component list
- ✅ Should validate workflow exists
- ✅ Should validate coordinator exists
- ✅ Should store context object
- ✅ Should set triggeredBy field
- ✅ Should handle nullable storyId (workflows without stories)
- ✅ Should throw error if workflow not found

**Mock Dependencies**: PrismaClient

---

#### 3.1.2 record_component_start (`backend/src/mcp/servers/execution/record_component_start.spec.ts`)

**Test Cases**:
- ✅ Should create ComponentRun with status 'running'
- ✅ Should validate runId exists
- ✅ Should validate componentId exists
- ✅ Should store input data
- ✅ Should set startedAt timestamp
- ✅ Should return componentRunId
- ✅ Should throw error if workflow run not found
- ✅ Should throw error if component not found

**Mock Dependencies**: PrismaClient

---

#### 3.1.3 record_component_complete (`backend/src/mcp/servers/execution/record_component_complete.spec.ts`)

**Test Cases**:
- ✅ Should update ComponentRun status to 'completed'
- ✅ Should update ComponentRun status to 'failed' with errorMessage
- ✅ Should calculate and store duration
- ✅ Should store metrics (tokens, cost, LOC, prompts, iterations, interventions)
- ✅ Should update WorkflowRun aggregated metrics
- ✅ Should recalculate totalTokens across all component runs
- ✅ Should recalculate totalCost
- ✅ Should recalculate totalDuration
- ✅ Should store output data
- ✅ Should throw error if componentRunId not found

**Mock Dependencies**: PrismaClient

---

#### 3.1.4 get_workflow_context (`backend/src/mcp/servers/execution/get_workflow_context.spec.ts`)

**Test Cases**:
- ✅ Should return workflow context with previous outputs
- ✅ Should include completed component runs
- ✅ Should include input/output for each component
- ✅ Should include metrics summary
- ✅ Should return empty array if no completed components
- ✅ Should throw error if runId not found

**Mock Dependencies**: PrismaClient

---

#### 3.1.5 update_workflow_status (`backend/src/mcp/servers/execution/update_workflow_status.spec.ts`)

**Test Cases**:
- ✅ Should update status to 'completed'
- ✅ Should update status to 'failed' with errorMessage
- ✅ Should set completedAt timestamp
- ✅ Should throw error if runId not found
- ✅ Should validate status is valid RunStatus enum value

**Mock Dependencies**: PrismaClient

---

#### 3.1.6 store_artifact (`backend/src/mcp/servers/execution/store_artifact.spec.ts`)

**Test Cases**:
- ✅ Should create Artifact record
- ✅ Should call S3Service.uploadArtifact() when S3 enabled
- ✅ Should store in database when S3 disabled
- ✅ Should validate runId exists
- ✅ Should validate componentRunId if provided
- ✅ Should support different artifact types (code, report, diagram, test, other)
- ✅ Should store metadata JSON
- ✅ Should handle upload failures gracefully

**Mock Dependencies**: PrismaClient, S3Service

---

### 3.2 Workflow State Service (`backend/src/execution/workflow-state.service.spec.ts`)

**Test Cases**:
- ✅ `getWorkflowRunStatus()` - Should return full run status with metrics
- ✅ `getWorkflowRunStatus()` - Should calculate percentComplete
- ✅ `getWorkflowRunStatus()` - Should include all component runs
- ✅ `getWorkflowRunStatus()` - Should throw error if run not found
- ✅ `getWorkflowArtifacts()` - Should return all artifacts for run
- ✅ `getWorkflowArtifacts()` - Should filter by componentRunId
- ✅ `getWorkflowContext()` - Should return context for coordinator decisions
- ✅ `getWorkflowContext()` - Should include completed component outputs
- ✅ `getWorkflowContext()` - Should include original context

**Mock Dependencies**: PrismaService

---

### 3.3 S3 Service (`backend/src/storage/s3.service.spec.ts`)

**Test Cases**:
- ✅ `uploadArtifact()` - Should upload to S3 when enabled
- ✅ `uploadArtifact()` - Should generate correct S3 key
- ✅ `uploadArtifact()` - Should handle upload errors
- ✅ `uploadArtifact()` - Should skip upload when disabled
- ✅ `getArtifact()` - Should retrieve from S3
- ✅ `getArtifact()` - Should handle not found errors
- ✅ `deleteArtifact()` - Should delete from S3

**Mock Dependencies**: AWS SDK S3Client

---

## Phase 4 & 7: Agent File Generation & Activation - Unit Tests

### 4.1 Coordinator Agent Generator (`backend/src/mcp/generators/coordinator-agent-generator.spec.ts`)

**Test Cases**:
- ✅ Should generate valid markdown file
- ✅ Should include coordinator name and description
- ✅ Should include decision strategy
- ✅ Should include component list with IDs
- ✅ Should include MCP execution protocol (160+ lines)
- ✅ Should include all 6 MCP tools
- ✅ Should handle sequential strategy
- ✅ Should handle adaptive strategy
- ✅ Should handle parallel strategy
- ✅ Should handle conditional strategy
- ✅ Should escape markdown special characters
- ✅ Should generate correct file path (`.claude/agents/coordinator-{name}.md`)
- ✅ Should include decision strategy explanations
- ✅ Should include error handling instructions (stop/continue/retry/notify)
- ✅ Should format component instructions with proper markdown
- ✅ Should include execution loop logic

**Mock Dependencies**: PrismaService

---

### 4.2 Component Agent Generator (`backend/src/mcp/generators/component-agent-generator.spec.ts`)

**Test Cases**:
- ✅ Should generate valid markdown file
- ✅ Should include component name and description
- ✅ Should include input instructions section
- ✅ Should include operation instructions section
- ✅ Should include output instructions section
- ✅ Should escape markdown special characters
- ✅ Should handle components with tags
- ✅ Should generate correct file path (`.claude/agents/component-{name}.md`)
- ✅ Should format 3 instruction sets with proper headings
- ✅ Should include tools list if specified
- ✅ Should include config JSON if specified
- ✅ Should handle subtask configuration

**Mock Dependencies**: None

---

### 4.3 Workflow Skill Generator (`backend/src/mcp/generators/workflow-skill-generator.spec.ts`)

**Test Cases**:
- ✅ Should generate skill command file
- ✅ Should include workflow name and description
- ✅ Should reference coordinator agent
- ✅ Should include trigger instructions
- ✅ Should validate file path format (`.claude/skills/{workflow-name}.md`)
- ✅ Should include workflow ID for tracking
- ✅ Should include trigger type (manual/webhook)
- ✅ Should include trigger configuration
- ✅ Should format as valid skill file

**Mock Dependencies**: None

---

### 4.4 File Validator (`backend/src/mcp/validators/file-validator.spec.ts`)

**Test Cases**:
- ✅ Should validate agent file structure
- ✅ Should validate markdown syntax
- ✅ Should detect missing required sections
- ✅ Should validate MCP tool references
- ✅ Should validate component ID references
- ✅ Should validate file paths
- ✅ Should validate skill file format
- ✅ Should return validation errors with line numbers
- ✅ Should validate metadata structure

**Mock Dependencies**: None

---

### 4.5 Activation Service (`backend/src/mcp/services/activation.service.spec.ts`)

**Test Cases**:

#### activateWorkflow()
- ✅ Should generate coordinator agent file
- ✅ Should generate component agent files for all components
- ✅ Should generate workflow skill file
- ✅ Should create ActiveWorkflow record
- ✅ Should deactivate previous workflow (one at a time rule)
- ✅ Should validate workflow exists
- ✅ Should validate coordinator exists
- ✅ Should validate all components exist
- ✅ Should backup existing files if conflicts detected
- ✅ Should write files to `.claude/agents/` directory
- ✅ Should write skill to `.claude/skills/` directory
- ✅ Should return file paths and metadata
- ✅ Should track activation version
- ✅ Should throw error if workflow not found
- ✅ Should throw error if another workflow is active
- ✅ Should handle file system write errors

#### deactivateWorkflow()
- ✅ Should remove coordinator agent file
- ✅ Should remove component agent files
- ✅ Should remove workflow skill file
- ✅ Should update ActiveWorkflow status to 'deactivated'
- ✅ Should set deactivatedAt timestamp
- ✅ Should backup files before removal
- ✅ Should handle missing files gracefully
- ✅ Should throw error if no active workflow

#### syncWorkflow()
- ✅ Should regenerate all agent files
- ✅ Should detect changes in workflow definition
- ✅ Should update version number
- ✅ Should preserve existing metadata
- ✅ Should notify if changes detected
- ✅ Should throw error if workflow not active
- ✅ Should validate new files before replacing

#### getActiveWorkflow()
- ✅ Should return active workflow info
- ✅ Should include coordinator details
- ✅ Should include component count
- ✅ Should include activation metadata
- ✅ Should return null if no active workflow
- ✅ Should check for updates available

#### handleConflicts()
- ✅ Should detect existing agent files
- ✅ Should create backup directory
- ✅ Should move conflicting files to backup
- ✅ Should preserve file timestamps
- ✅ Should log conflict resolution
- ✅ Should return list of backed up files

#### validateBeforeActivation()
- ✅ Should validate workflow configuration
- ✅ Should validate coordinator exists and is active
- ✅ Should validate all components exist and are active
- ✅ Should check for circular dependencies
- ✅ Should validate decision strategy is valid
- ✅ Should validate trigger configuration
- ✅ Should return validation results

**Mock Dependencies**: PrismaService, FileGenerators, FileSystem (fs)

---

## Phase 7: Claude Code Integration - Integration Tests

### 7.1 Activation Flow Integration (`backend/test/integration/activation-flow.integration.spec.ts`)

**Test Cases**:
- ✅ Should complete full activation cycle
  1. Create project
  2. Create components
  3. Create coordinator with components
  4. Create workflow with coordinator
  5. Activate workflow in Claude Code
  6. Verify all files generated
  7. Verify ActiveWorkflow record created
  8. Deactivate workflow
  9. Verify files removed
- ✅ Should handle activation conflicts
  1. Activate workflow A
  2. Attempt to activate workflow B
  3. Should show conflict resolution UI data
  4. Deactivate workflow A
  5. Activate workflow B
  6. Should succeed
- ✅ Should handle file validation errors
  1. Create invalid coordinator (missing decision strategy)
  2. Attempt to activate
  3. Should return validation errors
  4. Fix coordinator
  5. Activate successfully
- ✅ Should sync workflow after changes
  1. Activate workflow
  2. Update component instructions
  3. Call sync endpoint
  4. Verify files regenerated
  5. Verify version incremented

**Real Dependencies**: Test database, File system

---

### 7.2 File Generation Integration (`backend/test/integration/file-generation.integration.spec.ts`)

**Test Cases**:
- ✅ Should generate coordinator with sequential strategy
- ✅ Should generate coordinator with adaptive strategy
- ✅ Should generate coordinator with parallel strategy
- ✅ Should generate coordinator with conditional strategy
- ✅ Should generate component with all instruction sets
- ✅ Should generate component with tools
- ✅ Should generate component with config
- ✅ Should generate workflow skill with manual trigger
- ✅ Should generate workflow skill with webhook trigger
- ✅ Should generate valid markdown that renders correctly
- ✅ Should escape special characters properly
- ✅ Should include all required MCP tools in coordinator
- ✅ Should format code blocks correctly

**Real Dependencies**: File system

---

## Integration Tests

### 5.1 API Endpoints Integration (`backend/test/integration/`)

#### 5.1.1 Components API (`components.integration.spec.ts`)

**Test Cases**:
- ✅ POST /api/projects/:projectId/components - Should create component
- ✅ GET /api/projects/:projectId/components - Should list components
- ✅ GET /api/projects/:projectId/components/:id - Should get component
- ✅ PUT /api/projects/:projectId/components/:id - Should update component
- ✅ DELETE /api/projects/:projectId/components/:id - Should delete component
- ✅ POST /api/projects/:projectId/components/:id/activate - Should activate
- ✅ POST /api/projects/:projectId/components/:id/deactivate - Should deactivate
- ✅ Should require authentication (401 without token)
- ✅ Should validate project ownership (403 for other user's project)

---

#### 5.1.2 Coordinators API (`coordinators.integration.spec.ts`)

**Test Cases**:
- ✅ POST /api/projects/:projectId/coordinators - Should create coordinator
- ✅ GET /api/projects/:projectId/coordinators - Should list coordinators
- ✅ GET /api/projects/:projectId/coordinators/:id - Should get coordinator
- ✅ PUT /api/projects/:projectId/coordinators/:id - Should update coordinator
- ✅ DELETE /api/projects/:projectId/coordinators/:id - Should delete coordinator
- ✅ Should validate component IDs exist
- ✅ Should require authentication
- ✅ Should validate project ownership

---

#### 5.1.3 Workflows API (`workflows.integration.spec.ts`)

**Test Cases**:
- ✅ POST /api/projects/:projectId/workflows - Should create workflow
- ✅ GET /api/projects/:projectId/workflows - Should list workflows
- ✅ GET /api/projects/:projectId/workflows/:id - Should get workflow
- ✅ PUT /api/projects/:projectId/workflows/:id - Should update workflow
- ✅ DELETE /api/projects/:projectId/workflows/:id - Should delete workflow
- ✅ POST /api/projects/:projectId/workflows/:id/activate - Should activate
- ✅ POST /api/projects/:projectId/workflows/:id/activate-claude-code - Should activate in Claude Code
- ✅ POST /api/projects/:projectId/workflows/deactivate-claude-code - Should deactivate
- ✅ GET /api/projects/:projectId/workflows/active-claude-code - Should get active
- ✅ Should require authentication
- ✅ Should validate project ownership

---

#### 5.1.4 Workflow Runs API (`workflow-runs.integration.spec.ts`)

**Test Cases**:
- ✅ GET /api/projects/:projectId/workflow-runs/:id/status - Should return status
- ✅ GET /api/projects/:projectId/workflow-runs/:id/artifacts - Should list artifacts
- ✅ GET /api/projects/:projectId/workflow-runs/:id/context - Should return context
- ✅ Should require authentication
- ✅ Should validate project ownership
- ✅ Should handle not found (404)

---

### 5.2 Workflow Execution Flow Integration (`workflow-execution.integration.spec.ts`)

**Test Cases**:
- ✅ Should complete full workflow execution cycle
  1. Create workflow
  2. Activate in Claude Code
  3. Start workflow run via MCP tool
  4. Record component start
  5. Record component complete with metrics
  6. Store artifact
  7. Get workflow context
  8. Update workflow status
  9. Verify aggregated metrics
  10. Verify artifacts stored

**Real Dependencies**: Test database, MCP tools

---

### 5.3 WebSocket Communication Integration (`websocket.integration.spec.ts`)

**Test Cases**:
- ✅ Should connect to WebSocket server
- ✅ Should join workflow-run room
- ✅ Should receive workflow:started event
- ✅ Should receive component:started event
- ✅ Should receive component:completed event
- ✅ Should receive workflow:status event
- ✅ Should receive artifact:stored event
- ✅ Should receive metrics:updated event
- ✅ Should disconnect gracefully

**Real Dependencies**: WebSocket Gateway, Socket.io client

---

## E2E Tests (Playwright)

### 6.1 Workflow Creation and Activation (`e2e/06-workflow-creation-activation.spec.ts`)

**Test Cases**:
- ✅ User can create a new component
- ✅ User can edit component instructions
- ✅ User can create a coordinator with components
- ✅ User can select decision strategy
- ✅ User can create a workflow with coordinator
- ✅ User can activate workflow in Claude Code
- ✅ User sees success message after activation
- ✅ User can view active workflow banner
- ✅ User can deactivate workflow
- ✅ Validation errors show for invalid inputs

**Pages**: ComponentLibraryView, CoordinatorLibraryView, WorkflowManagementView

---

### 6.2 Execution Monitoring (`e2e/07-execution-monitoring.spec.ts`)

**Test Cases**:
- ✅ User can view workflow execution monitor page
- ✅ User sees live metrics updating via WebSocket
- ✅ User sees component progress tracker
- ✅ User sees execution timeline
- ✅ User can view artifacts
- ✅ User can download artifacts
- ✅ User sees real-time token count updates
- ✅ User sees real-time cost updates
- ✅ User sees completion percentage
- ✅ User sees error messages for failed components

**Pages**: WorkflowExecutionMonitor

---

### 6.3 Results and Analytics (`e2e/08-results-analytics.spec.ts`)

**Test Cases**:
- ✅ User can view workflow results page
- ✅ User can see execution summary
- ✅ User can view component breakdown
- ✅ User can compare workflow performance
- ✅ User can filter by date range
- ✅ User can export results
- ✅ User sees industry benchmarks

**Pages**: PerformanceDashboard, WorkflowResults

---

## Test Execution Plan

### Phase 1: Unit Tests (Week 1)
1. ✅ Components Service tests
2. ✅ Coordinators Service tests
3. ✅ Workflows Service tests
4. ✅ MCP execution tools tests (6 tools)
5. ✅ Workflow State Service tests
6. ✅ S3 Service tests
7. ✅ Agent file generators tests (3 generators)
8. ✅ Activation Service tests

**Target**: 60%+ code coverage

---

### Phase 2: Integration Tests (Week 2)
1. ✅ Components API integration
2. ✅ Coordinators API integration
3. ✅ Workflows API integration
4. ✅ Workflow Runs API integration
5. ✅ Workflow execution flow integration
6. ✅ WebSocket communication integration

**Target**: All critical API paths covered

---

### Phase 3: E2E Tests (Week 3)
1. ✅ Workflow creation and activation
2. ✅ Execution monitoring
3. ✅ Results and analytics

**Target**: All user workflows covered

---

## Test Data & Fixtures

### Test Users
```typescript
TEST_USERS = {
  pm: { email: 'pm@test.com', password: 'test123', role: 'pm' },
  dev: { email: 'dev@test.com', password: 'test123', role: 'dev' },
  architect: { email: 'arch@test.com', password: 'test123', role: 'architect' },
}
```

### Test Project
```typescript
testProject = {
  name: 'Test Project',
  description: 'E2E Test Project',
  repoUrl: 'https://github.com/test/repo',
}
```

### Test Component
```typescript
testComponent = {
  name: 'Code Review',
  type: 'generic',
  inputInstructions: 'Review PR files for quality issues',
  operationInstructions: 'Check code style, security, performance',
  outputInstructions: 'Generate review comments JSON',
  tags: ['review', 'quality'],
}
```

---

## Coverage Goals

| Module | Target | Priority |
|--------|--------|----------|
| Components Service | 80% | High |
| Coordinators Service | 80% | High |
| Workflows Service | 80% | High |
| MCP Execution Tools | 90% | Critical |
| Workflow State Service | 85% | High |
| Agent Generators | 75% | Medium |
| Activation Service | 80% | High |
| API Controllers | 70% | Medium |
| Frontend Components | 60% | Medium |

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: cd backend && npm run test:cov
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
    steps:
      - uses: actions/checkout@v3
      - run: cd backend && npm run test:e2e

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## Next Steps

1. ✅ Create test plan document (this file)
2. ⏭️ Implement unit tests for Phase 1 (Components, Coordinators, Workflows)
3. ⏭️ Implement unit tests for Phase 3+6 (MCP tools, Workflow State)
4. ⏭️ Implement unit tests for Phase 4 (Agent generators)
5. ⏭️ Implement integration tests
6. ⏭️ Implement E2E tests
7. ⏭️ Set up CI/CD pipeline
8. ⏭️ Generate coverage reports
9. ⏭️ Fix any gaps to reach coverage goals

---

**Last Updated**: 2025-11-13
**Progress**: Test plan created, ready to implement tests
