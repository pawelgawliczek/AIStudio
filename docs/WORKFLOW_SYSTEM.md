# Workflow System

**Version:** 1.0
**Last Updated:** 2025-12-17
**Epic:** ST-279

## Overview

The Workflow System orchestrates multi-agent execution for story development. Workflows define a sequence of states (analysis, architecture, implementation, etc.) with agents executing work at each state. The system supports approval gates, breakpoints, and remote execution.

## Architecture

### Workflow Execution Model

```
┌──────────────────────────────────────────────────────────────┐
│                       Workflow                                │
│  (Defines states + trigger config)                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ has many
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    WorkflowState                              │
│  (Analysis, Architecture, Implementation, etc.)               │
│  - order: 1, 2, 3, ...                                       │
│  - componentId: Which agent executes                         │
│  - preExecutionInstructions                                  │
│  - postExecutionInstructions                                 │
│  - requiresApproval: bool                                    │
│  - mandatory: bool                                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ instantiated as
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     WorkflowRun                               │
│  (Execution instance for a story)                             │
│  - storyId                                                   │
│  - status: pending → running → completed/failed              │
│  - currentStateId: Which state is executing                  │
│  - isPaused: bool                                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ has many
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    ComponentRun                               │
│  (Agent execution for a specific state)                       │
│  - componentId                                                │
│  - status: running → completed/failed                        │
│  - tokensInput, tokensOutput, cost                           │
│  - componentSummary (structured output)                      │
└──────────────────────────────────────────────────────────────┘
```

### 3-Phase State Execution

Each WorkflowState executes in 3 phases:

```
┌─────────────────────────────────────────────────────────────┐
│  1. PRE-EXECUTION PHASE                                      │
│     - Run by orchestrator (not agent)                        │
│     - Gather context, prepare inputs                         │
│     - Instructions: WorkflowState.preExecutionInstructions   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  2. AGENT EXECUTION PHASE                                    │
│     - Spawn component agent (Task tool)                      │
│     - Agent performs work (coding, analysis, etc.)           │
│     - ComponentRun created and tracked                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  3. POST-EXECUTION PHASE                                     │
│     - Run by orchestrator (not agent)                        │
│     - Validate output, update story status                   │
│     - Instructions: WorkflowState.postExecutionInstructions  │
└─────────────────────────────────────────────────────────────┘
```

## Data Structures

### Workflow (schema.prisma L663-712)

```typescript
{
  id: string;
  projectId: string;
  name: string;
  description?: string;
  version: string;

  // Trigger configuration
  triggerConfig: {
    type: 'manual' | 'story_assigned' | 'webhook';
    filters?: object;
    notifications?: object;
  };

  // Component assignments (ST-90)
  componentAssignments: Array<{
    componentName: string;
    componentId: string;
    versionId: string;
    version: string;
    versionMajor: number;
    versionMinor: number;
  }>;

  // Settings
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Versioning (ST-58)
  versionMajor: number;
  versionMinor: number;
  parentId?: string;
  isDeprecated: boolean;
}
```

### WorkflowState (schema.prisma L1532-1569)

Defines a single execution state within a workflow.

```typescript
{
  id: string;
  workflowId: string;
  name: string;                    // "analysis", "architecture", "implementation"
  order: number;                   // Execution order (1, 2, 3, ...)

  // Agent Configuration
  componentId?: string;            // Which component executes this state

  // Instructions (run by orchestrator)
  preExecutionInstructions?: string;
  postExecutionInstructions?: string;

  // Configuration
  requiresApproval: boolean;       // Human-in-the-loop gate (ST-148)
  mandatory: boolean;              // Must complete to proceed

  // Remote execution (ST-150)
  runLocation: 'local' | 'laptop';
  offlineFallback: 'pause' | 'skip' | 'fail';

  createdAt: Date;
  updatedAt: Date;
}
```

### WorkflowRun (schema.prisma L716-828)

Execution instance of a workflow for a story.

