# ST-199: Transcript Streaming Verification - Exploration Report

## Executive Summary

This exploration analyzed the Docker Runner transcript streaming functionality after ST-195 fixes. The system uses a laptop orchestrator pattern where Claude Code runs on the developer's laptop and communicates with the KVM backend via WebSocket/HTTP for workflow execution.

## Recent ST-195 Fixes

### Critical Fixes Implemented

1. **a50c329 - Update WorkflowRun metadata with actual Claude Code sessionId**
   - Problem: Pre-generated sessionId differs from actual Claude Code session
   - Solution: Updated session_init and claude_complete handlers to write actual sessionId
   - Impact: Enables TranscriptWatcher to match new transcripts to correct workflow run

2. **3a7326f - Fix race condition in start_runner**
   - Problem: Orchestrator calls get_current_step before status updated from 'cancelled' to 'running'
   - Solution: Update status to 'running' BEFORE dispatching to laptop agent
   - Impact: Prevents "Workflow was cancelled" errors

3. **01a0788 - Allow start_runner on 'running' status runs**
   - Enables re-triggering of running workflows

4. **bea6da1 - Remove invalid --prompt flag from Claude Code CLI**
   - Fixes Claude Code invocation errors

5. **b1a40bf - Make componentRunId optional for orchestrator jobs**
   - Orchestrator tracked via WorkflowRun, not ComponentRun

## Architecture Overview

### Laptop Orchestrator Pattern (ST-195)

```
┌─────────────────────────────────────────────────┐
│  Laptop Agent (Developer's Mac)                 │
│  - Claude Code CLI                              │
│  - Executes workflow orchestration              │
│  - Master session transcript                    │
│  - Spawned agent transcripts                    │
└─────────────────────────────────────────────────┘
            ↓ WebSocket/HTTP ↓
┌─────────────────────────────────────────────────┐
│  KVM Backend (vibestudio.example.com)  │
│  - REST API (port 3000)                         │
│  - WebSocket Gateway                            │
│  - Database (Postgres)                          │
│  - Transcript Registration Service              │
└─────────────────────────────────────────────────┘
```

### Key Components

#### 1. Runner Service (`backend/src/runner/runner.service.ts`)

**Purpose**: Backend orchestration layer for Docker/Laptop runner

**Key Methods**:
- `launchDockerRunner()`: Launches laptop orchestrator via HTTP (ST-195)
- `registerTranscript()`: HTTP-callable transcript registration (ST-189)
- `saveCheckpoint()`: Checkpoint persistence
- `updateStatus()`: Status updates

**ST-195 Flow**:
```typescript
async launchDockerRunner(params: {
  runId: string;
  workflowId: string;
  storyId?: string;
  triggeredBy?: string;
}): Promise<{
  success: boolean;
  runId: string;
  message: string;
  jobId?: string;
  agentId?: string;
}>
```

**Critical Path**:
1. Update status to 'running' BEFORE dispatch (race condition fix)
2. Build orchestrator instructions (get_current_step pattern)
3. Dispatch to laptop agent via `RemoteExecutionService.executeClaudeAgent()`
4. Return jobId for tracking

#### 2. Transcript Registration Service (`backend/src/remote-agent/transcript-registration.service.ts`)

**Purpose**: Handles automatic transcript detection from laptop agent

**Key Methods**:
- `handleTranscriptDetected()`: Processes WebSocket events from laptop
- `matchToWorkflow()`: Matches sessionId to active WorkflowRun
- `registerForLiveStreaming()`: Updates spawnedAgentTranscripts array
- `storeUnassignedTranscript()`: Fallback for unmatched transcripts

**Workflow**:
```typescript
1. Laptop agent detects new transcript (.jsonl file)
2. Parses first line for metadata (sessionId, agentId, type)
3. Sends transcript_detected event via WebSocket
4. Backend matches sessionId to WorkflowRun.metadata._transcriptTracking
5. Appends to WorkflowRun.metadata.spawnedAgentTranscripts
```

#### 3. Transcripts Service (`backend/src/workflow-runs/transcripts.service.ts`)

**Purpose**: Business logic for transcript upload and retrieval

