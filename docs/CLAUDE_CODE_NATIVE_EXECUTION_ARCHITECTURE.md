# Claude Code Native Execution Architecture

**Last Updated**: 2025-11-13
**Status**: Architectural Design - Ready for Implementation
**Related**: AGENT_WORKFLOW_MVP_IMPLEMENTATION_PLAN.md (Phase 3+6)

---

## Overview

This document describes the Claude Code Native Execution architecture, where workflow execution happens entirely within the user's Claude Code instance, and the backend provides MCP tools for state tracking and monitoring.

### Core Principle
**Execution happens in Claude Code, tracking happens in Backend, monitoring happens in Web UI.**

### Key Benefits
- ✅ **Single Account**: User needs only their Claude Code account (no separate AI provider)
- ✅ **Lower Cost**: One account instead of two (user + backend)
- ✅ **Simpler Architecture**: No backend AI execution engine needed
- ✅ **Full Control**: Coordinator agent has complete decision-making power
- ✅ **Complete Monitoring**: Real-time WebSocket updates, metrics, artifacts

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE (User's Account)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Coordinator Agent (.claude/agents/coordinator-*.md)│    │
│  │  - Reads workflow definition                        │    │
│  │  - Makes decisions (sequential/adaptive/etc.)      │    │
│  │  - Executes component instructions                  │    │
│  │  - Tracks iterations & user prompts                │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                     │
│                        │ Uses MCP Tools                      │
│                        ▼                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         │ MCP Protocol (JSON-RPC)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    BACKEND (NestJS + Prisma)                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         MCP Execution Tracking Tools               │    │
│  │  - start_workflow_run(workflowId, context)        │    │
│  │  - record_component_start(runId, componentId)     │    │
│  │  - record_component_complete(runId, metrics)      │    │
│  │  - get_workflow_context(runId)                    │    │
│  │  - update_workflow_status(runId, status)          │    │
│  │  - store_artifact(runId, data)                    │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │      Workflow State Management Service             │   │
│  │  - Track execution state                           │   │
│  │  - Store component outputs                         │   │
│  │  - Manage workflow lifecycle                       │   │
│  └────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │      Database (PostgreSQL)                          │   │
│  │  - WorkflowRun                                      │   │
│  │  - ComponentRun                                     │   │
│  │  - Artifacts metadata                               │   │
│  └────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │      S3 Artifact Storage                            │   │
│  │  - Component outputs                                │   │
│  │  - Code, reports, logs                              │   │
│  └────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │      WebSocket Gateway                              │   │
│  │  - Broadcast execution events                       │   │
│  │  - Real-time updates                                │   │
│  └────────────────────┬────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────┘
                         │ WebSocket
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    WEB UI (React + TypeScript)               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │      Workflow Execution Monitor                    │    │
│  │  - Live execution timeline                         │    │
│  │  - Real-time metrics (tokens, cost, duration)      │    │
│  │  - Component progress tracker                      │    │
│  │  - Artifact viewer                                 │    │
│  │  - Execution logs                                  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Flow (Step-by-Step)

### Phase 1: Workflow Activation (Already Implemented - Phase 7)

```
1. User creates workflow in Web UI
   - Selects coordinator
   - Configures components
   - Sets trigger conditions

2. User clicks "Activate in Claude Code"
   - Backend generates:
     * .claude/agents/coordinator-{name}.md
     * .claude/agents/component-{name}.md (for each component)
     * .claude/skills/workflow-{name}.md
   - Files written to project directory
   - Claude Code detects new agent files
```

### Phase 2: Workflow Execution (To Be Implemented - Phase 3+6)

```
Step 1: START WORKFLOW
─────────────────────────────────────────────────────────────
User (in Claude Code): "Execute the Code Review workflow for PR #123"

Coordinator Agent:
  1. Parse request
  2. Load workflow definition
  3. Call MCP tool: start_workflow_run()
     Request:
     {
       "workflowId": "wf-code-review-123",
       "triggeredBy": "user-456",
       "context": {
         "prNumber": 123,
         "repository": "myapp",
         "branch": "feature/new-feature"
       }
     }

  4. Receive response:
     {
       "runId": "run-789",
       "status": "running",
       "coordinatorStrategy": "sequential",
       "components": ["review-code", "run-tests", "generate-report"]
     }

Backend:
  - Creates WorkflowRun record (status: running)
  - Broadcasts to Web UI via WebSocket: "Workflow started"
  - Returns runId to coordinator

Web UI:
  - Displays "Workflow Running" badge
  - Shows empty timeline
  - Initializes metrics counters


Step 2: EXECUTE FIRST COMPONENT
─────────────────────────────────────────────────────────────
Coordinator Agent (based on sequential strategy):
  1. Decide next component: "review-code"
  2. Call MCP tool: record_component_start()
     {
       "runId": "run-789",
       "componentId": "comp-review-code",
       "input": {
         "prNumber": 123,
         "files": ["src/app.ts", "src/utils.ts"]
       }
     }

  3. Load component instructions from .claude/agents/component-review-code.md
  4. Execute component logic:
     - Read PR files
     - Analyze code quality
     - Check for issues
     - Generate review comments

  5. Track iterations (internal):
     - User asks clarification → userPrompts++
     - System refines analysis → systemIterations++

  6. Call MCP tool: record_component_complete()
     {
       "runId": "run-789",
       "componentId": "comp-review-code",
       "output": {
         "reviewComments": [
           "Line 45: Consider using const instead of let",
           "Line 67: Add error handling for null case"
         ],
         "issuesFound": 2,
         "severity": "medium"
       },
       "metrics": {
         "tokensUsed": 1500,
         "durationSeconds": 30,
         "userPrompts": 1,
         "systemIterations": 2,
         "linesOfCodeAnalyzed": 250
       }
     }

  7. Call MCP tool: store_artifact()
     {
       "runId": "run-789",
       "componentId": "comp-review-code",
       "artifactType": "code_review",
       "data": {
         "reviewReport": "# Code Review Report\n\n..."
       },
       "metadata": {
         "format": "markdown",
         "size": 1024
       }
     }

Backend (for each MCP call):
  - record_component_start():
    * Creates ComponentRun record (status: running)
    * Broadcasts: "Component 'review-code' started"

  - record_component_complete():
    * Updates ComponentRun record (status: completed)
    * Stores metrics
    * Updates WorkflowRun aggregated metrics
    * Broadcasts: "Component 'review-code' completed"

  - store_artifact():
    * Uploads data to S3: s3://bucket/run-789/comp-review-code/artifact.json
    * Stores metadata in database
    * Broadcasts: "Artifact stored"

Web UI (real-time updates):
  - Timeline: Add "review-code" component (green checkmark)
  - Metrics: Update tokens (1500), duration (30s), cost ($0.0045)
  - Progress: Show 1/3 components complete (33%)
  - Artifacts: Show "Code Review Report" (downloadable)


Step 3: EXECUTE NEXT COMPONENT (Sequential Strategy)
─────────────────────────────────────────────────────────────
Coordinator Agent:
  1. Call MCP tool: get_workflow_context()
     {
       "runId": "run-789"
     }

  2. Receive response:
     {
       "runId": "run-789",
       "status": "running",
       "completedComponents": [
         {
           "componentId": "comp-review-code",
           "output": {
             "reviewComments": [...],
             "issuesFound": 2
           }
         }
       ],
       "remainingComponents": ["run-tests", "generate-report"]
     }

  3. Use previous output to inform next component
  4. Decide next component: "run-tests"
  5. Repeat Step 2 flow (start → execute → complete → store)

Backend:
  - get_workflow_context():
    * Queries ComponentRun records
    * Returns previous outputs
    * Returns workflow state


Step 4: COMPLETE WORKFLOW
─────────────────────────────────────────────────────────────
Coordinator Agent (after all components executed):
  1. Call MCP tool: update_workflow_status()
     {
       "runId": "run-789",
       "status": "completed",
       "summary": "Code review completed. 2 issues found, all tests passed."
     }

  2. Inform user:
     "Workflow 'Code Review' completed successfully!
     - 3 components executed
     - 2 code issues found
     - All tests passed
     - Report generated and stored

     View results: [Web UI Link]"

Backend:
  - update_workflow_status():
    * Updates WorkflowRun status: completed
    * Calculates final aggregated metrics
    * Broadcasts: "Workflow completed"

Web UI:
  - Shows "Completed" badge
  - Final metrics: tokens, cost, duration, components
  - Full timeline with all components
  - All artifacts available for download
  - Export options: JSON, Markdown
```

### Phase 3: Error Handling

```
Scenario: Component Execution Fails
─────────────────────────────────────────────────────────────
Coordinator Agent:
  1. Component "run-tests" encounters error
  2. Call MCP tool: update_workflow_status()
     {
       "runId": "run-789",
       "status": "failed",
       "errorMessage": "Test suite failed: 5 tests failed"
     }

  3. Based on component onFailure strategy:
     - "stop": Stop workflow
     - "continue": Log error, continue to next component
     - "retry": Retry component up to N times
     - "notify": Notify user, wait for input

Backend:
  - Updates WorkflowRun status: failed
  - Broadcasts: "Workflow failed"

Web UI:
  - Shows "Failed" badge (red)
  - Displays error message
  - Shows partial results
```

---

## MCP Tools Specification

### 1. `start_workflow_run`

**Purpose**: Initialize a new workflow execution run

**Request**:
```typescript
{
  workflowId: string;          // Workflow ID from database
  triggeredBy: string;         // User ID or system
  context: Record<string, any>; // Workflow context (PR #, story ID, etc.)
}
```

**Response**:
```typescript
{
  runId: string;               // Unique run ID
  workflowId: string;
  coordinatorId: string;
  coordinatorStrategy: string; // "sequential", "adaptive", etc.
  components: Array<{
    id: string;
    name: string;
    order: number;
  }>;
  status: "running";
  startedAt: string;           // ISO timestamp
}
```

**Implementation**:
- Create WorkflowRun record in database
- Generate unique runId
- Set status: running
- Store context JSON
- Broadcast via WebSocket
- Return run metadata to coordinator

---

### 2. `record_component_start`

**Purpose**: Log the start of a component execution

**Request**:
```typescript
{
  runId: string;
  componentId: string;
  input: Record<string, any>;  // Component input data
}
```

**Response**:
```typescript
{
  componentRunId: string;
  status: "running";
  startedAt: string;
}
```

**Implementation**:
- Create ComponentRun record
- Link to WorkflowRun
- Store input JSON
- Set status: running
- Broadcast via WebSocket

---

### 3. `record_component_complete`

**Purpose**: Log the completion of a component with results and metrics

**Request**:
```typescript
{
  runId: string;
  componentId: string;
  output: Record<string, any>;     // Component output data
  metrics: {
    tokensUsed: number;
    durationSeconds: number;
    userPrompts: number;           // User interactions during execution
    systemIterations: number;      // Internal refinements
    humanInterventions: number;    // Times user provided guidance
    linesOfCode: number;           // LOC generated/analyzed
    filesModified: number;         // Files touched
    costUsd: number;               // Estimated cost
  };
  status: "completed" | "failed";
  errorMessage?: string;
}
```

**Response**:
```typescript
{
  componentRunId: string;
  status: "completed" | "failed";
  completedAt: string;
}
```

**Implementation**:
- Update ComponentRun record
- Store output JSON
- Store metrics
- Update WorkflowRun aggregated metrics
- Set status: completed/failed
- Broadcast via WebSocket

---

### 4. `get_workflow_context`

**Purpose**: Retrieve workflow state and previous component outputs

**Request**:
```typescript
{
  runId: string;
}
```

**Response**:
```typescript
{
  runId: string;
  workflowId: string;
  status: string;
  context: Record<string, any>;    // Original workflow context
  completedComponents: Array<{
    componentId: string;
    componentName: string;
    output: Record<string, any>;   // Previous output
    metrics: {...};
    completedAt: string;
  }>;
  remainingComponents: Array<{
    componentId: string;
    componentName: string;
    order: number;
  }>;
  aggregatedMetrics: {
    totalTokens: number;
    totalDuration: number;
    totalUserPrompts: number;
    totalCost: number;
  };
}
```

**Implementation**:
- Query WorkflowRun by runId
- Query ComponentRun records (completed)
- Calculate remaining components
- Return full context for coordinator decision-making

---

### 5. `update_workflow_status`

**Purpose**: Update workflow execution status

**Request**:
```typescript
{
  runId: string;
  status: "running" | "paused" | "completed" | "failed" | "cancelled";
  errorMessage?: string;
  summary?: string;
}
```

**Response**:
```typescript
{
  runId: string;
  status: string;
  updatedAt: string;
}
```

**Implementation**:
- Update WorkflowRun status
- Store error message if failed
- Calculate final metrics if completed
- Broadcast via WebSocket

---

### 6. `store_artifact`

**Purpose**: Store component output artifact (code, reports, logs) to S3

**Request**:
```typescript
{
  runId: string;
  componentId: string;
  artifactType: string;        // "code", "report", "log", "diff", "test_results"
  data: Record<string, any> | string; // Artifact data
  metadata: {
    format: string;            // "json", "markdown", "code", "text"
    size: number;              // Bytes
    filename?: string;
    mimeType?: string;
  };
}
```

**Response**:
```typescript
{
  artifactId: string;
  s3Key: string;               // S3 object key
  s3Url: string;               // Presigned URL for download
  uploadedAt: string;
}
```

**Implementation**:
- Upload data to S3: `s3://bucket/{runId}/{componentId}/{artifactType}-{timestamp}.json`
- Store metadata in database (Artifact table or ComponentRun.artifactsS3Keys)
- Generate presigned URL for web UI access
- Broadcast via WebSocket

---

## Database Schema Updates

No changes needed! Existing schema already supports this architecture:

```prisma
model WorkflowRun {
  id                    String      @id @default(uuid())
  workflowId            String
  coordinatorId         String
  status                RunStatus   // running, paused, completed, failed, cancelled
  context               Json?       // Workflow context

  // Aggregated metrics
  totalTokensUsed       Int?
  totalCostUsd          Decimal?
  totalDurationSeconds  Int?
  totalUserPrompts      Int?
  totalIterations       Int?
  totalInterventions    Int?

  startedAt             DateTime    @default(now())
  completedAt           DateTime?
  errorMessage          String?

  componentRuns         ComponentRun[]
  // ... relations ...
}

model ComponentRun {
  id                  String      @id @default(uuid())
  workflowRunId       String
  componentId         String
  status              RunStatus

  input               Json?
  output              Json?

  // Metrics
  tokensUsed          Int?
  durationSeconds     Int?
  costUsd             Decimal?
  linesOfCode         Int?

  // Iteration tracking
  userPrompts         Int         @default(0)
  systemIterations    Int         @default(1)
  humanInterventions  Int         @default(0)
  iterationLog        Json?

  // Artifacts
  artifactsS3Keys     String[]    // S3 keys for stored artifacts

  startedAt           DateTime    @default(now())
  completedAt         DateTime?
  errorMessage        String?

  // ... relations ...
}
```

---

## WebSocket Protocol

### Event Types

```typescript
// Component events
type ComponentStartedEvent = {
  type: "component_started";
  runId: string;
  componentRunId: string;
  componentName: string;
  timestamp: string;
};

type ComponentProgressEvent = {
  type: "component_progress";
  runId: string;
  componentRunId: string;
  progress: number;        // 0-100
  message: string;
};

type ComponentCompletedEvent = {
  type: "component_completed";
  runId: string;
  componentRunId: string;
  componentName: string;
  metrics: {...};
  timestamp: string;
};

// Workflow events
type WorkflowStatusEvent = {
  type: "workflow_status";
  runId: string;
  status: string;
  message?: string;
  timestamp: string;
};

// Artifact events
type ArtifactStoredEvent = {
  type: "artifact_stored";
  runId: string;
  componentRunId: string;
  artifactId: string;
  artifactType: string;
  s3Url: string;
  timestamp: string;
};

// Metrics update
type MetricsUpdateEvent = {
  type: "metrics_update";
  runId: string;
  aggregatedMetrics: {
    totalTokens: number;
    totalDuration: number;
    totalCost: number;
    componentsCompleted: number;
    componentsTotal: number;
  };
};
```

### Web UI Connection

```typescript
// Frontend: Connect to WebSocket
const ws = new WebSocket(`ws://localhost:3000/ws/workflow-runs/${runId}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "component_started":
      updateTimeline(data);
      break;
    case "component_completed":
      updateMetrics(data.metrics);
      updateTimeline(data);
      break;
    case "artifact_stored":
      addArtifactToList(data);
      break;
    case "workflow_status":
      updateWorkflowStatus(data.status);
      break;
  }
};
```

---

## Coordinator Agent Template Updates

**File**: `backend/src/mcp/generators/coordinator-agent-generator.ts`

**Add to generated `.claude/agents/coordinator-{name}.md`**:

````markdown
# Coordinator Agent: {coordinatorName}

## Workflow Execution Protocol

### Step 1: Initialize Workflow Run

When a user requests to execute this workflow, follow these steps:

1. Call the MCP tool `start_workflow_run`:
   ```
   start_workflow_run({
     workflowId: "{workflowId}",
     triggeredBy: "user-{userId}",
     context: {
       // Extract from user request
       // e.g., prNumber, storyId, branch, etc.
     }
   })
   ```

2. Store the returned `runId` for all subsequent MCP calls.

3. Inform the user:
   "Workflow '{workflowName}' started! Run ID: {runId}"

### Step 2: Execute Components

For each component in the workflow (based on decision strategy):

1. **Start Component**:
   ```
   record_component_start({
     runId: "{runId}",
     componentId: "{componentId}",
     input: {
       // Component input data
     }
   })
   ```

2. **Execute Component Logic**:
   - Load component instructions from `.claude/agents/component-{name}.md`
   - Follow the three instruction sets:
     * Input Instructions: How to gather/validate input
     * Operation Instructions: What actions to perform
     * Output Instructions: How to format results
   - Track your work:
     * Count user prompts (when user asks clarifying questions)
     * Count system iterations (when you refine your analysis)
     * Note any human interventions

3. **Complete Component**:
   ```
   record_component_complete({
     runId: "{runId}",
     componentId: "{componentId}",
     output: {
       // Component output data
     },
     metrics: {
       tokensUsed: {estimate based on conversation},
       durationSeconds: {estimate},
       userPrompts: {count},
       systemIterations: {count},
       linesOfCode: {if applicable},
       costUsd: {estimate: tokensUsed * 0.003 / 1000}
     },
     status: "completed"
   })
   ```

4. **Store Artifacts** (if component produces code, reports, etc.):
   ```
   store_artifact({
     runId: "{runId}",
     componentId: "{componentId}",
     artifactType: "code" | "report" | "log" | "diff",
     data: {
       // Artifact content
     },
     metadata: {
       format: "json" | "markdown" | "code",
       size: {bytes}
     }
   })
   ```

### Step 3: Make Next Decision

**Decision Strategy**: {coordinatorStrategy}

{#if coordinatorStrategy === "sequential"}
Execute components in order:
1. {component1Name}
2. {component2Name}
3. {component3Name}
{/if}

{#if coordinatorStrategy === "adaptive"}
Before deciding the next component:
1. Call `get_workflow_context({ runId: "{runId}" })`
2. Analyze previous component outputs
3. Decide which component to run next based on results
4. Example: If code review found critical issues, run "Fix Issues" before "Run Tests"
{/if}

### Step 4: Complete Workflow

When all components are executed:

1. Call `update_workflow_status`:
   ```
   update_workflow_status({
     runId: "{runId}",
     status: "completed",
     summary: "Brief summary of workflow results"
   })
   ```

2. Provide comprehensive summary to user:
   - Components executed
   - Key results from each component
   - Artifacts generated
   - Link to web UI for detailed results

### Error Handling

If a component fails:

1. Determine failure strategy from component config:
   - **stop**: Call `update_workflow_status` with status "failed", stop execution
   - **continue**: Log error, move to next component
   - **retry**: Retry component up to 3 times
   - **notify**: Ask user how to proceed

2. Always call `record_component_complete` with `status: "failed"` and `errorMessage`

### Example Full Workflow Execution

```
User: "Run code review workflow for PR #456"

