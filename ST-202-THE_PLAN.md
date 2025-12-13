# ST-202: Runner E2E Test - Exploration Report

**Story**: Runner E2E Test - Playwright Verification
**Status**: Planning
**Exploration Date**: 2025-12-10

## Executive Summary

This is a **SPIKE story** for testing runner functionality via Playwright E2E tests. The story should be **deleted after testing** as it's a temporary verification exercise.

**Key Features to Test**:
1. Runner control buttons (start, pause, resume, cancel)
2. Live transcript streaming
3. Agent transcript display
4. Breakpoints management
5. User questions flow
6. Automatic transcript upload

## Relevant Files Discovered

### Frontend Components (UI Layer)

#### Main Pages
- **`/frontend/src/pages/WorkflowExecutionMonitor.tsx`** (840 lines)
  - Main orchestrator page for workflow monitoring
  - Integrates all runner UI components
  - WebSocket real-time updates
  - Control panel, transcripts, artifacts, approvals
  - **Critical for E2E testing**: Central entry point

#### Runner Control Components
- **`/frontend/src/components/workflow-viz/WorkflowControlPanel.tsx`** (414 lines)
  - ST-195: Workflow control buttons implementation
  - Two variants: `header` (compact) and `panel` (full)
  - Actions: Pause, Resume, Repeat, Skip, Cancel
  - Modals for Repeat Step and Skip Phase
  - **Test IDs**: `pause-btn`, `resume-btn`, `repeat-btn`, `skip-btn`, `cancel-btn`

#### Transcript Components
- **`/frontend/src/components/workflow-viz/MasterTranscriptPanel.tsx`**
  - ST-182: Master session transcript panel
  - Live streaming via WebSocket
  - Displays master transcript paths
  - Agent online/offline status

- **`/frontend/src/components/workflow-viz/LiveTranscriptViewer.tsx`** (288 lines)
  - ST-176: Real-time transcript streaming viewer
  - Virtual scrolling for 1000+ lines (react-window)
  - Syntax highlighting with react-syntax-highlighter
  - Auto-scroll with user override detection
  - Download transcript functionality
  - **Test IDs**: Dialog with live transcript content

- **`/frontend/src/components/workflow-viz/TranscriptViewerModal.tsx`**
  - Modal for viewing transcript artifacts
  - Component run transcript display

#### Breakpoint Components
- **`/frontend/src/components/workflow-viz/BreakpointEditor.tsx`** (306 lines)
  - ST-168: Add/edit breakpoint modal
  - Condition builder (tokens, agents, states, duration)
  - Operators: >, >=, <, <=, ==, !=
  - Temporary breakpoint option
  - **Test IDs**: `breakpoint-editor-modal`, `state-select`, `position-before`, `position-after`, `condition-toggle`, `save-breakpoint`

- **`/frontend/src/components/workflow-viz/BreakpointIndicator.tsx`**
  - Visual indicators for breakpoints in workflow states
  - **Test IDs**: `breakpoint-indicator`

#### Agent Question Components
- **`/frontend/src/components/workflow-viz/AgentQuestionPanel.tsx`** (279 lines)
  - ST-168: Agent Q&A interface
  - Question submission, skip, handoff
  - Session handoff to local CLI
  - **Test IDs**: `agent-question-panel`, `question-content`, `answer-textarea`, `submit-button`, `skip-button`, `handoff-button`

- **`/frontend/src/components/execution/QuestionModal.tsx`**
  - Modal for answering agent questions

#### Other Workflow Components
- **`/frontend/src/components/workflow-viz/FullStatePanel.tsx`**
  - Displays all workflow states
  - Expandable state blocks
  - Artifact and transcript links

- **`/frontend/src/components/workflow-viz/StateBlock.tsx`**
  - Individual workflow state visualization
  - Agent buttons, status indicators

### Frontend Services (API Layer)

- **`/frontend/src/services/runner.service.ts`** (104 lines)
  - ST-195: Workflow runner control API client
  - Methods: `getStatus`, `startRunner`, `pauseRunner`, `resumeRunner`, `repeatStep`, `advanceStep`
  - TypeScript interfaces: `RunnerStatus`, `RunnerResponse`, `RepeatStepParams`, `AdvanceStepParams`

- **`/frontend/src/services/workflow-runs.service.ts`**
  - Workflow run CRUD operations
  - Fetching run details, states, component runs

- **`/frontend/src/services/api.client.ts`**
  - Axios client with base URL configuration
  - **CRITICAL**: Uses `VITE_API_URL || '/api'` pattern (no double /api/api)

### Frontend Hooks