**Key Methods**:
- `uploadAgentTranscript()`: Upload transcript from laptop to database
- `uploadMasterTranscripts()`: Upload all master transcripts on workflow completion
- `getTranscriptsForRun()`: Query transcripts grouped by master/agent
- `getTranscriptByComponentFromMetadata()`: Get specific component transcript

**Storage Strategy**:
- **Master transcripts**: Stored in `WorkflowRun.masterTranscriptPaths` array
- **Agent transcripts**: Stored in `WorkflowRun.metadata.spawnedAgentTranscripts` array
- **Fallback**: Read from laptop via RemoteRunner if not in database

#### 4. Master Session (`runner/src/cli/master-session.ts`)

**Purpose**: Persistent Claude Code session for orchestration

**Key Features**:
- Spawns Claude Code CLI with `--session-id` and `--output-format stream-json`
- Executes pre/post instructions via stdin
- Parses JSON responses from stdout
- Calculates transcript path: `.claude/projects/{escapedPath}/{sessionId}.jsonl`

**Transcript Path Calculation**:
```typescript
getTranscriptPath(): string {
  // Path escaping: /opt/stack/AIStudio → -opt-stack-AIStudio
  const escapedPath = this.options.workingDirectory
    .replace(/^\//, '-')
    .replace(/\//g, '-');
  return `${this.options.workingDirectory}/.claude/projects/${escapedPath}/${this.options.sessionId}.jsonl`;
}
```

#### 5. Start Runner MCP Tool (`backend/src/mcp/servers/runner/start_runner.ts`)

**Purpose**: MCP tool to start workflow execution

**ST-195 Implementation**:
- Validates workflow and run exist
- Calls backend REST endpoint via HTTP: `POST /api/runner/{runId}/start`
- Returns jobId and agentId from laptop dispatch

**Critical Note**: MCP runs as standalone process, cannot access NestJS services directly

#### 6. Start Team Run MCP Tool (`backend/src/mcp/servers/execution/start_workflow_run.ts`)

**Purpose**: Initialize workflow run with transcript tracking

**Required Parameters (ST-170)**:
- `sessionId`: From SessionStart hook (required for transcript matching)
- `transcriptPath`: From SessionStart hook (required for live streaming)
- `cwd`: Host path where Claude Code runs

**Transcript Registration**:
```typescript
// Stored in WorkflowRun
masterTranscriptPaths: [transcriptPath],
metadata: {
  _transcriptTracking: {
    sessionId: sessionId,
    transcriptPath: transcriptPath,
  }
}
```

## Existing Test Patterns

### 1. E2E Test: `e2e/15-transcript-streaming-e2e.spec.ts`

**Scope**: Production environment verification

**Test Coverage**:
- Pre-flight checks (laptop agent online, workflow runs with transcripts)
- Master transcript streaming (UI interaction with play button)
- Agent transcript verification (API metadata checks)
- WebSocket connectivity

**Key Patterns**:
```typescript
// Wait for streaming to start
const result = await Promise.race([
  // Option 1: Lines appear
  page.waitForFunction(() => { /* check for "N lines" */ }),
  // Option 2: Button becomes disabled (loading state)
  page.waitForSelector('button:disabled'),
  // Option 3: Timeout
  setTimeout(15000)
]);
```

### 2. Integration Test: `backend/src/e2e/ep8-story-runner/transcript-registration-mcp.e2e.test.ts`

**Scope**: MCP tool integration with live database

**Test Coverage**:
- Setup via MCP tools (project, story, agent, team, state)
- Master transcript registration via `start_team_run`
- Agent transcript registration via `spawn_agent`
- WebSocket live streaming verification
- Team run results verification

**Key Patterns**:
```typescript
// Master transcript registration
const result = await startWorkflowRun(prisma, {
  teamId: ctx.teamId!,
  storyId: ctx.storyId!,
  triggeredBy: 'test',
  cwd: '/path/to/project',
  sessionId: testSessionId,
  transcriptPath: testTranscriptPath,
});

// Verify registration
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
expect(run!.masterTranscriptPaths).toContain(testTranscriptPath);
```

### 3. Unit Tests: `backend/src/runner/__tests__/runner.service.registerTranscript.test.ts`

**Scope**: Isolated RunnerService.registerTranscript() method

**Test Coverage**:
- Master transcript registration
- Agent transcript registration
- Path validation (no traversal)
- Error handling

## Database Schema

### WorkflowRun Table