You:
1. start_workflow_run(workflowId="wf-123", context={prNumber: 456})
   → Receive runId="run-789"

2. Component 1: "Review Code"
   - record_component_start(runId="run-789", componentId="comp-1")
   - [Execute review logic]
   - record_component_complete(runId="run-789", output={issues: [...]}, metrics={...})
   - store_artifact(runId="run-789", data={reviewReport: "..."})

3. Component 2: "Run Tests"
   - get_workflow_context(runId="run-789") → See review results
   - record_component_start(runId="run-789", componentId="comp-2")
   - [Execute tests]
   - record_component_complete(runId="run-789", output={testResults: [...]}, metrics={...})

4. Complete:
   - update_workflow_status(runId="run-789", status="completed")
   - Inform user: "Code review complete! 5 issues found, all tests passed."
```

## Available MCP Tools

- `start_workflow_run(workflowId, triggeredBy, context)`
- `record_component_start(runId, componentId, input)`
- `record_component_complete(runId, componentId, output, metrics, status)`
- `get_workflow_context(runId)`
- `update_workflow_status(runId, status, errorMessage?, summary?)`
- `store_artifact(runId, componentId, artifactType, data, metadata)`

## Coordinator Instructions

{coordinatorInstructions}
````

---

## Implementation Checklist

### Backend (NestJS)

- [ ] **MCP Tools** (`backend/src/mcp/servers/execution/`)
  - [ ] `start_workflow_run.ts`
  - [ ] `record_component_start.ts`
  - [ ] `record_component_complete.ts`
  - [ ] `get_workflow_context.ts`
  - [ ] `update_workflow_status.ts`
  - [ ] `store_artifact.ts`
  - [ ] `index.ts` (export all tools)

- [ ] **Workflow State Service** (`backend/src/execution/workflow-state.service.ts`)
  - [ ] `initializeWorkflowRun()`
  - [ ] `startComponentRun()`
  - [ ] `completeComponentRun()`
  - [ ] `getWorkflowContext()`
  - [ ] `updateWorkflowStatus()`
  - [ ] `calculateAggregatedMetrics()`

- [ ] **S3 Storage Service** (`backend/src/storage/s3.service.ts`)
  - [ ] `uploadArtifact()`
  - [ ] `generatePresignedUrl()`
  - [ ] `deleteArtifact()`
  - [ ] `listArtifacts()`

- [ ] **WebSocket Gateway** (`backend/src/websocket/execution-gateway.ts`)
  - [ ] Connection handling
  - [ ] Event broadcasting
  - [ ] Room management (per runId)

- [ ] **API Endpoints** (`backend/src/workflow-runs/workflow-runs.controller.ts`)
  - [ ] `GET /workflow-runs/:id/status`
  - [ ] `GET /workflow-runs/:id/artifacts`
  - [ ] `GET /workflow-runs/:id/context`

- [ ] **Update Coordinator Generator**
  - [ ] Add MCP tool usage instructions
  - [ ] Add execution protocol
  - [ ] Add error handling patterns

### Frontend (React + TypeScript)

- [ ] **Workflow Execution Monitor** (`frontend/src/pages/WorkflowExecutionMonitor.tsx`)
  - [ ] WebSocket connection
  - [ ] Real-time event handling
  - [ ] Layout with tabs

- [ ] **Execution Components** (`frontend/src/components/execution/`)
  - [ ] `ExecutionTimeline.tsx` - Component execution timeline
  - [ ] `LiveMetricsDisplay.tsx` - Real-time metrics cards
  - [ ] `ArtifactViewer.tsx` - View/download artifacts
  - [ ] `ComponentProgressTracker.tsx` - Progress bars
  - [ ] `ExecutionStatusBadge.tsx` - Status indicator

- [ ] **Routes**
  - [ ] Add route: `/workflow-runs/:runId/monitor`
  - [ ] Add navigation link

### Testing

- [ ] Unit tests for MCP tools
- [ ] Unit tests for workflow state service
- [ ] Integration test: Full workflow execution
- [ ] E2E test: Claude Code → MCP → Backend → Web UI

---

## Success Criteria

- [ ] Coordinator agent can start workflow via `start_workflow_run`
- [ ] Coordinator can execute components and record results
- [ ] Workflow context is accessible to coordinator for decision-making
- [ ] Artifacts are stored in S3 and retrievable
- [ ] Web UI displays real-time progress via WebSocket
- [ ] Execution timeline shows all components with status
- [ ] Metrics are accurately calculated and displayed
- [ ] Full workflow completes end-to-end with all tracking

---

## Future Enhancements

1. **Pause/Resume**: Add MCP tools for pausing and resuming workflows
2. **Manual Approval**: Component that waits for user approval before continuing
3. **Parallel Execution**: Support parallel component execution
4. **Conditional Branching**: If-then-else component flows
5. **Sub-workflows**: Nested workflow execution
6. **Scheduled Execution**: Cron-based workflow triggers (requires backend execution)

---

## References

- Main Implementation Plan: `AGENT_WORKFLOW_MVP_IMPLEMENTATION_PLAN.md`
- Database Schema: `backend/prisma/schema.prisma`
- MCP Protocol: https://modelcontextprotocol.io/
- Phase 7 (Claude Code Integration): Already implemented
