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

  # ST-172: Output JSON for orchestrator to register transcript in DB
  # The orchestrator should call add_transcript with this info
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse:Task",
    "agentSpawned": {
      "agentId": "$AGENT_ID",
      "transcriptPath": "$AGENT_TRANSCRIPT",
      "runId": "$RUN_ID"
    },
    "action": "ORCHESTRATOR: Call add_transcript({ type: 'agent', runId: '$RUN_ID', componentId: <YOUR_COMPONENT_ID>, agentId: '$AGENT_ID', transcriptPath: '$AGENT_TRANSCRIPT' }) to register this transcript."
  }
}
EOF
fi

exit 0
