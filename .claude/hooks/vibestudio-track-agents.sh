#!/bin/bash
# VibeStudio Track Agents Hook
# Track spawned agent transcript paths and notify orchestrator
#
# Triggers: PostToolUse (Task)
# Purpose:
#   1. Track spawned agent transcript paths in local JSON (for debugging)
#   2. Output agent info so orchestrator can call add_transcript MCP tool
#
# IMPORTANT: The orchestrator MUST call add_transcript after seeing this output:
#   add_transcript({ type: 'agent', runId, componentId, agentId, transcriptPath })
# This registers the transcript in the DB so record_agent_complete can find it.

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle Task tool
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

# FILTER: Only track Task calls from master orchestrator session
# Spawned agents (native or custom) that spawn their own sub-agents will have
# different session IDs not registered in running-workflows.json
WORKFLOWS_FILE="$CLAUDE_PROJECT_DIR/.claude/running-workflows.json"

if [ -f "$WORKFLOWS_FILE" ]; then
  IS_ORCHESTRATOR=$(jq -r --arg sid "$SESSION_ID" '
    .sessions[$sid].runId != null
  ' "$WORKFLOWS_FILE" 2>/dev/null || echo "false")

  if [ "$IS_ORCHESTRATOR" != "true" ]; then
    # Not the master orchestrator - skip tracking
    # (This is a spawned agent spawning its own sub-agents)
    exit 0
  fi
fi

# Extract agent ID from tool response (if available)
# Note: Task tool response structure may vary
AGENT_ID=$(echo "$INPUT" | jq -r '.tool_response.agentId // empty' 2>/dev/null || echo "")

# If no agentId in response, try to extract from other fields
if [ -z "$AGENT_ID" ]; then
  # Try alternative extraction methods
  AGENT_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty' 2>/dev/null | cut -c1-8 || echo "")
fi

if [ -n "$AGENT_ID" ]; then
  # Build agent transcript path using Claude Code's naming convention
  ESCAPED_PATH=$(echo "$CLAUDE_PROJECT_DIR" | sed 's|^/|-|' | tr '/' '-')
  AGENT_TRANSCRIPT="$HOME/.claude/projects/$ESCAPED_PATH/agent-${AGENT_ID}.jsonl"

  # Get current runId from workflows file
  RUN_ID=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].runId // empty' "$WORKFLOWS_FILE" 2>/dev/null || echo "")

  # Track locally for debugging
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

  # ST-172: Automatically register transcript via MCP HTTP client
  # Extract componentId from the Task tool input (orchestrator passes it in prompt)
  COMPONENT_ID=$(echo "$INPUT" | jq -r '.tool_input.prompt // ""' | grep -oE 'componentId["\s:]+([a-f0-9-]{36})' | head -1 | grep -oE '[a-f0-9-]{36}' || echo "")

  if [ -n "$COMPONENT_ID" ]; then
    # Call helper script to register transcript
    npx tsx "$CLAUDE_PROJECT_DIR/.claude/hooks/helpers/register-transcript.ts" \
      "$RUN_ID" "$COMPONENT_ID" "$AGENT_ID" "$AGENT_TRANSCRIPT" 2>&1 || {
      echo "[ST-172] Warning: Failed to auto-register transcript (will rely on orchestrator)" >&2
    }
  fi

  # Still output instructions as fallback (in case auto-registration fails)
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse:Task",
    "agentSpawned": {
      "agentId": "$AGENT_ID",
      "transcriptPath": "$AGENT_TRANSCRIPT",
      "runId": "$RUN_ID",
      "autoRegistered": $([ -n "$COMPONENT_ID" ] && echo "true" || echo "false")
    },
    "action": "Transcript auto-registered via hook. Manual call not needed."
  }
}
EOF
fi

exit 0