- **`/frontend/src/components/workflow-viz/hooks/useRunnerControl.ts`**
  - React Query hook for runner control
  - Mutations: pause, resume, repeat, advance
  - Status polling

- **`/frontend/src/components/workflow-viz/hooks/useWorkflowRun.ts`**
  - Fetch workflow run with states

- **`/frontend/src/components/workflow-viz/hooks/useApprovals.ts`**
  - ST-168: Approval gate management

- **`/frontend/src/components/workflow-viz/hooks/useArtifacts.ts`**
  - ST-168: Artifact fetching

- **`/frontend/src/components/workflow-viz/hooks/useRemoteAgents.ts`**
  - ST-182: Check for online remote agents

### Backend Services (API Endpoints)

#### Runner Module
- **`/backend/src/runner/runner.controller.ts`**
  - REST endpoints: `/runner/:runId/status`, `/runner/:runId/pause`, `/runner/:runId/resume`, etc.
  - Transcript registration: `POST /runner/workflow-runs/:runId/transcripts`

- **`/backend/src/runner/runner-control.service.ts`**
  - Service layer for runner control operations
  - Status retrieval, pause/resume logic

- **`/backend/src/runner/runner.service.ts`**
  - Core runner service
  - Transcript registration
  - Workflow run management

- **`/backend/src/runner/breakpoint.service.ts`**
  - Breakpoint CRUD operations
  - Condition evaluation

- **`/backend/src/runner/approval.service.ts`**
  - Approval gate management
  - Respond to approvals (approve, rerun, reject)

#### Transcript Module
- **`/backend/src/workflow-runs/transcripts.service.ts`**
  - Transcript storage and retrieval
  - Master and agent transcript tracking

#### Remote Agent Module
- **`/backend/src/remote-agent/remote-execution.service.ts`**
  - Laptop agent orchestration
  - Script execution (parse-transcript, watch-transcripts, etc.)

### Backend MCP Tools

- **`/backend/src/mcp/servers/runner/start_runner.ts`**
  - MCP tool: `start_runner`
  - Launches runner on laptop agent

- **`/backend/src/mcp/servers/runner/pause_runner.ts`**
  - MCP tool: `pause_runner`

- **`/backend/src/mcp/servers/runner/resume_runner.ts`**
  - MCP tool: `resume_runner`

- **`/backend/src/mcp/servers/runner/step_runner.ts`**
  - MCP tool: `step_runner`
  - Execute one state and pause

- **`/backend/src/mcp/servers/runner/get_runner_status.ts`**
  - MCP tool: `get_runner_status`

- **`/backend/src/mcp/servers/runner/get_runner_checkpoint.ts`**
  - MCP tool: `get_runner_checkpoint`

### Existing E2E Tests (Patterns to Follow)

#### Transcript E2E Tests
- **`/e2e/15-transcript-streaming-e2e.spec.ts`** (383 lines)
  - ST-190: Transcript streaming E2E
  - Tests master transcript display, WebSocket connectivity
  - Pre-flight checks (laptop agent online)
  - Live transcript streaming with play button
  - Agent transcript verification
  - **Pattern**: Uses PRODUCTION URLs, requires online laptop agent

- **`/e2e/16-real-transcript-e2e.spec.ts`** (356 lines)
  - ST-190: Real transcript registration E2E
  - Uses REST API for workflow run creation
  - Transcript registration via `POST /api/runner/workflow-runs/:runId/transcripts`
  - UI verification in workflow monitor page
  - Cleanup in final test
  - **Pattern**: Creates real data, test.describe.serial for ordered execution

#### Other E2E Tests
- **`/e2e/01-story-workflow.spec.ts`** - Story workflow transitions
- **`/e2e/02-subtask-management.spec.ts`** - Subtask CRUD
- **`/e2e/04-websocket-realtime.spec.ts`** - WebSocket updates
- **`/e2e/08-global-workflow-tracking-bar.spec.ts`** - Global tracking bar
- **`/e2e/14-workflow-wizard-st90.spec.ts`** - Workflow wizard

#### Test Configuration
- **`/playwright.config.ts`** - Test environment config (port 5174)
  - Base URL: `http://127.0.0.1:5174` (test environment)
  - Reuses existing servers
  - Single worker, sequential execution

- **`/playwright.real-e2e.config.ts`** - Production config
  - Base URL: `https://vibestudio.example.com`
  - Timeout: 180 seconds
  - Always captures traces/screenshots/video

### Page Objects
- **`/e2e/page-objects/ComponentLibraryPage.ts`** (10,597 bytes)
- **`/e2e/page-objects/CoordinatorLibraryPage.ts`** (9,775 bytes)
- **`/e2e/page-objects/WorkflowWizardPage.ts`** (14,941 bytes)

