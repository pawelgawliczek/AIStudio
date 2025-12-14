# Live Streaming Architecture

**Version:** 1.0
**Last Updated:** 2025-12-14
**Epic:** ST-220

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Execution Modes Comparison](#execution-modes-comparison)
4. [WebSocket Events Reference](#websocket-events-reference)
5. [Transcript Tracking Lifecycle](#transcript-tracking-lifecycle)
6. [Agent Tracking Patterns](#agent-tracking-patterns)
7. [Telemetry Collection](#telemetry-collection)
8. [Frontend Components](#frontend-components)
9. [Security](#security)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

The Live Streaming system provides real-time visibility into AI agent execution by streaming transcript data from the laptop (where Claude Code executes) to the browser via WebSocket connections. This enables developers to monitor agent progress, debug issues, and track execution costs in real-time.

### Key Concepts

- **Master Session**: The orchestrator session running on the laptop that coordinates workflow execution
- **Component Agent**: A spawned agent that executes a specific task (PM, Explorer, Architect, Designer, Implementer)
- **Transcript**: A JSONL file containing the conversation between user and Claude
- **Live Streaming**: Real-time file tailing that sends new transcript lines to the browser as they're written

### System Components

1. **Laptop Agent** (`vibestudio-agent.sh`): Runs on developer's machine, monitors transcript files
2. **RemoteAgentGateway** (`/remote-agent` namespace): Receives events from laptop agent
3. **AppWebSocketGateway** (`/` namespace): Broadcasts events to frontend clients
4. **Frontend Components**: Display live transcript data in the browser

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Laptop (Developer Machine)                                          │
│                                                                      │
│  ┌──────────────────────┐         ┌─────────────────────────────┐  │
│  │ Claude Code          │         │ vibestudio-agent.sh         │  │
│  │ (Master Session)     │──writes→│ - Watch transcripts (ST-170)│  │
│  │                      │         │ - Tail files (chokidar)     │  │
│  │ ~/.claude/sessions/  │         │ - Send via WebSocket        │  │
│  │   session-123.jsonl  │         └────────────┬────────────────┘  │
│  └──────────────────────┘                      │                    │
│                                                 │ WebSocket          │
└─────────────────────────────────────────────────┼────────────────────┘
                                                  │
                                                  │ emit('transcript:lines')
                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend (KVM Server)                                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ RemoteAgentGateway                                           │  │
│  │ Namespace: /remote-agent                                     │  │
│  │                                                              │  │
│  │ Handlers:                                                    │  │
│  │  - transcript:lines          → broadcast to room directly   │  │
│  │  - transcript:batch          → broadcast to room directly   │  │
│  │  - transcript:error          → broadcast to room directly   │  │
│  │  - transcript:streaming_started → broadcast to room directly│  │
│  │  - transcript:streaming_stopped → broadcast to room directly│  │
│  │                                                              │  │
│  │ ST-233: Direct broadcasting via appWebSocketGateway.server  │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
│                         │ appWebSocketGateway.server.to(room).emit()│
│                         ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ AppWebSocketGateway                                          │  │
│  │ Namespace: / (default)                                       │  │
│  │                                                              │  │
│  │ Rooms: master-transcript:{runId}                            │  │
│  │                                                              │  │
│  │ Events emitted by RemoteAgentGateway:                        │  │
│  │  - master-transcript:streaming_started                       │  │
│  │  - master-transcript:lines                                   │  │
│  │  - master-transcript:batch                                   │  │
│  │  - master-transcript:error                                   │  │
│  │  - master-transcript:stopped                                 │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Socket.IO
                          │ (Authenticated WebSocket)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (Browser)                                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ MasterTranscriptPanel.tsx                                    │  │
│  │                                                              │  │
│  │ useEffect(() => {                                            │  │
│  │   socket.on('master-transcript:lines', handleLines)          │  │
│  │ }, [socket])                                                 │  │
│  │                                                              │  │
│  │ Display: Parsed conversation view OR Raw JSONL view         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Execution Modes Comparison

The system supports two execution modes: **Manual Mode** (interactive development) and **Docker Runner** (autonomous execution).

### Manual Mode (MasterSession with get_current_step → advance_step)

**Flow:**
1. Developer calls `/start_team_run` MCP tool → registers master transcript
2. Developer calls `/get_current_step` → gets instructions for current phase
3. Developer spawns component agents manually (via Task tool)
4. Developer calls `/advance_step` → automatic agent tracking + state transition

**Agent Tracking:**
- **Start:** Automatic via `advance_step` when entering agent phase
- **Complete:** Automatic via `advance_step` when exiting agent phase
- **Call Hierarchy:**
  - `advance_step` → `startAgentTracking()` → creates ComponentRun
  - `advance_step` → `completeAgentTracking()` → updates ComponentRun

**Transcript Registration:**
- Master transcript: Registered at `start_team_run` (ST-172)
- Component transcripts: Tracked via `spawnedAgentTranscripts` in WorkflowRun metadata
- Live streaming: Master session via laptop agent file tailing

**Telemetry:**
- Tokens tracked via transcript parsing on completion
- Turn metrics computed from transcript
- Component summary auto-generated or provided

### Docker Runner Mode (start_runner → WebSocket orchestration)

**Flow:**
1. Backend calls `/start_runner` MCP tool → spawns autonomous runner
2. Runner calls backend APIs directly (not MCP tools)
3. Runner spawns component agents via WebSocket commands
4. Runner tracks progress via API calls

**Agent Tracking:**
- **Start:** API call via `backendClient.recordAgentStart()`
- **Complete:** API call via `backendClient.recordAgentComplete()`
- **Call Hierarchy:**
  - `runner.ts` → `backendClient.recordAgentStart()` → POST `/component-runs/start`
  - `runner.ts` → `backendClient.recordAgentComplete()` → POST `/component-runs/:id/complete`

**Transcript Registration:**
- Master transcript: Registered at `start_team_run` (same as manual)
- Component transcripts: Runner reports via API after completion
- Live streaming: Same as manual (via laptop agent)

**Telemetry:**
- Tokens tracked via API response from agent execution
- Turn metrics computed by runner
- Component summary generated by runner

### Comparison Table

| Aspect | Manual Mode | Docker Runner |
|--------|-------------|---------------|
| **Orchestration** | Developer-driven MCP calls | Autonomous runner process |
| **Agent Start** | `advance_step` (automatic) | `backendClient.recordAgentStart()` |
| **Agent Complete** | `advance_step` (automatic) | `backendClient.recordAgentComplete()` |
| **State Transition** | `advance_step` MCP tool | Runner internal logic |
| **Transcript Tracking** | MCP metadata updates | API metadata updates |
| **Live Streaming** | Laptop agent (same) | Laptop agent (same) |
| **Use Case** | Interactive development | Background/autonomous tasks |

---

## WebSocket Events Reference

### Frontend → Backend (Subscribe/Unsubscribe)

#### `master-transcript:subscribe`
Subscribe to real-time transcript streaming for a workflow run.

**Payload:**
```typescript
{
  runId: string;          // WorkflowRun UUID
  sessionIndex: number;   // Session index (0 = initial, 1+ = compacted sessions)
  filePath: string;       // Absolute path to transcript file
  fromBeginning?: boolean; // Whether to stream historical content (default: true)
}
```

**Response:** Emits `master-transcript:streaming_started` when ready.

#### `master-transcript:unsubscribe`
Stop streaming transcript for a workflow run.

**Payload:**
```typescript
{
  runId: string;
  sessionIndex: number;
}
```

### Backend → Frontend (Events)

#### `master-transcript:streaming_started`
Streaming has started successfully.

**Payload:**
```typescript
{
  runId: string;
  sessionIndex: number;
  filePath: string;
  fileSize: number;        // Current file size in bytes
  startPosition: number;   // Position where streaming starts
}
```

#### `master-transcript:lines`
New transcript lines (live streaming).

**Payload:**
```typescript
{
  runId: string;
  sessionIndex: number;
  lines: Array<{
    line: string;          // JSONL line content
    sequenceNumber: number; // Line number
  }>;
  isHistorical: boolean;   // false for new lines, true for backfill
  timestamp: string;       // ISO timestamp
}
```

#### `master-transcript:batch`
Batch of historical lines (initial load).

**Payload:** Same as `master-transcript:lines` but `isHistorical: true`.

#### `master-transcript:error`
Streaming error occurred.

**Payload:**
```typescript
{
  runId: string;
  sessionIndex: number;
  error: string;           // Error message
  code: string;            // Error code (e.g., 'NO_AGENT', 'FILE_NOT_FOUND')
}
```

#### `master-transcript:stopped`
Streaming has stopped (no more subscribers).

**Payload:**
```typescript
{
  runId: string;
  sessionIndex: number;
}
```

### Component Transcript Events (ST-176)

#### `transcript:subscribe`
Subscribe to component agent transcript.

**Payload:**
```typescript
{
  componentRunId: string;
}
```

#### `transcript:line`
New line from component transcript.

**Payload:**
```typescript
{
  componentRunId: string;
  line: string;            // Redacted JSONL line
  sequenceNumber: number;
  timestamp: Date;
}
```

#### `transcript:complete`
Component transcript finished.

**Payload:**
```typescript
{
  componentRunId: string;
  totalLines: number;
}
```

---

## Session Tracker Mechanism

### Overview

The Session Tracker is a critical component that manages the registration and tracking of Claude Code transcripts for both master orchestrator sessions and spawned component agents. It ensures that transcripts are properly linked to workflow runs and component executions for live streaming and telemetry collection.

### TranscriptRegistrationService

**Location:** `backend/src/remote-agent/transcript-registration.service.ts`

**Purpose:** Centralized service for registering and tracking transcripts across the system.

**Key Methods:**

#### `registerMasterTranscript(params)`
Registers a master orchestrator transcript at workflow start.

```typescript
registerMasterTranscript({
  sessionId: string;        // Pre-generated or actual Claude Code sessionId
  transcriptPath: string;   // Absolute path to transcript file
  workflowRunId: string;    // WorkflowRun UUID
  projectPath: string;      // Project directory
})
```

**Actions:**
- Stores transcript path in `WorkflowRun.masterTranscriptPaths`
- Stores tracking metadata in `WorkflowRun.metadata._transcriptTracking`
- Broadcasts `master-transcript:registered` WebSocket event

#### `updateSessionId(params)`
Updates the sessionId when Claude Code reports its actual session ID.

```typescript
updateSessionId({
  workflowRunId: string;
  actualSessionId: string;
})
```

**Actions:**
- Updates `WorkflowRun.metadata._transcriptTracking.actualSessionId`
- Maintains backward compatibility with pre-generated sessionId

#### `resolveTranscriptBySessionId(sessionId)`
Matches a transcript to a workflow run using sessionId.

```typescript
resolveTranscriptBySessionId(sessionId: string): Promise<WorkflowRun | null>
```

**Use Case:** When laptop agent detects a new transcript file, it reports the sessionId. This method finds the corresponding workflow run.

### Agent Tracking Functions

**Location:** `backend/src/mcp/servers/workflows/agent-tracking.ts`

#### `startAgentTracking(prisma, params)`
Creates a ComponentRun record when a component agent starts execution.

```typescript
startAgentTracking(prisma, {
  runId: string;          // WorkflowRun UUID
  componentId: string;    // Component UUID from workflow state
  transcriptPath?: string; // Optional: transcript path if known
  sessionId?: string;     // Optional: Claude Code sessionId
})
```

**Actions:**
- Creates `ComponentRun` with `status='running'`
- Stores transcript metadata in `spawnedAgentTranscripts` array
- Broadcasts `component:started` WebSocket event
- Records `startedAt` timestamp

**Called By:**
- Manual Mode: `advance_step` when entering agent phase
- Docker Runner: `backendClient.recordAgentStart()` API

#### `completeAgentTracking(prisma, params)`
Updates a ComponentRun record when a component agent completes.

```typescript
completeAgentTracking(prisma, {
  runId: string;
  componentId: string;
  output?: object;              // Agent output data
  status: 'completed' | 'failed';
  errorMessage?: string;
  componentSummary?: string | object; // Structured summary
})
```

**Actions:**
- Updates `ComponentRun` with `status`, `output`, `finishedAt`
- Parses transcript for token metrics (if transcript available)
- Generates or stores component summary
- Broadcasts `component:completed` WebSocket event
- Calculates execution duration

**Called By:**
- Manual Mode: `advance_step` when exiting agent phase
- Docker Runner: `backendClient.recordAgentComplete()` API

### Data Structures

#### WorkflowRun.metadata._transcriptTracking

```typescript
{
  _transcriptTracking: {
    sessionId: string;              // Pre-generated sessionId (ST-172)
    actualSessionId?: string;       // Actual Claude Code sessionId (ST-195)
    orchestratorTranscript: string; // Expected transcript path
    projectPath: string;            // Project directory
    transcriptDirectory: string;    // ~/.claude/sessions/
    orchestratorStartTime: string;  // ISO timestamp
  }
}
```

**Purpose:**
- Track expected vs actual sessionId for matching
- Store project context for transcript resolution
- Record workflow start time for debugging

#### WorkflowRun.spawnedAgentTranscripts

```typescript
{
  spawnedAgentTranscripts: Array<{
    componentId: string;      // Component UUID
    transcriptPath: string;   // Absolute path to agent transcript
    sessionId: string;        // Claude Code sessionId
    spawnedAt: string;        // ISO timestamp
  }>
}
```

**Purpose:**
- Track all component agent transcripts for a workflow run
- Enable live streaming for component executions
- Support telemetry collection and cost tracking

#### ComponentRun Fields

```typescript
{
  id: string;
  workflowRunId: string;
  componentId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  durationSeconds?: number;
  output?: object;
  componentSummary?: object;  // Structured summary (ST-203)
  tokensInput: number;
  tokensOutput: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
  estimatedCost: number;
}
```

### Flow Example

**Manual Mode (advance_step):**

```
1. start_team_run
   └─ registerMasterTranscript() → stores transcript path, sessionId

2. advance_step (enter agent phase)
   └─ startAgentTracking() → creates ComponentRun with status='running'

3. advance_step (exit agent phase)
   └─ completeAgentTracking()
      ├─ Parse transcript for metrics
      ├─ Generate component summary
      └─ Update ComponentRun with results
```

**Docker Runner:**

```
1. start_team_run
   └─ registerMasterTranscript() → stores transcript path, sessionId

2. runner.spawnAgentForState()
   └─ backendClient.recordAgentStart()
      └─ POST /api/component-runs/start
         └─ startAgentTracking() → creates ComponentRun

3. runner (agent completes)
   └─ backendClient.recordAgentComplete()
      └─ POST /api/component-runs/:id/complete
         └─ completeAgentTracking() → updates ComponentRun
```

---

## Transcript Tracking Lifecycle

### 1. Workflow Start (ST-172)

**Tool:** `start_team_run`

**Actions:**
- Generate sessionId (pre-registration)
- Register master transcript path in `WorkflowRun.masterTranscriptPaths`
- Store tracking metadata in `WorkflowRun.metadata._transcriptTracking`:

```typescript
{
  _transcriptTracking: {
    sessionId: string;              // Pre-generated sessionId
    orchestratorTranscript: string; // Expected transcript path
    projectPath: string;            // Project directory
    transcriptDirectory: string;    // ~/.claude/sessions/
    orchestratorStartTime: string;  // ISO timestamp
  }
}
```

### 2. Session Init (ST-195)

**Event:** `agent:claude_progress` with `type: 'session_init'`

**Actions (remote-agent.gateway.ts):**
- Extract actual sessionId from Claude Code
- Update `WorkflowRun.metadata._transcriptTracking.sessionId` with actual value
- Update `WorkflowRun.metadata._transcriptTracking.actualSessionId`

**Why:** The pre-generated sessionId is replaced with Claude Code's actual session ID for transcript matching.

### 3. Transcript Detection (ST-170)

**Event:** `agent:transcript_detected` from laptop agent

**Actions (transcript-registration.service.ts):**
- Match transcript to workflow using sessionId
- Add to `masterTranscriptPaths` if not already present
- Start live streaming if frontend is subscribed

### 4. Component Agent Spawn (ST-215)

**Manual Mode:**
- `advance_step` → `startAgentTracking()` → creates ComponentRun with status='running'
- Transcript path stored in `WorkflowRun.spawnedAgentTranscripts`:

```typescript
{
  componentId: string;
  transcriptPath: string;
  sessionId: string;
  spawnedAt: string;
}
```

**Docker Runner:**
- `runner.ts` → `backendClient.recordAgentStart()` → creates ComponentRun
- Same metadata structure

### 5. Component Agent Complete (ST-215)

**Manual Mode:**
- `advance_step` → `completeAgentTracking()` → updates ComponentRun with status='completed'
- Parses transcript for metrics (tokens, turns)
- Generates component summary

**Docker Runner:**
- `runner.ts` → `backendClient.recordAgentComplete()` → updates ComponentRun
- Same processing

### 6. Workflow Complete

**Tool:** `update_team_status` with `status: 'completed'`

**Actions:**
- Upload all transcripts to Artifact table (ST-168)
- Stop all live streaming
- Archive transcript files (future: ST-185)

---

## Agent Tracking Patterns

### ComponentRun Lifecycle

```
┌─────────────┐
│  NOT_STARTED│ (no ComponentRun record)
└──────┬──────┘
       │
       │ startAgentTracking() or recordAgentStart()
       ▼
┌─────────────┐
│   RUNNING   │ (ComponentRun created with status='running')
└──────┬──────┘
       │
       │ completeAgentTracking() or recordAgentComplete()
       ▼
┌─────────────┐
│ COMPLETED   │ (ComponentRun updated with output, metrics, summary)
│  or FAILED  │
└─────────────┘
```

### Agent Tracking Call Hierarchy

#### Manual Mode (via advance_step)

```
advance_step MCP tool
├─ enterAgentPhase()
│  └─ startAgentTracking(prisma, { runId, componentId })
│     ├─ Creates ComponentRun with status='running'
│     ├─ Broadcasts component:started WebSocket event
│     └─ Starts transcript tailing (if available)
│
└─ exitAgentPhase()
   └─ completeAgentTracking(prisma, { runId, componentId, output, status })
      ├─ Updates ComponentRun with output, metrics, summary
      ├─ Broadcasts component:completed WebSocket event
      └─ Stops transcript tailing
```

#### Docker Runner (via API)

```
runner.ts
├─ spawnAgentForState()
│  └─ backendClient.recordAgentStart({ workflowRunId, componentId })
│     └─ POST /api/component-runs/start
│        ├─ Creates ComponentRun with status='running'
│        ├─ Broadcasts component:started WebSocket event
│        └─ Starts transcript tailing (if available)
│
└─ (agent completes)
   └─ backendClient.recordAgentComplete({ componentRunId, success, output, metrics })
      └─ POST /api/component-runs/:id/complete
         ├─ Updates ComponentRun with output, metrics, summary
         ├─ Broadcasts component:completed WebSocket event
         └─ Stops transcript tailing
```

### Turn Metrics (ST-147)

Computed from transcript parsing:

```typescript
{
  turnMetrics: {
    totalTurns: number;      // All user messages (manual + auto-continue)
    manualPrompts: number;   // Actual user-typed input
    autoContinues: number;   // Auto-continue/confirmation prompts
  }
}
```

**Source:** Transcript JSONL parsing counts messages by `event_type: 'message_start'`.

---

## Telemetry Collection

### Token Tracking

**Sources:**
1. **Agent StreamEvents** (ST-150): Real-time token updates during execution
2. **Transcript Parsing**: Final token counts from `message_delta` events
3. **ComponentRun Aggregation**: Summed across all component runs

**Storage:**
```typescript
ComponentRun {
  tokensInput: number;
  tokensOutput: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
}

WorkflowRun {
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokensCacheWrite: number;
  totalTokensCacheRead: number;
  estimatedCost: number;
}
```

### Duration Tracking

**Computed:**
- **ComponentRun**: `durationSeconds = (finishedAt - startedAt) / 1000`
- **WorkflowRun**: `executionTimeSeconds = sum(componentRun.durationSeconds)`

### Cost Estimation

**Formula:**
```typescript
const CLAUDE_OPUS_4_5_PRICING = {
  input: 0.015 / 1000,        // $0.015 per 1K input tokens
  output: 0.075 / 1000,       // $0.075 per 1K output tokens
  cacheWrite: 0.01875 / 1000, // Cache write: 1.25x input
  cacheRead: 0.0015 / 1000,   // Cache read: 0.10x input
};

estimatedCost =
  (tokensInput * CLAUDE_OPUS_4_5_PRICING.input) +
  (tokensOutput * CLAUDE_OPUS_4_5_PRICING.output) +
  (tokensCacheWrite * CLAUDE_OPUS_4_5_PRICING.cacheWrite) +
  (tokensCacheRead * CLAUDE_OPUS_4_5_PRICING.cacheRead);
```

---

## Frontend Components

### MasterTranscriptPanel.tsx

**Purpose:** Display live master session transcript in the browser.

**Features:**
- Multi-session support (tabs for compacted sessions)
- Live streaming with play/stop controls
- Parsed conversation view (user/assistant turns)
- Raw JSONL view (debugging)
- Connection status indicator (agent online/offline)
- Auto-scroll to bottom on new lines

**Usage:**
```tsx
<MasterTranscriptPanel
  runId={workflowRun.id}
  masterTranscriptPaths={workflowRun.masterTranscriptPaths}
  socket={socket}
  isAgentOnline={agentStatus.online}
  agentHostname={agentStatus.hostname}
/>
```

**WebSocket Integration:**
```typescript
useEffect(() => {
  socket.on('master-transcript:streaming_started', handleStreamingStarted);
  socket.on('master-transcript:lines', handleLines);
  socket.on('master-transcript:batch', handleBatch);
  socket.on('master-transcript:error', handleError);

  return () => {
    socket.off('master-transcript:streaming_started', handleStreamingStarted);
    socket.off('master-transcript:lines', handleLines);
    socket.off('master-transcript:batch', handleBatch);
    socket.off('master-transcript:error', handleError);
  };
}, [socket, runId]);
```

### useTranscriptStream Hook

**Purpose:** Manage transcript streaming state.

**API:**
```typescript
const {
  lines,
  isStreaming,
  error,
  startStreaming,
  stopStreaming,
} = useTranscriptStream(socket, runId, sessionIndex);
```

### TranscriptParser Utility

**Purpose:** Parse JSONL transcripts into conversation turns.

**API:**
```typescript
const parser = new TranscriptParser();
const { turns, metadata } = parser.parseJSONL(transcriptContent);

// Turn structure
interface ConversationTurn {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name: string; input: any }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
}
```

---

## Security

### Path Traversal Protection

**Whitelist (transcript-tail.service.ts):**
```typescript
const ALLOWED_TRANSCRIPT_DIRECTORIES = [
  '/Users/pawelgawliczek/.claude/projects',
  '/opt/stack/AIStudio',
];
```

**Validation:**
- Check file extension: `.jsonl` only
- Check for `../` or `..\\` in path
- Verify path starts with whitelisted directory

### Content Redaction

**Function:** `redactSensitiveData()` (from `mcp/utils/content-security.ts`)

**Patterns:**
- API keys (regex: `[A-Za-z0-9_-]{32,}`)
- JWT tokens
- Passwords
- SSH keys
- Database credentials

**Applied:**
- Before emitting `transcript:line` events
- Before storing transcripts in Artifact table

### WebSocket Authentication

**Flow:**
1. Frontend authenticates via `/auth/login` → receives JWT token
2. Frontend connects to WebSocket with JWT in handshake: `socket.handshake.auth.token`
3. AppWebSocketGateway verifies JWT and stores user in `socket.data.user`
4. All WebSocket events check `socket.data.user` for authorization

**Room-based Broadcasting:**
- Each workflow run has a private room: `master-transcript:{runId}`
- Only clients who explicitly subscribe join the room
- Subscription requires workflow access validation

---

## Troubleshooting Guide

### Problem: Transcript not streaming

**Symptoms:**
- Frontend shows "Waiting for transcript data..."
- No lines appearing in MasterTranscriptPanel
- Connection status shows "Offline"

**Diagnosis:**
1. Check laptop agent status:
   ```bash
   # On laptop
   ps aux | grep vibestudio-agent
   ```

2. Check WebSocket connection:
   ```typescript
   // In browser console
   socket.connected // should be true
   ```

3. Check backend logs:
   ```bash
   # On KVM
   docker logs -f vibestudio-backend | grep "ST-182"
   ```

**Solutions:**
- **Agent not running:** Start laptop agent via `vibestudio-agent.sh`
- **WebSocket disconnected:** Refresh browser, check JWT token validity
- **File not found:** Verify transcript path in `WorkflowRun.masterTranscriptPaths`
- **Permission denied:** Check file permissions on transcript file

### Problem: Agent tracking not working

**Symptoms:**
- ComponentRun not created when entering agent phase
- Component progress not showing in UI
- Missing telemetry data

**Diagnosis:**
1. Check ComponentRun creation:
   ```sql
   SELECT * FROM "ComponentRun" WHERE "workflowRunId" = 'run-uuid' ORDER BY "startedAt" DESC;
   ```

2. Check WorkflowRun metadata:
   ```sql
   SELECT metadata FROM "WorkflowRun" WHERE id = 'run-uuid';
   ```

3. Check advance_step logs:
   ```bash
   # Search for agent tracking logs
   grep "agent-tracking" backend.log
   ```

**Solutions:**
- **Manual mode:** Ensure `advance_step` is called (not manual `record_agent_start`)
- **Docker runner:** Ensure runner is using latest version with API tracking
- **Missing componentId:** Verify workflow state has componentId assigned
- **Database error:** Check Prisma logs for constraint violations

### Problem: Missing transcript paths

**Symptoms:**
- `WorkflowRun.masterTranscriptPaths` is empty
- Transcript not registered despite agent running
- "No transcript available" in UI

**Diagnosis:**
1. Check start_team_run call:
   ```typescript
   // Verify these params were provided
   { cwd, sessionId, transcriptPath }
   ```

2. Check transcript detection events:
   ```bash
   # Backend logs
   grep "ST-170.*Transcript detected" backend.log
   ```

3. Check WorkflowRun metadata:
   ```sql
   SELECT metadata->'_transcriptTracking' FROM "WorkflowRun" WHERE id = 'run-uuid';
   ```

**Solutions:**
- **Missing sessionId:** Ensure `start_team_run` includes sessionId from SessionStart hook
- **Missing transcriptPath:** Ensure `start_team_run` includes transcriptPath from SessionStart hook
- **Transcript not detected:** Verify laptop agent has `watch-transcripts` capability
- **SessionId mismatch:** Check that actual Claude Code sessionId matches registered sessionId

### Problem: Token counts are zero

**Symptoms:**
- ComponentRun shows 0 tokens despite agent execution
- Estimated cost is $0.00
- Metrics missing in UI

**Diagnosis:**
1. Check ComponentRun record:
   ```sql
   SELECT "tokensInput", "tokensOutput", "tokensCacheWrite", "tokensCacheRead"
   FROM "ComponentRun"
   WHERE id = 'run-uuid';
   ```

2. Check transcript content:
   ```bash
   # Look for message_delta events with usage data
   grep "message_delta" transcript.jsonl | grep "usage"
   ```

**Solutions:**
- **Transcript not parsed:** Ensure `record_agent_complete` is called with transcript parsing
- **No usage data in transcript:** Verify Claude Code version supports usage reporting
- **Parsing error:** Check logs for transcript parsing errors
- **Manual mode:** Ensure `advance_step` completes agent phase (triggers parsing)

---

## References

- **ST-172**: Master Session Transcript Registration
- **ST-176**: Real-Time Component Transcript Streaming
- **ST-182**: Master Session Live Streaming
- **ST-195**: Transcript Streaming Fixes (Race Condition, SessionId)
- **ST-203**: Structured Component Summary
- **ST-215**: Automatic Agent Tracking in advance_step
- **ST-220**: Unified Live Streaming Documentation (this document)
- **ST-233**: Live Streaming Architecture Simplification (relay pattern removal)

---

**End of Document**
