#!/bin/bash
# VibeStudio Track Agents Hook
# Track spawned agent transcript paths locally for debugging
# ST-276: Also clears agent-active flag when agent completes
#
# Triggers: PostToolUse (Task)
# Purpose: Track spawned agent transcript paths in running-workflows.json (for debugging)
#
# NOTE: ST-170 TranscriptWatcher on laptop automatically detects new transcript files
# and registers them in the unassigned_transcripts table via WebSocket.
# record_agent_complete reads from that table - no MCP call needed here.

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle Task tool
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"
AGENT_ACTIVE_FILE="$PROJECT_DIR/.claude/.agent-active.json"

# ST-276: Clear agent-active flag - agent has completed
if [ -f "$AGENT_ACTIVE_FILE" ]; then
  rm -f "$AGENT_ACTIVE_FILE"
  echo "$(date): Cleared agent-active flag (PostToolUse Task)" >> /tmp/track-agents-debug.log
fi

# FILTER: Only track Task calls from master orchestrator session
# Spawned agents (native or custom) that spawn their own sub-agents will have
# different session IDs not registered in running-workflows.json
if [ -f "$WORKFLOWS_FILE" ]; then
  IS_ORCHESTRATOR=$(jq -r --arg sid "$SESSION_ID" '
    .sessions[$sid].runId != null
  ' "$WORKFLOWS_FILE" 2>/dev/null || echo "false")

  if [ "$IS_ORCHESTRATOR" != "true" ]; then
    # Not the master orchestrator - skip tracking
    exit 0
  fi
fi

# Extract agent ID from tool response (if available)
AGENT_ID=$(echo "$INPUT" | jq -r '.tool_response.agentId // empty' 2>/dev/null || echo "")

# If no agentId in response, try to extract from other fields
if [ -z "$AGENT_ID" ]; then
  AGENT_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty' 2>/dev/null | cut -c1-8 || echo "")
fi

if [ -n "$AGENT_ID" ]; then
  # Build agent transcript path using Claude Code's naming convention
  ESCAPED_PATH=$(echo "$PROJECT_DIR" | sed 's|^/|-|' | tr '/' '-')
  AGENT_TRANSCRIPT="$HOME/.claude/projects/$ESCAPED_PATH/agent-${AGENT_ID}.jsonl"

  # Track locally for debugging (ST-170 handles the actual registration)
  jq --arg sid "$SESSION_ID" \
     --arg aid "$AGENT_ID" \
     --arg atp "$AGENT_TRANSCRIPT" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     'if .sessions[$sid] then
        .sessions[$sid].spawnedAgentTranscripts = ((.sessions[$sid].spawnedAgentTranscripts // []) + [{
          agentId: $aid,
          transcriptPath: $atp,
          spawnedAt: $ts
        }])
      else . end' \
     "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"
fi

exit 0