## Existing Patterns and Conventions

### E2E Test Patterns (from README.md)

1. **Test Structure**:
   - Setup in `beforeAll` hooks
   - Independent test execution
   - Cleanup in `afterAll` hooks
   - Isolated test data per file

2. **Data-testid Convention**:
   - Action buttons: `create-story`, `edit-story`, `delete-story`
   - Status indicators: `current-status`, `story-status`
   - Interactive elements: `{element}-{id}`
   - Control buttons: `pause-btn`, `resume-btn`, etc.

3. **Test Utilities**:
   - `utils/auth.helper.ts` - Authentication (login, logout, get token)
   - `utils/api.helper.ts` - Direct API calls
   - `utils/db.helper.ts` - Database seeding/cleanup

4. **Test Data**:
   - Admin: `admin@aistudio.local` / `admin123`
   - PM: `pm@aistudio.local` / `PM123!`
   - Developer: `dev@aistudio.local` / `Dev123!`

### WebSocket Patterns

From `WorkflowExecutionMonitor.tsx`:
```typescript
const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;
const token = localStorage.getItem('accessToken');
const socket = io(wsUrl, {
  transports: ['websocket', 'polling'],
  auth: { token },
});

// Join room
socket.emit('join-room', { room: `workflow-run:${runId}` });

// Listen for events
socket.on('workflow:status', (data) => { refetch(); });
socket.on('component:started', (data) => { refetch(); });
socket.on('component:completed', (data) => { refetch(); });
socket.on('question:detected', (data) => { refetch(); });
```

### Runner Control Patterns

From `WorkflowControlPanel.tsx`:
```typescript
// Button states based on runner status
const getButtonStates = () => {
  const runnerState = status?.status || 'initializing';
  return {
    pause: runnerState === 'running',
    resume: runnerState === 'paused',
    repeat: ['running', 'paused', 'failed'].includes(runnerState),
    skip: ['running', 'paused'].includes(runnerState),
    cancel: ['running', 'paused'].includes(runnerState),
  };
};
```

### API Patterns

From `runner.service.ts`:
```typescript
// GET /api/runner/:runId/status
await apiClient.get<RunnerStatus>(`/runner/${runId}/status`);

// POST /api/runner/:runId/pause
await apiClient.post<RunnerResponse>(`/runner/${runId}/pause`, { reason });

// POST /api/runner/:runId/repeat
await apiClient.post<RunnerResponse>(`/runner/${runId}/repeat`, { feedback, reason });
```

## Test Files Similar to Our Needs

### Most Relevant: 15-transcript-streaming-e2e.spec.ts
- Tests transcript streaming UI
- Verifies WebSocket connectivity
- Checks for online laptop agent
- Play button click and line streaming
- **Pattern**: Pre-flight checks, production URLs, laptop agent dependency

### Most Relevant: 16-real-transcript-e2e.spec.ts
- Uses REST API for data creation
- Serial test execution (`test.describe.serial`)
- Cleanup in final test (not `afterAll`)
- **Pattern**: Real data creation, UI verification, cleanup strategy

### Workflow Control: 08-global-workflow-tracking-bar.spec.ts
- Tests workflow control UI
- Status updates, button states
- **Pattern**: Control panel interaction, status verification

## Key Dependencies and Imports

### Frontend Dependencies
```json
"@playwright/test": "^1.56.1",
"@mui/material": "^5.x",
"react-query": "@tanstack/react-query",
"socket.io-client": "^4.x",
"react-syntax-highlighter": "^15.x",
"react-window": "^1.x"
```

### Test Scripts
```json
"test:e2e": "./scripts/test.sh e2e",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:debug": "playwright test --debug",
"test:e2e:report": "playwright show-report playwright-report"
```

## Git History Insights

### Recent Runner Features (Last 30 Commits)
- **ST-200**: Refactor Docker Runner to use Master Claude CLI Session
- **ST-195**: Replace Docker Runner with Laptop Orchestrator
- **ST-195**: Add workflow control buttons and agent results display
- **ST-194**: Fix transcript metrics calculation bugs
- **ST-189**: Add transcript registration REST endpoint
- **ST-182**: Master transcript panel and live streaming
- **ST-176**: Real-time transcript streaming viewer
- **ST-168**: Approval gates, breakpoints, agent questions

### Key Commits
- `0c71854` - feat(ST-195): Add workflow control buttons and agent results display
- `c881eeb` - feat(ST-195): Add POST /stories/:id/execute REST endpoint
- `38be43d` - feat(ST-189): Add transcript registration REST endpoint
- `641caca` - chore: WIP - MCP runner refactoring and transcript streaming improvements

## Potential Risks and Considerations