```prisma
model WorkflowRun {
  id                      String    @id @default(uuid())
  workflowId              String
  projectId               String
  storyId                 String?
  status                  RunStatus @default(pending)
  startedAt               DateTime?
  finishedAt              DateTime?
  currentStateId          String?

  // ST-170: Master transcript tracking
  masterTranscriptPaths   String[]  @default([])

  // ST-170: Agent transcript tracking (in metadata.spawnedAgentTranscripts)
  // ST-189: Transcript tracking metadata (sessionId, transcriptPath)
  metadata                Json?

  workflow                Workflow  @relation(...)
  project                 Project   @relation(...)
  story                   Story?    @relation(...)
  componentRuns           ComponentRun[]
}
```

### Metadata Structure

```typescript
interface WorkflowRunMetadata {
  // ST-170: Transcript tracking
  _transcriptTracking?: {
    sessionId: string;
    transcriptPath: string;
  };

  // ST-170: Spawned agent transcripts
  spawnedAgentTranscripts?: Array<{
    componentId?: string;
    agentId: string;
    transcriptPath: string;
    spawnedAt: string;
  }>;

  // Checkpoint data
  checkpoint?: RunnerCheckpoint;
  lastCheckpointAt?: string;

  // Status tracking
  lastStatus?: RunnerStatus;
  lastStatusAt?: string;
}
```

## Critical Dependencies

### NPM Packages
- `@prisma/client`: Database ORM
- `ws`: WebSocket server/client
- `uuid`: Session ID generation
- `child_process`: Claude Code CLI spawning

### Backend Services
- `PrismaService`: Database access
- `RemoteExecutionService`: Laptop agent communication
- `TranscriptRegistrationService`: Transcript detection
- `RunnerService`: Orchestration logic
- `WebSocketGateway`: Live streaming

### Frontend Services
- `transcripts.service.ts`: API client for transcript queries
- `useTranscriptStream.ts`: Hook for live streaming
- `LiveTranscriptViewer.tsx`: UI component

## Potential Risks for Testing

### 1. Race Conditions

**Risk**: SessionId mismatch between pre-generated and actual Claude Code session

**Mitigation**: ST-195 fix (a50c329) updates metadata with actual sessionId from session_init event

**Test Strategy**: Verify metadata._transcriptTracking.sessionId matches actual session

### 2. Transcript Path Calculation

**Risk**: Path escaping differences between laptop and backend

**Current Logic**:
```typescript
// Laptop (master-session.ts)
const escapedPath = cwd.replace(/^\//, '-').replace(/\//g, '-');
const path = `${cwd}/.claude/projects/${escapedPath}/${sessionId}.jsonl`;

// Example: /opt/stack/AIStudio → /opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/{sessionId}.jsonl
```

**Test Strategy**: Verify calculated path matches actual transcript file location

### 3. WebSocket Connection Stability

**Risk**: Connection drops during long-running workflows

**Mitigation**: Auto-reconnect in frontend (useTranscriptStream hook)

**Test Strategy**: Test reconnection by temporarily killing WebSocket connection

### 4. Laptop Agent Offline

**Risk**: Workflow fails if laptop agent disconnected

**Mitigation**: `agentOffline` flag returned by spawn_agent, status updated to 'failed'

**Test Strategy**: Test workflow behavior when laptop agent offline

### 5. Transcript File Permissions

**Risk**: Backend cannot read transcript from laptop filesystem

**Mitigation**: RemoteRunner executes 'read-file' capability on laptop

**Test Strategy**: Verify file read permissions and path accessibility

## Git History Insights

### Key Commits Related to ST-195

1. **52222e4**: feat(ST-195): Replace Docker Runner with Laptop Orchestrator
   - Introduced laptop-based execution model
   - Removed Docker container runner

2. **2936f67**: feat(ST-195): Launch Docker Runner from web UI execute endpoint
   - Added POST /stories/:id/execute REST endpoint

3. **b1ae8ad**: fix(ST-195): Enable Docker Runner spawning from backend container
   - Fixed container communication

4. **a244f3d**: fix(ST-195): Fix runner Dockerfile with multi-stage build
   - Build fixes

5. **63befde**: fix(ST-195): Update start_runner MCP tool to use HTTP calls
   - MCP tool now calls REST API instead of direct service access