```typescript
{
  id: string;
  projectId: string;
  workflowId: string;
  storyId?: string;
  epicId?: string;

  // Trigger info
  triggeredBy?: string;            // User ID or "system"
  triggerType?: string;            // "manual", "story_assigned"

  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

  // State tracking (ST-143)
  currentStateId?: string;         // Which state is executing
  runnerSessionId?: string;        // Claude Code session ID
  isPaused: boolean;
  pausedAt?: Date;
  pauseReason?: string;            // "breakpoint", "error", "approval_needed"

  // Timing
  startedAt: Date;
  finishedAt?: Date;
  durationSeconds?: number;

  // Aggregated metrics
  totalTokensInput?: number;
  totalTokensOutput?: number;
  totalTokens?: number;
  totalLocGenerated?: number;
  estimatedCost?: number;

  // Transcript tracking (ST-172)
  masterTranscriptPaths: string[];
  runnerTranscriptPath?: string;

  // Resume context (ST-147)
  resumeSummary?: string;
  checkpointData?: object;

  // Metadata
  metadata?: object;
}
```

### ComponentRun (schema.prisma L831-964)

Agent execution for a specific state.

```typescript
{
  id: string;
  workflowRunId: string;
  componentId: string;
  executionOrder?: number;

  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  success: boolean;

  // Input/Output
  inputData?: object;
  outputData?: object;
  output?: string;

  // Metrics
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  tokensCacheCreation: number;     // ST-242
  tokensCacheRead: number;         // ST-242
  cost: number;                    // ST-242
  durationSeconds?: number;
  locGenerated?: number;
  testsAdded?: number;

  // Code changes
  filesModified: string[];
  commits: string[];

  // Turn tracking (ST-147)
  totalTurns?: number;
  manualPrompts?: number;
  autoContinues?: number;

  // Transcript & Summary
  transcriptPath?: string;
  componentSummary?: string;       // ST-203: Structured summary

  startedAt: Date;
  finishedAt?: Date;
}
```

## Flows

### Starting a Workflow

```
1. User calls start_team_run MCP tool
   ├─ Creates WorkflowRun with status='pending'
   ├─ Registers master transcript path (ST-172)
   ├─ Stores sessionId in metadata._transcriptTracking
   └─ Returns runId

2. Orchestrator calls get_current_step
   ├─ Returns workflowSequence with instructions
   │  ├─ prePhase: Pre-execution instructions
   │  ├─ agentPhase: Agent spawn instructions
   │  └─ postPhase: Post-execution instructions
   └─ Current state: first WorkflowState (order=1)

3. Orchestrator executes prePhase
   └─ Follows pre-execution instructions from WorkflowState

4. Orchestrator calls advance_step (move to agent phase)
   ├─ Updates WorkflowRun.status = 'running'
   ├─ Calls startAgentTracking()
   │  └─ Creates ComponentRun with status='running'
   └─ Returns instructions to spawn agent

5. Orchestrator spawns agent via Task tool
   └─ Agent performs work (coding, analysis, etc.)

6. Agent completes, orchestrator calls advance_step (exit agent phase)
   ├─ Calls completeAgentTracking()
   │  ├─ Syncs spawnedAgentTranscripts from laptop (ST-247)
   │  ├─ Parses transcript for metrics
   │  ├─ Calculates cost (ST-242)
   │  ├─ Generates component summary
   │  └─ Updates ComponentRun with results
   └─ Moves to postPhase

7. Orchestrator executes postPhase
   └─ Follows post-execution instructions from WorkflowState

8. Orchestrator calls advance_step (move to next state)
   ├─ Increments to next WorkflowState (order+1)
   └─ Repeats steps 2-7 for next state

9. When all states complete, orchestrator calls update_team_status
   └─ Sets WorkflowRun.status = 'completed'
```

### Approval Gates (ST-148)

When `WorkflowState.requiresApproval = true`:

```
1. Agent phase completes
2. advance_step creates ApprovalRequest
   ├─ Status: 'pending'
   ├─ ContextSummary: AI-generated summary of agent output
   └─ ArtifactKeys: List of artifacts produced

3. Orchestrator pauses workflow
   ├─ WorkflowRun.isPaused = true
   ├─ WorkflowRun.pauseReason = 'approval_needed'
   └─ Notifies user (WebSocket event)

4. Human reviews output and decides:

   Option A: Approve
   ├─ ApprovalRequest.resolution = 'approved'
   ├─ ApprovalRequest.reExecutionMode = 'none'
   └─ Orchestrator continues to next state

   Option B: Reject with feedback
   ├─ ApprovalRequest.resolution = 'rejected'
   ├─ ApprovalRequest.reExecutionMode = 'feedback_injection'
   ├─ ApprovalRequest.feedback = "Fix X, Y, Z"
   └─ Orchestrator calls repeat_step with feedback

   Option C: Edit artifacts and continue
   ├─ Human edits artifacts directly
   ├─ ApprovalRequest.reExecutionMode = 'artifact_edit'
   ├─ ApprovalRequest.editedArtifacts = ['ARCH_DOC']
   └─ Orchestrator continues to next state

5. Workflow resumes
   └─ WorkflowRun.isPaused = false
```

