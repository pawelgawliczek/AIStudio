# Live Streaming Architecture

**Version:** 1.4
**Last Updated:** 2025-12-19
**Epic:** ST-220, ST-242, ST-247, ST-279, ST-321

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Execution Modes Comparison](#execution-modes-comparison)
4. [WebSocket Events Reference](#websocket-events-reference)
5. [Transcript Tracking Lifecycle](#transcript-tracking-lifecycle)
6. [TranscriptWatcher (Laptop Daemon)](#transcriptwatcher-laptop-daemon)
7. [UploadManager (Laptop Daemon)](#uploadmanager-laptop-daemon)
8. [Agent Tracking Patterns](#agent-tracking-patterns)
9. [Telemetry Collection](#telemetry-collection)
10. [Frontend Components](#frontend-components)
11. [Security](#security)
12. [Troubleshooting Guide](#troubleshooting-guide)

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
2. **UploadManager** (ST-321): Orchestrates guaranteed delivery via persistent SQLite queue
3. **RemoteAgentGateway** (`/remote-agent` namespace): Receives events from laptop agent
4. **AppWebSocketGateway** (`/` namespace): Broadcasts events to frontend clients
5. **Frontend Components**: Display live transcript data in the browser

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
│  │ ~/.claude/sessions/  │         │ - Queue via UploadManager   │  │
│  │   session-123.jsonl  │         └────────────┬────────────────┘  │
│  └──────────────────────┘                      │                    │
│                                                 │                    │
│  ┌──────────────────────────────────────────────▼─────────────────┐ │
│  │ UploadManager (ST-321)                                         │ │
│  │ - Persistent SQLite queue (~/.vibestudio/upload-queue.db)     │ │
│  │ - 500ms flush loop, 50-item batches                           │ │
│  │ - Reconnect handling (flush on connect)                       │ │
│  │ - Daily cleanup of acked items                                │ │
│  └────────────────────────────────┬───────────────────────────────┘ │
│                                   │ WebSocket                       │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │
                                    │ emit('upload:batch')
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

**Location:** `backend/src/mcp/shared/agent-tracking.ts`

> **ST-242 IMPORTANT:** The `record_agent_start` and `record_agent_complete` MCP tools are **OBSOLETE** and have been removed from the core MCP profile. All agent tracking is now handled **automatically** by `advance_step`. Do NOT call these tools directly.

#### `startAgentTracking(prisma, params)`
Creates a ComponentRun record when a component agent starts execution.

```typescript
startAgentTracking(prisma, {
  runId: string;          // WorkflowRun UUID
  componentId: string;    // Component UUID from workflow state
  input?: object;         // Optional: input data for context
})
```

**Actions:**
- Creates `ComponentRun` with `status='running'`
- Broadcasts `component:started` WebSocket event
- Starts transcript tailing if available
- Records `startedAt` timestamp

**Called By:**
- **ONLY** via `advance_step` when entering agent phase (automatic)
- Docker Runner: `backendClient.recordAgentStart()` API (internal)

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
- **ST-247:** Syncs `spawnedAgentTranscripts` from laptop's `running-workflows.json` via RemoteRunner
- Parses transcript for token metrics via RemoteRunner (if transcript available)
- **ST-242:** Calculates cost using centralized pricing utility
- Stores `modelId`, `tokensCacheCreation`, `tokensCacheRead`, `cost`
- Aggregates metrics to WorkflowRun (totalTokens, totalCost, LOC)
- Generates or stores component summary
- Broadcasts `component:completed` WebSocket event
- Stops transcript tailing

**ST-247 Metadata Path Fix:**
The transcript sync reads metadata from the correct nested path:
```typescript
// Correct path (ST-247 fix)
const transcriptTracking = runMetadata?._transcriptTracking as Record<string, unknown>;
const masterSessionId = transcriptTracking?.sessionId as string;
const cwd = transcriptTracking?.projectPath as string;

// NOT from top-level metadata.cwd (was broken)
```

**Called By:**
- **ONLY** via `advance_step` when exiting agent phase (automatic)
- Docker Runner: `backendClient.recordAgentComplete()` API (internal)

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
  totalTokens: number;        // ST-247: Sum of input + output + cache
  tokensCacheCreation: number; // ST-247: Cache creation tokens (new)
  tokensCacheRead: number;     // ST-247: Cache read tokens (new)
  cost: number;               // ST-242: Calculated via pricing utility
  modelId?: string;           // ST-242: Model used for cost calculation
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
      ├─ ST-247: Sync spawnedAgentTranscripts from laptop
      │   └─ RemoteRunner.readFile('running-workflows.json')
      │   └─ Extract transcripts for current masterSessionId
      │   └─ Update WorkflowRun.spawnedAgentTranscripts
      ├─ Parse transcript for metrics
      ├─ Calculate cost via pricing utility
      ├─ Generate component summary
      └─ Update ComponentRun with results
```

### ST-247: Transcript Sync from Laptop

The `advance_step` function syncs spawned agent transcripts from the laptop's `running-workflows.json` file before completing agent tracking. This ensures telemetry data is available for transcript parsing.

**File Location:** `~/.claude/running-workflows.json` (on laptop)

**Data Structure:**
```typescript
{
  "sessions": {
    "<masterSessionId>": {
      "projectPath": "/path/to/project",
      "spawnedAgentTranscripts": [
        {
          "agentId": "abc1234",
          "transcriptPath": "/path/to/agent-abc1234.jsonl",
          "spawnedAt": "2025-12-15T09:00:00.000Z"
        }
      ]
    }
  }
}
```

**Sync Flow:**
1. Read `running-workflows.json` via RemoteRunner
2. Find session by masterSessionId (from `_transcriptTracking.sessionId`)
3. Merge `spawnedAgentTranscripts` into WorkflowRun metadata
4. Use transcripts for telemetry parsing in `completeAgentTracking`

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

## TranscriptWatcher (Laptop Daemon)

The TranscriptWatcher is a file-watching daemon running on the developer's laptop that automatically detects new transcript files and notifies the backend via WebSocket.

**Location:** `laptop-agent/src/transcript-watcher.ts`

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ Laptop (Developer Machine)                                       │
│                                                                   │
│  ~/.claude/projects/                                              │
│   └─ -Users-pawelgawliczek-projects-AIStudio/                    │
│       ├─ 37717a7b-fc99-...jsonl  ← Master session (UUID)         │
│       ├─ agent-a1b2c3d.jsonl     ← Agent transcript (hex ID)     │
│       └─ agent-e4f5g6h.jsonl     ← Another agent                 │
│                                                                   │
│  TranscriptWatcher (chokidar)                                    │
│   │                                                               │
│   ├─ Watches: ~/.claude/projects/**/*.jsonl                      │
│   ├─ Depth: 2 levels                                             │
│   └─ Pattern matching:                                           │
│       • agent-{6-16 hex}.jsonl → Agent transcript                │
│       • {uuid}.jsonl → Master session                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket: agent:transcript_detected
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend (KVM Server)                                             │
│                                                                   │
│  RemoteAgentGateway                                              │
│   │                                                               │
│   ├─ Receives: { agentId, transcriptPath, projectPath, metadata }│
│   ├─ Matches to WorkflowRun via sessionId                        │
│   └─ Enables live streaming                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### File Pattern Matching

TranscriptWatcher distinguishes between two types of transcripts:

| Pattern | Regex | Type | Example |
|---------|-------|------|---------|
| Agent transcript | `/^agent-([a-f0-9]{6,16})\.jsonl$/` | Spawned agent | `agent-a1b2c3d.jsonl` |
| Master session | `/^([a-f0-9-]{36})\.jsonl$/` | Orchestrator | `37717a7b-fc99-4347-aa5e-eacebe34db70.jsonl` |

**Key Insight (ST-276):** Claude Code hooks cannot distinguish between orchestrator and spawned agents because they share the same `session_id`. However, TranscriptWatcher CAN distinguish them by filename pattern - agent transcripts use short hex IDs while master sessions use full UUIDs.

### Caching & Throttling (ST-267)

To prevent flooding the backend on startup (when hundreds of transcript files exist):

```typescript
// Configuration
const BATCH_SIZE = 5;           // Max transcripts per batch
const BATCH_DELAY_MS = 500;     // Delay between batches
const CACHE_FILE = '~/.vibestudio/synced-transcripts.json';

// Persistent cache structure
{
  "syncedPaths": ["/path/to/transcript1.jsonl", ...],
  "lastUpdated": "2025-12-17T10:00:00Z"
}
```

**Startup Flow:**
1. Load persistent cache from `~/.vibestudio/synced-transcripts.json`
2. Start chokidar with `ignoreInitial: true`
3. Perform throttled initial scan (batch of 5, 500ms delay)
4. Skip already-synced files from cache
5. Queue new files for processing

### WebSocket Events

**Emitted to Backend:**

```typescript
// Agent transcript detected
socket.emit('agent:transcript_detected', {
  agentId: 'a1b2c3d',           // Hex ID from filename (null for master)
  transcriptPath: '/Users/.../agent-a1b2c3d.jsonl',
  projectPath: '/Users/pawelgawliczek/projects/AIStudio',
  metadata: { /* first line of JSONL parsed */ }
});

// Master session detected
socket.emit('agent:transcript_detected', {
  agentId: null,                // Null indicates master session
  transcriptPath: '/Users/.../37717a7b-fc99-4347-aa5e-eacebe34db70.jsonl',
  projectPath: '/Users/pawelgawliczek/projects/AIStudio',
  metadata: { /* first line of JSONL parsed */ }
});
```

### Integration with Workflow Enforcement

TranscriptWatcher is separate from the Claude Code hooks but complements them:

| Component | Location | Purpose |
|-----------|----------|---------|
| **TranscriptWatcher** | Laptop daemon | Detects new transcripts, enables live streaming |
| **Enforcement hooks** | `.claude/hooks/` | Block orchestrator edits, validate agent spawning |
| **running-workflows.json** | `.claude/` | Track active workflows and spawned agents |

**Flow:**
1. Workflow starts → `running-workflows.json` updated
2. Agent spawns → `enforce-agent-spawn.sh` sets `.agent-active.json` flag
3. Agent writes transcript → TranscriptWatcher detects `agent-*.jsonl`
4. TranscriptWatcher notifies backend → Live streaming enabled
5. Agent completes → `track-agents.sh` clears flag

### Troubleshooting

**Transcript not detected:**
```bash
# Check TranscriptWatcher logs
tail -f ~/.vibestudio/agent.log | grep -i transcript

# Verify file pattern
ls ~/.claude/projects/*/*.jsonl | head -5

# Check cache
cat ~/.vibestudio/synced-transcripts.json | jq '.syncedPaths | length'
```

**Clear cache to force re-sync:**
```bash
rm ~/.vibestudio/synced-transcripts.json
# Restart laptop agent
launchctl unload ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist
launchctl load ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist
```

---

## UploadManager (Laptop Daemon)

The UploadManager is an orchestration layer on the laptop that provides guaranteed delivery of artifacts and transcripts via a persistent SQLite queue.

**Location:** `laptop-agent/src/upload-manager.ts`

### Overview

UploadManager wraps the UploadQueue (ST-320) and provides a high-level interface for watchers to queue items for upload. It handles the flush loop, reconnection logic, and cleanup automatically.

**Key Features:**
- **Persistent Queue**: SQLite-backed queue survives restarts and network failures
- **Automatic Flush**: 500ms interval with 50-item batch limit
- **Reconnect Handling**: Flushes immediately when socket reconnects
- **Daily Cleanup**: Removes acknowledged items older than 7 days
- **Queue Statistics**: Real-time stats on pending/sent/acked items

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Laptop (Developer Machine)                                    │
│                                                                │
│  ┌──────────────────┐                                         │
│  │ TranscriptWatcher│                                         │
│  │ ArtifactWatcher  │                                         │
│  └────────┬─────────┘                                         │
│           │ queueUpload(type, payload)                        │
│           ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ UploadManager (ST-321)                               │    │
│  │                                                      │    │
│  │  Constructor:                                        │    │
│  │   - Creates UploadQueue with dbPath                 │    │
│  │   - Starts flush loop (500ms interval)              │    │
│  │   - Starts cleanup loop (24h interval)              │    │
│  │   - Sets up socket event handlers                   │    │
│  │                                                      │    │
│  │  Public Methods:                                     │    │
│  │   - queueUpload(type, payload)                      │    │
│  │   - getStats() → { pending, sent, acked, total }    │    │
│  │   - stop() → cleanup timers and close queue         │    │
│  │                                                      │    │
│  │  Private Methods:                                    │    │
│  │   - flush() → send batches to server                │    │
│  │   - handleAcknowledgement(ids) → mark items acked   │    │
│  │   - cleanup() → remove old acked items              │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                         │
│                     │ Uses                                    │
│                     ▼                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ UploadQueue (ST-320)                                 │    │
│  │ - SQLite persistence (~/.vibestudio/upload-queue.db)│    │
│  │ - enqueue(item)                                      │    │
│  │ - getPendingItems(limit)                            │    │
│  │ - markSent(id)                                       │    │
│  │ - markAckedBatch(ids)                               │    │
│  │ - cleanupAcked(olderThanDays)                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Queue Lifecycle

```
1. Watcher queues item
   └─ uploadManager.queueUpload('artifact:upload', { storyId, content })
      └─ UploadQueue.enqueue() → status: 'pending'

2. Flush loop (every 500ms)
   └─ UploadManager.flush()
      ├─ UploadQueue.getPendingItems(limit: 50)
      ├─ socket.emit('upload:batch', { items })
      └─ UploadQueue.markSent(id) → status: 'sent'

3. Server processes batch
   └─ Server emits 'upload:ack' with processed IDs

4. UploadManager receives acknowledgement
   └─ UploadManager.handleAcknowledgement(ids)
      └─ UploadQueue.markAckedBatch(ids) → status: 'acked'

5. Daily cleanup (every 24h)
   └─ UploadManager.cleanup()
      └─ UploadQueue.cleanupAcked(olderThanDays: 7) → DELETE
```

### Configuration

```typescript
const uploadManager = new UploadManager({
  socket: Socket;                    // Socket.io client
  dbPath?: string;                   // Default: ~/.vibestudio/upload-queue.db
  flushIntervalMs?: number;          // Default: 500ms
  batchSize?: number;                // Default: 50 items
  cleanupIntervalHours?: number;     // Default: 24 hours
});
```

### WebSocket Events

**Emitted to Backend:**

```typescript
// Batch upload (from flush loop)
socket.emit('upload:batch', {
  items: Array<{
    id: number;                      // Queue item ID
    type: string;                    // e.g., 'artifact:upload', 'transcript:upload'
    payload: object;                 // Type-specific payload
  }>;
});
```

**Received from Backend:**

```typescript
// Acknowledgement from server
socket.on('upload:ack', (data: { ids: number[] }) => {
  // UploadManager marks items as acknowledged
});
```

### Reconnection Handling

UploadManager automatically handles WebSocket reconnections:

```typescript
// On disconnect
socket.on('disconnect', () => {
  // Flush loop continues but skips sending (isConnected = false)
  // Items remain in queue with status 'pending' or 'sent'
});

// On reconnect
socket.on('connect', () => {
  // Immediately flush all pending items
  // Items with status 'sent' are re-sent (idempotent on server)
});
```

**Why this works:**
- Pending items are re-sent on reconnect
- Sent items (not yet acked) are also re-sent
- Server handles duplicate uploads via idempotency keys or deduplication
- No data loss during network failures

### Usage Example

```typescript
// In vibestudio-agent.sh
import { UploadManager } from './upload-manager';
import { io } from 'socket.io-client';

const socket = io('wss://api.vibestudio.ai', { /* auth */ });
const uploadManager = new UploadManager({ socket });

// Queue artifact upload
await uploadManager.queueUpload('artifact:upload', {
  storyId: 'ST-123',
  definitionKey: 'ARCH_DOC',
  content: 'Architecture document content...',
});

// Queue transcript upload
await uploadManager.queueUpload('transcript:upload', {
  sessionId: 'session-123',
  lines: [/* JSONL lines */],
});

// Get queue statistics
const stats = await uploadManager.getStats();
console.log(stats); // { pending: 10, sent: 5, acked: 100, total: 115 }

// Cleanup on shutdown
await uploadManager.stop();
```

### Error Handling

**Queue Errors:**
- Duplicate content detection (via content hash)
- Database errors (SQLite busy, locked)
- Throws errors to caller

**Flush Errors:**
- Network failures during emit (silent, retries on next flush)
- Database errors during markSent (logged, continues)
- Socket emit errors (logged, continues)

**Acknowledgement Errors:**
- Invalid IDs in ack response (logged, continues)
- Database errors during markAcked (logged, continues)

**Cleanup Errors:**
- Database errors during cleanup (logged, continues)

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **Flush Interval** | 500ms | Configurable via `flushIntervalMs` |
| **Batch Size** | 50 items | Configurable via `batchSize` |
| **Queue Throughput** | ~6,000 items/min | 50 items × 120 flushes/min |
| **Cleanup Interval** | 24 hours | Configurable via `cleanupIntervalHours` |
| **Retention** | 7 days | Acked items older than 7 days are deleted |
| **Concurrent Flushes** | 1 | Prevents race conditions via `isFlushing` flag |

### Troubleshooting

**Problem: Items stuck in 'sent' status**

**Diagnosis:**
```bash
# Check queue stats
sqlite3 ~/.vibestudio/upload-queue.db "SELECT status, COUNT(*) FROM queue GROUP BY status;"
```

**Solution:**
- Items in 'sent' status indicate server has not acknowledged them
- Check backend logs for processing errors
- Items will be re-sent on next reconnect

**Problem: Queue growing indefinitely**

**Diagnosis:**
```bash
# Check total queue size
sqlite3 ~/.vibestudio/upload-queue.db "SELECT COUNT(*) FROM queue;"
```

**Solution:**
- Verify server is sending acknowledgements (`upload:ack` events)
- Check cleanup is running (logs should show daily cleanup)
- Manually cleanup old items if needed:
  ```typescript
  await uploadManager.cleanup();
  ```

**Problem: High memory usage**

**Diagnosis:**
- Large batch size with large payloads
- Too many pending items

**Solution:**
- Reduce `batchSize` configuration
- Reduce payload sizes (e.g., chunk large transcripts)
- Increase flush interval to reduce memory pressure

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

### Cost Estimation (ST-242)

**Location:** `backend/src/mcp/utils/pricing.ts`

Cost estimation uses a centralized multi-model pricing utility that supports all Claude models.

**Supported Models:**
```typescript
const CLAUDE_PRICING = {
  'claude-opus-4-5':   { input: 5.0,  output: 25.0, cacheWrite: 6.25,  cacheRead: 0.5  },
  'claude-sonnet-4':   { input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-haiku-3-5':  { input: 0.8,  output: 4.0,  cacheWrite: 1.0,   cacheRead: 0.08 },
  'default':           { input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.3  }, // Claude Sonnet 4
};
```

**Formula (per million tokens):**
```typescript
import { calculateCost } from '../mcp/utils/pricing';

const componentCost = calculateCost({
  tokensInput: metrics.inputTokens,
  tokensOutput: metrics.outputTokens,
  tokensCacheCreation: metrics.cacheCreationTokens,
  tokensCacheRead: metrics.cacheReadTokens,
  modelId: metrics.model,  // Auto-detects model family
});
```

**Automatic Aggregation:**
- `completeAgentTracking` calculates cost for each ComponentRun
- WorkflowRun.estimatedCost = sum of all ComponentRun.cost values
- Updated automatically after each component completion

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
- **Manual mode:** Ensure `advance_step` is called correctly (agent tracking is automatic)
- **Docker runner:** Ensure runner is using latest version with API tracking
- **Missing componentId:** Verify workflow state has componentId assigned
- **Database error:** Check Prisma logs for constraint violations
- **ST-242:** Do NOT call `record_agent_start`/`record_agent_complete` directly - these are obsolete

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
- **Transcript not parsed:** Ensure `advance_step` properly exits agent phase (triggers transcript parsing)
- **No usage data in transcript:** Verify Claude Code version supports usage reporting
- **Parsing error:** Check logs for transcript parsing errors (`grep "agent-tracking" backend.log`)
- **RemoteRunner offline:** Verify laptop agent is running and connected for transcript parsing
- **ST-242:** Cost is calculated via centralized pricing utility - check `calculateCost()` in `mcp/utils/pricing.ts`

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
- **ST-242**: Telemetry Metrics Fix (centralized pricing, obsolete record_agent_* tools)
- **ST-247**: Telemetry Sync Fix (metadata path fix, cache token columns, running-workflows.json sync)
- **ST-320**: UploadQueue Class (SQLite-backed persistent queue)
- **ST-321**: UploadManager Orchestration (guaranteed delivery via queue)

---

## Changelog

### Version 1.4 (2025-12-19)
- **ST-321**: UploadManager Orchestration - added comprehensive documentation for guaranteed delivery system
- Added new UploadManager (Laptop Daemon) section covering:
  - Architecture and queue lifecycle
  - Configuration and WebSocket events
  - Reconnection handling and error handling
  - Performance characteristics and troubleshooting
- Updated architecture diagram to include UploadManager component
- Updated Table of Contents and References

### Version 1.3 (2025-12-17)
- **ST-279**: Living Documentation System - integrated this architecture doc into core docs
- Added detailed TranscriptWatcher (Laptop Daemon) section with:
  - File pattern matching (agent-{hex} vs UUID)
  - Caching & throttling (ST-267)
  - WebSocket events
  - Integration with workflow enforcement hooks
- Updated Table of Contents with new section

### Version 1.2 (2025-12-15)
- **ST-247**: Fixed metadata path in `advance_step.ts` - now reads from `_transcriptTracking.projectPath` instead of `metadata.cwd`
- **ST-247**: Added cache token columns to schema (`tokens_cache_creation`, `tokens_cache_read`)
- **ST-247**: Added transcript sync from laptop's `running-workflows.json` via RemoteRunner
- **ST-247**: Updated ComponentRun fields documentation with new cache token columns

### Version 1.1 (2025-12-15)
- **ST-242**: Added centralized pricing utility documentation
- **ST-242**: Marked `record_agent_start`/`record_agent_complete` MCP tools as obsolete
- **ST-233**: Documented relay pattern removal for live streaming

### Version 1.0 (2025-12-14)
- Initial document combining ST-220 live streaming architecture

---

**End of Document**