### 1. Laptop Agent Dependency
- **Risk**: Tests require laptop agent to be online
- **Mitigation**: Pre-flight check (like test 15), graceful degradation

### 2. WebSocket Reliability
- **Risk**: WebSocket connection flakiness in CI/CD
- **Mitigation**: Retry logic, fallback to polling

### 3. Transcript File Availability
- **Risk**: Transcript files may not exist on laptop
- **Mitigation**: Mock transcript files, or test with known good transcripts

### 4. Test Data Cleanup
- **Risk**: Story is for testing only, should be deleted after
- **Mitigation**: Use `afterAll` cleanup or final test cleanup (pattern from test 16)

### 5. Runner State Race Conditions
- **Risk**: Button states may change between checks
- **Mitigation**: Wait for specific states, use retry logic

### 6. Environment URLs
- **Risk**: Test vs Production URL confusion
- **Consideration**:
  - Test: `http://127.0.0.1:5174` (same as `https://test.vibestudio.example.com`)
  - Production: `https://vibestudio.example.com`
  - **Decision needed**: Which environment to use?

### 7. Real Data Creation
- **Risk**: Creating real workflow runs in production
- **Mitigation**: Use pre-existing test story (ST-191 pattern), cleanup after

## Recommended Test Strategy

### Option A: Test Environment (Recommended for Development)
- Base URL: `http://127.0.0.1:5174`
- Use `playwright.config.ts`
- Reuse existing test containers
- Faster execution, isolated

### Option B: Production Environment (Real E2E Verification)
- Base URL: `https://vibestudio.example.com`
- Use `playwright.real-e2e.config.ts`
- Requires laptop agent online
- Real data creation with cleanup

## Next Steps for Implementation

### 1. Test Structure
Create `/e2e/17-runner-e2e.spec.ts` with:
- Pre-flight checks (laptop agent, test story exists)
- Control button tests (pause, resume, repeat, skip, cancel)
- Live transcript streaming tests
- Breakpoint tests (add, edit, delete, conditional)
- Agent question tests (submit, skip, handoff)
- Cleanup

### 2. Test Data Setup
```typescript
// Use existing test story ST-191 (created via MCP)
const TEST_STORY_ID = '504990ac-3f7f-4149-904f-cd13ac0610ab'; // ST-191
const SIMPLIFIED_DEV_WORKFLOW_ID = 'df9bf06d-38c5-4fa8-9c7d-b60d0bdfc122';
```

### 3. Test Phases
1. **Setup**: Create workflow run, start runner
2. **Control**: Test pause/resume/repeat/skip/cancel buttons
3. **Transcripts**: Verify master and agent transcript display
4. **Breakpoints**: Add/edit/delete breakpoints
5. **Questions**: Test agent question flow
6. **Cleanup**: Delete workflow run (keep story for future tests)

### 4. Key Selectors
```typescript
// Control buttons
await page.click('[data-testid="pause-btn"]');
await page.click('[data-testid="resume-btn"]');
await page.click('[data-testid="repeat-btn"]');

// Breakpoint editor
await page.click('[data-testid="save-breakpoint"]');

// Agent questions
await page.fill('[data-testid="answer-textarea"]', 'Answer');
await page.click('[data-testid="submit-button"]');

// Transcripts
await page.click('text=Master Session'); // Expand panel
await page.click('button:has-text("Start live streaming")');
```

## Related Use Cases

Based on the codebase analysis, these use cases are likely implemented:

1. **UC-RUNNER-001**: Start Workflow Runner
   - Files: `start_runner.ts`, `WorkflowControlPanel.tsx`

2. **UC-RUNNER-002**: Pause/Resume Workflow
   - Files: `pause_runner.ts`, `resume_runner.ts`, `WorkflowControlPanel.tsx`

3. **UC-RUNNER-003**: View Live Transcript Stream
   - Files: `LiveTranscriptViewer.tsx`, `MasterTranscriptPanel.tsx`

4. **UC-RUNNER-004**: Manage Breakpoints
   - Files: `BreakpointEditor.tsx`, `breakpoint.service.ts`

5. **UC-RUNNER-005**: Answer Agent Questions
   - Files: `AgentQuestionPanel.tsx`, `QuestionModal.tsx`

## Conclusion

This exploration has identified all necessary components for comprehensive E2E testing of the Runner functionality. The codebase has extensive existing patterns to follow, particularly from tests 15 and 16 for transcript streaming. The main decision point is whether to test against test environment or production, with test environment recommended for faster, isolated testing during development.

**Recommendation**: Create test file following the pattern of test 16 (serial execution, REST API setup, UI verification) with comprehensive coverage of all 6 feature areas listed in the story description.
