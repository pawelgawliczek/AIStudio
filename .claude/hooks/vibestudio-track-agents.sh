#!/bin/bash
# VibeStudio Track Agents Hook
# Track spawned agent transcript paths and sync to backend
#
# Triggers: PostToolUse (Task)
# Purpose: Track spawned agent transcript paths and sync to workflow run metadata

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
  ESCAPED_PATH=$(echo "$CLAUDE_PROJECT_DIR" | sed 's|^/|-|' | tr '/' '-')
  AGENT_TRANSCRIPT="$HOME/.claude/projects/$ESCAPED_PATH/agent-${AGENT_ID}.jsonl"
  SPAWNED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Track locally
  jq --arg sid "$SESSION_ID" \
     --arg aid "$AGENT_ID" \
     --arg atp "$AGENT_TRANSCRIPT" \
     --arg ts "$SPAWNED_AT" \
     'if .sessions[$sid] then
        .sessions[$sid].spawnedAgentTranscripts = ((.sessions[$sid].spawnedAgentTranscripts // []) + [{
          agentId: $aid,
          transcriptPath: $atp,
          spawnedAt: $ts
        }])
      else . end' \
     "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

  # ST-242: Sync to backend workflow run metadata via MCP API
  # Get workflow run ID from the session
  RUN_ID=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].runId // empty' "$WORKFLOWS_FILE" 2>/dev/null)

  if [ -n "$RUN_ID" ]; then
    # Call add_transcript MCP tool via API to sync to backend
    # This adds the agent transcript to the workflow run's spawnedAgentTranscripts metadata
    API_URL="${VIBESTUDIO_API_URL:-https://vibestudio.example.com/api}"
    API_KEY="${VIBESTUDIO_API_KEY:-}"

    if [ -n "$API_KEY" ]; then
      # Call the add_transcript tool
      curl -s -X POST "$API_URL/mcp/v1/call-tool" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{
          \"tool\": \"add_transcript\",
          \"params\": {
            \"runId\": \"$RUN_ID\",
            \"agentId\": \"$AGENT_ID\",
            \"transcriptPath\": \"$AGENT_TRANSCRIPT\",
            \"spawnedAt\": \"$SPAWNED_AT\"
          }
        }" > /dev/null 2>&1 || true
    fi
  fi
fi

exit 0