### Related Transcript Work

1. **38be43d**: feat(ST-189): Add transcript registration REST endpoint
   - `/api/runner/workflow-runs/:runId/transcripts`

2. **fe6f01f**: fix(ST-168): Read transcripts from database table first, fallback to laptop
   - Hybrid storage model

3. **725a93b**: fix(ST-168): Store transcripts in Transcript table, not Artifact
   - Database model clarification

4. **4490dfd**: feat(ST-182): Add live agent transcript streaming via Live Feed button
   - UI live streaming feature

5. **da67a53**: feat(ST-182): Live master session transcript streaming
   - Master transcript streaming

## Files Relevant to Testing

### Core Implementation Files

1. **backend/src/runner/runner.service.ts** (597 lines)
   - `launchDockerRunner()`: Main orchestration entry point
   - `registerTranscript()`: HTTP-callable registration
   - Race condition fix (lines 424-433)

2. **backend/src/runner/runner.controller.ts** (604 lines)
   - REST API endpoints
   - `POST /api/runner/:runId/start` (line 522)
   - `POST /api/runner/workflow-runs/:runId/transcripts` (line 505)

3. **backend/src/remote-agent/transcript-registration.service.ts** (280 lines)
   - `handleTranscriptDetected()`: WebSocket event handler
   - `matchToWorkflow()`: SessionId matching
   - `registerForLiveStreaming()`: Metadata updates

4. **backend/src/workflow-runs/transcripts.service.ts** (523 lines)
   - `uploadAgentTranscript()`: Upload to database
   - `uploadMasterTranscripts()`: Batch upload
   - `getTranscriptByComponentFromMetadata()`: Query with fallback

5. **backend/src/mcp/servers/execution/start_workflow_run.ts**
   - `start_team_run` MCP tool
   - Requires sessionId and transcriptPath (ST-170)

6. **backend/src/mcp/servers/runner/start_runner.ts** (191 lines)
   - `start_runner` MCP tool
   - HTTP call to `/api/runner/{runId}/start`

7. **runner/src/cli/master-session.ts** (302 lines)
   - Claude Code CLI management
   - `getTranscriptPath()`: Path calculation

### Test Files

1. **e2e/15-transcript-streaming-e2e.spec.ts** (383 lines)
   - Production environment E2E tests
   - UI interaction patterns
   - WebSocket verification

2. **backend/src/e2e/ep8-story-runner/transcript-registration-mcp.e2e.test.ts** (423 lines)
   - MCP integration tests
   - Live database operations
   - Cleanup patterns

3. **backend/src/runner/__tests__/runner.service.registerTranscript.test.ts**
   - Unit tests for registerTranscript()

### Supporting Files

1. **backend/src/remote-agent/remote-agent.gateway.ts**
   - WebSocket gateway
   - session_init handler (ST-195 fix)
   - claude_complete handler (ST-195 fix)

2. **laptop-agent/src/agent.ts**
   - Laptop agent implementation
   - sessionId reporting in completion event

3. **frontend/src/components/workflow-viz/MasterTranscriptPanel.tsx**
   - UI for master transcript viewing

4. **frontend/src/hooks/useTranscriptStream.ts**
   - WebSocket streaming hook

## Test Coverage Gaps

### Areas Not Currently Tested

1. **Concurrent Workflow Runs**
   - Multiple workflows with same sessionId prefix
   - Transcript path collisions

2. **Large Transcript Files**
   - Files exceeding quota limits (10MB per run)
   - Streaming performance

3. **Network Failures**
   - Laptop agent disconnect mid-execution
   - WebSocket reconnection with transcript sync

4. **Edge Cases**
   - Empty transcript files
   - Malformed JSONL data
   - Missing first line metadata

5. **Performance**
   - 100+ agent spawns in single workflow
   - Transcript parsing latency

## Recommended Test Strategy for ST-199

### 1. Verify ST-195 Fixes Work Correctly

**Test**: Race condition fix
```typescript
// Verify status updated BEFORE dispatch
const run1 = await prisma.workflowRun.findUnique({ where: { id: runId } });
expect(run1.status).toBe('running'); // Before agent job created

// Verify get_current_step succeeds immediately
const step = await getCurrentStep({ runId });
expect(step.workflowSequence).toBeDefined();
```

