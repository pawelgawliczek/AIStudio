#!/bin/bash
# VibeStudio Track Agents Hook
# Track spawned agent transcript paths locally
#
# Triggers: PostToolUse (Task)
# Purpose:
#   1. Track spawned agent transcript paths in local JSON (for debugging)
#   2. The orchestrator should call add_transcript MCP tool after spawning
#      to store componentId → transcriptPath mapping in the database
#
# Note: This hook doesn't know the componentId - only the orchestrator does.
# The orchestrator should call add_transcript({ runId, componentId, agentId, transcriptPath, type: "agent" })

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle Task tool
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

# Extract agent ID from tool response (if available)
# Note: Task tool response structure may vary
AGENT_ID=$(echo "$INPUT" | jq -r '.tool_response.agentId // empty' 2>/dev/null || echo "")

# If no agentId in response, try to extract from other fields
if [ -z "$AGENT_ID" ]; then
  # Try alternative extraction methods
  AGENT_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty' 2>/dev/null | cut -c1-8 || echo "")
fi

WORKFLOWS_FILE="$CLAUDE_PROJECT_DIR/.claude/running-workflows.json"

if [ -n "$AGENT_ID" ] && [ -f "$WORKFLOWS_FILE" ]; then
  # Build agent transcript path using Claude Code's naming convention
  ESCAPED_PATH=$(echo "$CLAUDE_PROJECT_DIR" | sed 's|^/|-|' | tr '/' '-')
  AGENT_TRANSCRIPT="$HOME/.claude/projects/$ESCAPED_PATH/agent-${AGENT_ID}.jsonl"

  # Track locally for debugging (orchestrator will call add_transcript for DB storage)
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
