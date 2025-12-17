# Hooks & Enforcement

**Version:** 1.0
**Last Updated:** 2025-12-17
**Epic:** ST-279

## Overview

Claude Code Hooks are lifecycle event handlers that enforce workflow rules, track agent transcripts, and prevent direct file editing during workflow execution. The system uses 5 hooks with a flag-based mechanism (`.agent-active.json`, `.workflow-enforcement.json`) to block orchestrator actions while allowing spawned agents to work freely.

## Architecture

### Hook System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Claude Code Hooks                          │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│SessionStart  │   │  PostToolUse     │   │ SessionEnd   │
│              │   │  - Task          │   │              │
│Track session │   │  - ExitPlanMode  │   │Mark session  │
│transcript    │   │  Track agents    │   │ended         │
└──────────────┘   └──────────────────┘   └──────────────┘
```

### Enforcement Mechanism

```
┌─────────────────────────────────────────────────────────────┐
│           Orchestrator Session (Master)                      │
│                                                              │
│  1. start_team_run → Creates .workflow-enforcement.json     │
│     { "runId": "abc", "activeAgents": {} }                  │
│                                                              │
│  2. advance_step (enter agent phase)                        │
│     → Spawns agent, sets .agent-active.json                 │
│     { "agentId": "123", "subagent": "implementation" }      │
│                                                              │
│  3. PostToolUse: Task hook detects agent spawn              │
│     → Updates .workflow-enforcement.json                    │
│     { "activeAgents": { "123": { ... } } }                  │
│                                                              │
│  4. Orchestrator tries to Read/Edit/Write                   │
│     → vibestudio-enforce-no-edit.sh BLOCKS                  │
│     → Returns error: "Workflow in progress"                 │
│                                                              │
│  5. Spawned agent tries to Read/Edit/Write                  │
│     → vibestudio-enforce-no-edit.sh ALLOWS                  │
│     → Agent performs work                                   │
│                                                              │
│  6. Agent completes                                         │
│     → PostToolUse: Task hook clears .agent-active.json      │
│     → Removes agent from .workflow-enforcement.json         │
│                                                              │
│  7. update_team_status (completed)                          │
│     → Clears .workflow-enforcement.json                     │
└─────────────────────────────────────────────────────────────┘
```

## Data Structures

### .agent-active.json (ST-276)

Ephemeral flag indicating an agent is currently executing.

**Location:** `<project-root>/.agent-active.json`

**Structure:**
```json
{
  "agentId": "abc12345",
  "subagent_type": "implementation",
  "startedAt": "2025-12-17T10:00:00.000Z",
  "runId": "workflow-run-uuid",
  "componentId": "component-uuid"
}
```

**Lifecycle:**
- Created: When Task tool spawns agent
- Deleted: When agent completes or session ends

### .workflow-enforcement.json

Tracks active workflow execution and spawned agents.

**Location:** `<project-root>/.workflow-enforcement.json`

**Structure:**
```json
{
  "runId": "workflow-run-uuid",
  "workflowId": "workflow-uuid",
  "storyId": "story-uuid",
  "storyKey": "ST-123",
  "startedAt": "2025-12-17T09:00:00.000Z",
  "masterSessionId": "session-abc123",
  "projectPath": "/Users/user/projects/AIStudio",
  "activeAgents": {
    "abc12345": {
      "agentId": "abc12345",
      "subagent_type": "implementation",
      "spawnedAt": "2025-12-17T10:00:00.000Z",
      "componentId": "component-uuid",
      "transcriptPath": "/Users/user/.claude/sessions/agent-abc12345.jsonl"
    }
  }
}
```

**Lifecycle:**
- Created: By `start_team_run` MCP tool
- Updated: By PostToolUse: Task hook (adds/removes agents)
- Deleted: By `update_team_status` when workflow completes

### running-workflows.json (ST-247)

Tracks spawned agent transcripts for telemetry sync.

**Location:** `~/.claude/running-workflows.json`

**Structure:**
```json
{
  "sessions": {
    "session-abc123": {
      "projectPath": "/Users/user/projects/AIStudio",
      "spawnedAgentTranscripts": [
        {
          "agentId": "abc12345",
          "transcriptPath": "/Users/user/.claude/sessions/agent-abc12345.jsonl",
          "spawnedAt": "2025-12-17T10:00:00.000Z"
        }
      ]
    }
  }
}
```

**Lifecycle:**
- Updated: By PostToolUse: Task hook (tracks agent spawns)
- Read: By `advance_step` to sync transcripts to backend

## Hook Implementations

### 1. vibestudio-session-start.sh

**Trigger:** SessionStart

**Purpose:** Track master session transcript path for live streaming.

**Actions:**
1. Extract sessionId from Claude Code
2. Extract transcriptPath from stdin
3. Store in temporary file for MCP tool consumption
4. Handle compaction recovery (call `get_orchestration_context`)

**File:** `.claude/hooks/vibestudio-session-start.sh`

```bash
#!/bin/bash
# Extract session metadata from stdin
SESSION_ID=$(grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
TRANSCRIPT_PATH=$(grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4)

# Store for MCP tool
echo "{\"sessionId\":\"$SESSION_ID\",\"transcriptPath\":\"$TRANSCRIPT_PATH\"}" > /tmp/claude-session.json

# Handle compaction recovery
if [ -f ".compaction-recovery" ]; then
  echo "Compaction detected, recovering context..."
  # MCP call to get_orchestration_context
fi
```

### 2. vibestudio-session-end.sh

**Trigger:** SessionEnd

**Purpose:** Mark session as ended, clean up ephemeral files.

**Actions:**
1. Clear `.agent-active.json` if exists
2. Archive workflow context (if workflow running)
3. Notify backend of session end

**File:** `.claude/hooks/vibestudio-session-end.sh`

```bash
#!/bin/bash
# Clean up ephemeral agent flag
rm -f .agent-active.json

# Notify backend
curl -X POST http://backend/api/sessions/end \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"
```

### 3. vibestudio-track-agents.sh

**Trigger:** PostToolUse: Task

**Purpose:** Track spawned agent transcripts for telemetry collection.

**Actions:**
1. Extract agent metadata from Task tool output
2. Append to `.workflow-enforcement.json` activeAgents
3. Append to `~/.claude/running-workflows.json`
4. Set `.agent-active.json` flag

**File:** `.claude/hooks/vibestudio-track-agents.sh`

```bash
#!/bin/bash
# Extract agent ID and type
AGENT_ID=$(grep -o '"agentId":"[^"]*"' | cut -d'"' -f4)
SUBAGENT_TYPE=$(grep -o '"subagent_type":"[^"]*"' | cut -d'"' -f4)

# Set agent active flag
echo "{\"agentId\":\"$AGENT_ID\",\"subagent_type\":\"$SUBAGENT_TYPE\",\"startedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}" > .agent-active.json

# Update workflow enforcement file
if [ -f ".workflow-enforcement.json" ]; then
  jq ".activeAgents[\"$AGENT_ID\"] = {\"agentId\":\"$AGENT_ID\",\"subagent_type\":\"$SUBAGENT_TYPE\",\"spawnedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}" .workflow-enforcement.json > .workflow-enforcement.json.tmp
  mv .workflow-enforcement.json.tmp .workflow-enforcement.json
fi

# Update running workflows
TRANSCRIPT_PATH="$HOME/.claude/sessions/agent-$AGENT_ID.jsonl"
jq ".sessions[\"$MASTER_SESSION_ID\"].spawnedAgentTranscripts += [{\"agentId\":\"$AGENT_ID\",\"transcriptPath\":\"$TRANSCRIPT_PATH\",\"spawnedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}]" ~/.claude/running-workflows.json > ~/.claude/running-workflows.json.tmp
mv ~/.claude/running-workflows.json.tmp ~/.claude/running-workflows.json
```

### 4. vibestudio-enforce-no-edit.sh

**Trigger:** PreToolUse: Read, Edit, Write, Bash

**Purpose:** Block orchestrator from editing files during workflow execution, allow agents to work.

**Logic:**
```bash
#!/bin/bash
# Check if workflow is active
if [ ! -f ".workflow-enforcement.json" ]; then
  exit 0  # No workflow, allow
fi

# Check if agent is active
if [ -f ".agent-active.json" ]; then
  exit 0  # Agent active, allow
fi

# Block orchestrator
echo "ERROR: Cannot edit files during workflow execution. Spawn an agent via Task tool."
exit 1
```

### 5. vibestudio-enforce-agent-spawn.sh

**Trigger:** PreToolUse: Read, Grep, Glob, Edit, Write, Bash

**Purpose:** Force orchestrator to spawn agents instead of doing work directly.

**Logic:**
```bash
#!/bin/bash
# Check if workflow is active
if [ ! -f ".workflow-enforcement.json" ]; then
  exit 0  # No workflow, allow
fi

# Check if agent is active
if [ -f ".agent-active.json" ]; then
  exit 0  # Agent active, allow
fi

# Check current phase from workflow run
CURRENT_STATE=$(curl -s http://backend/api/workflow-runs/$RUN_ID/current-state)
PHASE=$(echo "$CURRENT_STATE" | jq -r '.phase')

# Block if in agent phase
if [ "$PHASE" = "agent" ]; then
  echo "ERROR: You are in the agent phase. Spawn an agent via Task tool instead of reading/editing files directly."
  exit 1
fi

exit 0
```

### 6. vibestudio-implementation.sh

**Trigger:** PostToolUse: ExitPlanMode

**Purpose:** Guide user to workflow execution when exiting plan mode.

**Actions:**
1. Detect exit from plan mode
2. Check if story has assigned workflow
3. Suggest using `start_team_run` MCP tool

**File:** `.claude/hooks/vibestudio-implementation.sh`

```bash
#!/bin/bash
# Detect story context
STORY_KEY=$(grep -o 'ST-[0-9]*' .claude-context.json | head -1)

if [ -n "$STORY_KEY" ]; then
  echo "Story $STORY_KEY has workflow assigned. Use start_team_run MCP tool to begin execution."
fi
```

## Flows

### Workflow Enforcement Flow

```
1. User calls start_team_run
   └─ Creates .workflow-enforcement.json with runId

2. advance_step (enter agent phase)
   └─ Orchestrator prepares to spawn agent

3. Orchestrator spawns agent via Task tool
   ├─ PostToolUse: Task hook executes
   │  ├─ Sets .agent-active.json
   │  ├─ Updates .workflow-enforcement.json activeAgents
   │  └─ Updates running-workflows.json
   └─ Agent starts execution

4. Agent reads/writes files
   └─ vibestudio-enforce-no-edit.sh allows (agent flag present)

5. Orchestrator tries to read/write files
   └─ vibestudio-enforce-no-edit.sh BLOCKS (no agent flag)

6. Agent completes
   ├─ PostToolUse: Task hook clears .agent-active.json
   └─ Removes agent from .workflow-enforcement.json

7. advance_step (exit agent phase)
   └─ Orchestrator can read/write again (no enforcement)

8. update_team_status (completed)
   └─ Removes .workflow-enforcement.json
```

### Agent Transcript Tracking Flow

```
1. PostToolUse: Task hook detects agent spawn
   └─ Appends to running-workflows.json

2. Agent executes, writes to transcript
   └─ Transcript file: ~/.claude/sessions/agent-<id>.jsonl

3. advance_step (exit agent phase)
   ├─ Reads running-workflows.json from laptop
   ├─ Syncs spawnedAgentTranscripts to WorkflowRun
   └─ Parses transcript for telemetry

4. Metrics stored in ComponentRun
   └─ Tokens, cost, turns, duration
```

## Troubleshooting

### Orchestrator blocked from editing files

**Symptom:** "Cannot edit files during workflow execution" error.

**Diagnosis:**
```bash
# Check if workflow is active
cat .workflow-enforcement.json

# Check if agent is active
cat .agent-active.json
```

**Solution:**
- If workflow active and no agent: Spawn agent via Task tool
- If agent active but still blocked: Check .agent-active.json is valid JSON
- If no workflow: Remove stale .workflow-enforcement.json file

### Agent not tracked

**Symptom:** Spawned agent transcript not appearing in backend.

**Diagnosis:**
```bash
# Check running workflows
cat ~/.claude/running-workflows.json | jq

# Check workflow enforcement
cat .workflow-enforcement.json | jq .activeAgents
```

**Solution:**
- Verify PostToolUse: Task hook executed (check Claude Code logs)
- Ensure running-workflows.json is writable
- Check transcript path is correct for agent ID

### Stale enforcement file

**Symptom:** Workflow completed but .workflow-enforcement.json still exists.

**Diagnosis:**
```bash
# Check file
cat .workflow-enforcement.json

# Check workflow status in backend
curl http://backend/api/workflow-runs/<run-id>
```

**Solution:**
- Manually delete .workflow-enforcement.json if workflow completed
- Ensure update_team_status clears enforcement file
- Check SessionEnd hook is cleaning up properly

## References

- ST-172: Master Session Transcript Registration
- ST-215: Automatic Agent Tracking in advance_step
- ST-242: Tool Simplification (removed obsolete tools)
- ST-247: Transcript Sync Fix (running-workflows.json)
- ST-276: Agent Active Flag (.agent-active.json)
- ST-279: Living Documentation System

## Changelog

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented 5 hooks: session-start, session-end, track-agents, enforce-no-edit, enforce-agent-spawn
- Added .agent-active.json flag mechanism (ST-276)
- Documented .workflow-enforcement.json and running-workflows.json structures
- Added enforcement flow and troubleshooting guide