**Test**: SessionId metadata update
```typescript
// Start workflow run
const result = await startRunner({ runId, workflowId });

// Wait for session_init event
await waitForEvent('session_init', 5000);

// Verify metadata updated with actual sessionId
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
const metadata = run.metadata as any;
expect(metadata._transcriptTracking.sessionId).toBeDefined();
expect(metadata._transcriptTracking.sessionId).not.toBe(''); // Not pre-generated
```

### 2. Test Transcript Registration Flow

**Test**: Master transcript registration
```typescript
// Verify masterTranscriptPaths populated
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
expect(run.masterTranscriptPaths.length).toBeGreaterThan(0);
expect(run.masterTranscriptPaths[0]).toMatch(/\.jsonl$/);
```

**Test**: Agent transcript registration
```typescript
// Spawn agent, verify transcript added
const result = await spawnAgent({ componentId, stateId, workflowRunId });

// Wait for transcript_detected event
await waitForEvent('transcript_detected', 10000);

// Verify spawnedAgentTranscripts updated
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
const metadata = run.metadata as any;
expect(metadata.spawnedAgentTranscripts.length).toBeGreaterThan(0);
```

### 3. Test Live Streaming

**Test**: WebSocket connectivity
```typescript
// Connect to WebSocket
const ws = new WebSocket(`ws://localhost:3000/api/ws/transcript/${runId}`);

// Wait for connection
await new Promise(resolve => ws.on('open', resolve));

// Verify streaming_started event
const event = await waitForWsMessage(ws, 'streaming_started', 5000);
expect(event.transcriptPath).toBeDefined();
```

**Test**: UI integration
```typescript
// Navigate to workflow monitor
await page.goto(`/team-runs/${runId}/monitor`);

// Click "Start live streaming" button
await page.click('button:has-text("Start live streaming")');

// Verify lines appear
const lineCount = await page.waitForFunction(
  () => document.body.textContent?.match(/(\d+) lines?/)?.[1]
);
expect(parseInt(lineCount)).toBeGreaterThan(0);
```

### 4. Test Error Conditions

**Test**: Laptop agent offline
```typescript
// Stop laptop agent
await stopLaptopAgent();

// Attempt to start runner
const result = await startRunner({ runId, workflowId });

// Verify failure handling
expect(result.success).toBe(false);
expect(result.message).toContain('No laptop agent available');

// Verify status updated to 'failed'
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
expect(run.status).toBe('failed');
```

**Test**: Transcript file not found
```typescript
// Register invalid transcript path
await registerTranscript(runId, {
  type: 'master',
  transcriptPath: '/nonexistent/path.jsonl',
  sessionId: 'test-session',
});

// Attempt to stream
// Should fail gracefully without crashing
```

## Implementation Checklist

- [ ] Create test project/story/team via MCP tools
- [ ] Start workflow run with transcript tracking
- [ ] Verify status updated BEFORE dispatch (ST-195 fix)
- [ ] Verify metadata updated with actual sessionId (ST-195 fix)
- [ ] Wait for session_init event
- [ ] Verify masterTranscriptPaths populated
- [ ] Spawn test agent
- [ ] Wait for transcript_detected event
- [ ] Verify spawnedAgentTranscripts updated
- [ ] Test WebSocket connection
- [ ] Test UI transcript viewer
- [ ] Test live streaming start/stop
- [ ] Test laptop agent offline scenario
- [ ] Test concurrent workflow runs
- [ ] Cleanup test data

## Conclusion

The Docker Runner transcript streaming system after ST-195 is complex but well-architected:

1. **Laptop Orchestrator Pattern**: Clean separation between KVM backend and laptop execution
2. **Dual Registration**: Both HTTP endpoint and WebSocket event handling for flexibility
3. **Hybrid Storage**: Database for persistence, laptop filesystem for live streaming
4. **Race Condition Fixed**: Status updated BEFORE agent dispatch
5. **SessionId Tracking**: Actual Claude Code sessionId written to metadata

The main testing focus should be:
- Verifying ST-195 fixes work correctly (race condition, sessionId)
- Testing transcript registration flow (master + agent)
- Testing live streaming via WebSocket
- Testing error conditions (agent offline, file not found)

Existing test patterns provide good coverage but should be extended for edge cases and performance scenarios.