### Breakpoints (ST-143)

Debugging support for workflow development.

```
1. User sets breakpoint via MCP tool
   └─ Creates RunnerBreakpoint with position='before' or 'after'

2. Orchestrator reaches breakpoint state
   ├─ Checks for active breakpoints before state execution
   ├─ If breakpoint found:
   │  ├─ WorkflowRun.isPaused = true
   │  ├─ WorkflowRun.pauseReason = 'breakpoint'
   │  └─ Notifies user (WebSocket event)
   └─ Waits for user to resume

3. User inspects state (get_runner_status)
   └─ Returns checkpoint data, decision history

4. User resumes workflow
   └─ WorkflowRun.isPaused = false
```

### Remote Execution (ST-150)

When `WorkflowState.runLocation = 'laptop'`:

```
1. Orchestrator checks for online remote agent
   └─ Queries RemoteAgent table for status='online'

2. If agent online:
   ├─ Creates RemoteJob with jobType='claude-agent'
   ├─ Sends WebSocket event to laptop agent
   └─ Laptop spawns Claude Code session

3. If agent offline:
   └─ Follows WorkflowState.offlineFallback:
      ├─ 'pause': Pause workflow until agent reconnects
      ├─ 'skip': Skip this state and continue
      └─ 'fail': Fail workflow with error

4. Agent execution streams events back to server
   └─ AgentStreamEvent records created for token updates, tool calls

5. Agent completes, result sent to server
   └─ ComponentRun updated with output and metrics
```

## Troubleshooting

### Workflow stuck in running state

**Symptom:** WorkflowRun.status = 'running' but no progress.

**Diagnosis:**
```sql
SELECT id, status, "currentStateId", "isPaused", "pauseReason"
FROM workflow_runs
WHERE id = '<run-uuid>';

SELECT * FROM component_runs
WHERE "workflowRunId" = '<run-uuid>'
ORDER BY "executionOrder" DESC
LIMIT 1;
```

**Solution:**
- If `isPaused = true`: Check pause reason (breakpoint, approval, agent disconnect)
- If ComponentRun status = 'running': Check if agent is still executing
- If no ComponentRun: State machine is stuck, call repeat_step to retry

### Approval gate not triggering

**Symptom:** State with `requiresApproval=true` completes without approval request.

**Diagnosis:**
```sql
SELECT * FROM workflow_states
WHERE id = '<state-uuid>';

SELECT * FROM approval_requests
WHERE "workflowRunId" = '<run-uuid>'
AND "stateId" = '<state-uuid>';
```

**Solution:**
- Check WorkflowRun for approval override settings (ST-148)
- Verify advance_step is creating approval request correctly
- Check backend logs for approval gate processing errors

### Component not executing on laptop

**Symptom:** WorkflowState.runLocation = 'laptop' but executes locally.

**Diagnosis:**
```sql
SELECT * FROM remote_agents
WHERE status = 'online'
AND "claudeCodeAvailable" = true;

SELECT * FROM remote_jobs
WHERE "workflowRunId" = '<run-uuid>'
AND "jobType" = 'claude-agent';
```

**Solution:**
- Verify laptop agent is online and connected
- Check RemoteAgent.claudeCodeAvailable = true
- Review remote job status and error messages

## References

- ST-143: Story Runner State Machine
- ST-148: Approval Gates
- ST-150: Remote Agent Execution
- ST-172: Transcript Registration
- ST-215: Automatic Agent Tracking
- ST-242: Telemetry Metrics
- ST-247: Transcript Sync Fix
- ST-279: Living Documentation System

## Changelog

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented workflow execution model and 3-phase execution
- Added approval gates, breakpoints, and remote execution flows
- Documented key entities: Workflow, WorkflowState, WorkflowRun, ComponentRun
