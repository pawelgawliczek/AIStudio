# Agent Execution

**Version:** 1.0
**Last Updated:** 2025-12-17
**Epic:** ST-279

## Overview

Agent Execution tracks the lifecycle of component agents (PM, Explorer, Architect, Designer, Implementer) as they execute workflow states. The system automatically creates ComponentRun records, collects telemetry metrics, and generates structured summaries of agent output.

## Architecture

### Agent Tracking Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    advance_step                               │
│               (Enter Agent Phase)                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ calls
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              startAgentTracking()                             │
│  - Creates ComponentRun with status='running'                │
│  - Broadcasts component:started WebSocket event              │
│  - Starts transcript tailing (if available)                  │
│  - Records startedAt timestamp                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│           Orchestrator spawns agent (Task tool)               │
│  Agent performs work:                                         │
│  - Reads codebase (Grep, Glob, Read)                        │
│  - Writes code (Edit, Write)                                 │
│  - Executes commands (Bash)                                  │
│  - Creates artifacts (upload_artifact)                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ agent completes
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    advance_step                               │
│               (Exit Agent Phase)                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ calls
                         ▼
┌──────────────────────────────────────────────────────────────┐
│            completeAgentTracking()                            │
│  - Syncs spawnedAgentTranscripts from laptop (ST-247)       │
│  - Parses transcript for metrics (tokens, turns)             │
│  - Calculates cost using pricing utility (ST-242)            │
│  - Generates component summary (structured format)           │
│  - Updates ComponentRun with results                         │
│  - Broadcasts component:completed WebSocket event            │
│  - Stops transcript tailing                                  │
└──────────────────────────────────────────────────────────────┘
```

## Data Structures

### ComponentRun (schema.prisma L831-964)

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
  inputData?: object;              // Context passed to agent
  outputData?: object;             // Structured output from agent
  output?: string;                 // Text output

  // Token metrics
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  tokensCacheCreation: number;     // ST-242: Prompt caching tokens
  tokensCacheRead: number;         // ST-242: Cache read tokens

  // Cost
  cost: number;                    // ST-242: Calculated using pricing utility
  modelId?: string;                // Model used (e.g., claude-sonnet-4)

  // Efficiency metrics
  durationSeconds?: number;
  locGenerated?: number;           // Lines of code written
  testsAdded?: number;             // Test files/cases added
  tokensPerLoc?: number;           // Efficiency: tokens / LOC

  // Code changes
  filesModified: string[];
  commits: string[];
  startCommitHash?: string;        // ST-278: Git commit at start
  endCommitHash?: string;          // ST-278: Git commit at end

  // Turn tracking (ST-147)
  totalTurns?: number;             // All conversation turns
  manualPrompts?: number;          // User-typed prompts
  autoContinues?: number;          // Auto-continue prompts

  // Session tracking
  sessionId?: string;              // Claude Code session ID
  transcriptPath?: string;         // Path to agent transcript
  claudeAgentId?: string;          // Agent ID (8-char hex)

  // Summary
  componentSummary?: string;       // ST-203: Structured JSON summary

  // Timestamps
  startedAt: Date;
  finishedAt?: Date;
}
```

### Component Summary Structure (ST-203)

Structured format for agent output summaries:

```typescript
{
  version: "1.0",
  status: "success" | "partial" | "blocked" | "failed",
  summary: string,                 // Human-readable summary

  keyOutputs?: [                   // Main deliverables
    "Created architecture document with 3 layers",
    "Implemented authentication service",
    "Added 12 unit tests for auth flow"
  ],

  nextAgentHints?: [               // Context for next agent
    "Database schema needs migration",
    "Consider adding rate limiting"
  ],

  artifactsProduced?: [            // Artifacts created
    { key: "ARCH_DOC", type: "markdown" },
    { key: "API_SPEC", type: "json" }
  ],

  errors?: [                       // Issues encountered
    { type: "test_failure", message: "Auth test timeout" }
  ]
}
```

## Flows

### Automatic Agent Tracking (ST-215)

Agent tracking is **automatic** via `advance_step`. Do NOT call `record_agent_start`/`record_agent_complete` directly (these tools are obsolete as of ST-242).

```
1. Orchestrator calls advance_step (enter agent phase)
   └─ Automatically calls startAgentTracking()
      ├─ Creates ComponentRun with status='running'
      ├─ Stores inputData from workflow context
      └─ Records startedAt timestamp

2. Orchestrator spawns agent via Task tool
   └─ Agent executes work (coding, analysis, etc.)

3. Orchestrator calls advance_step (exit agent phase)
   └─ Automatically calls completeAgentTracking()
      ├─ Updates ComponentRun with output and status
      ├─ Parses transcript for telemetry
      ├─ Calculates cost
      ├─ Generates summary
      └─ Records finishedAt timestamp
```

### Telemetry Collection

Metrics are extracted from transcript JSONL files:

```typescript
// Transcript parsing (remote-runner.service.ts)
async parseTranscriptForMetrics(transcriptPath: string) {
  const lines = await readFile(transcriptPath);

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let totalTurns = 0;
  let manualPrompts = 0;

  for (const line of lines) {
    const event = JSON.parse(line);

    // Token metrics from message_delta events
    if (event.type === 'message_delta' && event.usage) {
      inputTokens += event.usage.input_tokens || 0;
      outputTokens += event.usage.output_tokens || 0;
    }

    // ST-242: Cache token metrics
    if (event.cache_creation_input_tokens) {
      cacheCreationTokens += event.cache_creation_input_tokens;
    }
    if (event.cache_read_input_tokens) {
      cacheReadTokens += event.cache_read_input_tokens;
    }

    // Turn tracking
    if (event.type === 'message_start' && event.role === 'user') {
      totalTurns++;
      if (!event.isAutoContinue) {
        manualPrompts++;
      }
    }
  }

  return {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTurns,
    manualPrompts,
  };
}
```

### Cost Calculation (ST-242)

Cost is calculated using centralized pricing utility:

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

**Pricing Table (per million tokens):**

| Model | Input | Output | Cache Write | Cache Read |
|-------|-------|--------|-------------|------------|
| Opus 4.5 | $5.00 | $25.00 | $6.25 | $0.50 |
| Sonnet 4 | $3.00 | $15.00 | $3.75 | $0.30 |
| Haiku 3.5 | $0.80 | $4.00 | $1.00 | $0.08 |

### Summary Generation

Component summary is auto-generated if not provided:

```typescript
async generateComponentSummary(componentRun: ComponentRun) {
  const { output, filesModified, commits, tokensInput, tokensOutput } = componentRun;

  return {
    version: "1.0",
    status: componentRun.success ? "success" : "failed",
    summary: extractSummaryFromOutput(output),
    keyOutputs: extractKeyOutputs(output, filesModified),
    artifactsProduced: await getArtifactsForComponentRun(componentRun.id),
    metrics: {
      tokens: tokensInput + tokensOutput,
      filesModified: filesModified.length,
      commits: commits.length,
    },
  };
}
```

### Transcript Sync from Laptop (ST-247)

Before completing agent tracking, `advance_step` syncs spawned agent transcripts from the laptop:

```typescript
// 1. Read running-workflows.json from laptop
const runningWorkflows = await remoteRunner.readFile(
  '~/.claude/running-workflows.json'
);

// 2. Extract transcripts for current master session
const masterSessionId = workflowRun.metadata._transcriptTracking.sessionId;
const sessionData = runningWorkflows.sessions[masterSessionId];

// 3. Merge into WorkflowRun.spawnedAgentTranscripts
await prisma.workflowRun.update({
  where: { id: workflowRunId },
  data: {
    spawnedAgentTranscripts: sessionData.spawnedAgentTranscripts,
  },
});

// 4. Use transcripts for telemetry parsing
for (const transcript of sessionData.spawnedAgentTranscripts) {
  const metrics = await parseTranscriptForMetrics(transcript.transcriptPath);
  // Update ComponentRun with metrics
}
```

## Troubleshooting

### ComponentRun not created

**Symptom:** Agent executes but no ComponentRun record exists.

**Diagnosis:**
```sql
SELECT * FROM component_runs
WHERE "workflowRunId" = '<run-uuid>'
ORDER BY "startedAt" DESC;
```

**Solution:**
- Verify `advance_step` is called to enter agent phase
- Check backend logs for `startAgentTracking` errors
- Ensure workflow state has `componentId` assigned

### Zero token counts

**Symptom:** ComponentRun shows 0 tokens despite agent execution.

**Diagnosis:**
```sql
SELECT "tokensInput", "tokensOutput", "tokensCacheCreation", "tokensCacheRead", "transcriptPath"
FROM component_runs
WHERE id = '<run-uuid>';
```

**Solution:**
- Verify transcript file exists at `transcriptPath`
- Check laptop agent is online for transcript parsing
- Review transcript content for `message_delta` events with usage data
- ST-247: Ensure spawnedAgentTranscripts was synced from laptop

### Missing component summary

**Symptom:** ComponentRun has no `componentSummary` field.

**Diagnosis:**
```sql
SELECT "componentSummary", output, status
FROM component_runs
WHERE id = '<run-uuid>';
```

**Solution:**
- Summary is auto-generated if not provided by orchestrator
- Check backend logs for summary generation errors
- Verify output field has content to generate summary from

### Cost calculation incorrect

**Symptom:** ComponentRun.cost doesn't match expected pricing.

**Diagnosis:**
```typescript
import { calculateCost } from '../mcp/utils/pricing';

const expectedCost = calculateCost({
  tokensInput: componentRun.tokensInput,
  tokensOutput: componentRun.tokensOutput,
  tokensCacheCreation: componentRun.tokensCacheCreation,
  tokensCacheRead: componentRun.tokensCacheRead,
  modelId: componentRun.modelId,
});

console.log('Expected:', expectedCost, 'Actual:', componentRun.cost);
```

**Solution:**
- ST-242: Cost is calculated via `mcp/utils/pricing.ts`
- Verify modelId is correctly identified (e.g., "claude-sonnet-4")
- Check cache token columns are populated correctly
- Review pricing table for current rates

## References

- ST-147: Turn Tracking and Manual Prompts
- ST-203: Structured Component Summary
- ST-215: Automatic Agent Tracking in advance_step
- ST-242: Telemetry Metrics Fix (centralized pricing)
- ST-247: Transcript Sync Fix (metadata path, cache tokens)
- ST-278: Commit Tracking for Accurate LOC
- ST-279: Living Documentation System

## Changelog

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented agent tracking lifecycle and automatic tracking via advance_step
- Added telemetry collection, cost calculation, and summary generation
- Documented structured summary format (ST-203)
- Added transcript sync from laptop (ST-247)
