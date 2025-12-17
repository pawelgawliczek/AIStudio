#!/bin/bash
# VibeStudio Update Enforcement State Hook
# Updates local enforcement state after MCP tool calls
#
# Triggers: PostToolUse (start_team_run, advance_step, get_current_step, update_team_status)
# Purpose: Maintain local .workflow-enforcement.json for PreToolUse hooks
#
# ST-273: Workflow Execution Enforcement

# Enable debug logging
DEBUG_LOG="/tmp/update-enforcement-hook.log"
echo "=== Hook started at $(date) ===" >> "$DEBUG_LOG"

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

echo "TOOL_NAME: $TOOL_NAME" >> "$DEBUG_LOG"
echo "SESSION_ID: $SESSION_ID" >> "$DEBUG_LOG"

if [ -z "$SESSION_ID" ]; then
  echo "ERROR: No session_id" >> "$DEBUG_LOG"
  exit 0
fi

# Determine project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ENFORCEMENT_FILE="$PROJECT_DIR/.claude/.workflow-enforcement.json"
echo "ENFORCEMENT_FILE: $ENFORCEMENT_FILE" >> "$DEBUG_LOG"

# Ensure .claude directory exists
mkdir -p "$PROJECT_DIR/.claude"

# Initialize enforcement file if it doesn't exist
if [ ! -f "$ENFORCEMENT_FILE" ]; then
  echo '{"sessions":{}}' > "$ENFORCEMENT_FILE"
fi

# tool_response is an ARRAY of content blocks like {"type": "text", "text": "..."}
# Extract the text field and parse it as JSON
RAW_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response[0].text // .tool_response[0] // empty' 2>/dev/null)
if [ -z "$RAW_RESPONSE" ] || [ "$RAW_RESPONSE" = "null" ]; then
  echo "ERROR: No tool_response[0].text" >> "$DEBUG_LOG"
  exit 0
fi

# Parse the text as JSON
RESPONSE=$(echo "$RAW_RESPONSE" | jq -r '. // empty' 2>/dev/null)
if [ -z "$RESPONSE" ] || [ "$RESPONSE" = "null" ]; then
  echo "ERROR: Could not parse response as JSON" >> "$DEBUG_LOG"
  exit 0
fi

# Check for workflow completion first
WORKFLOW_COMPLETE=$(echo "$RESPONSE" | jq -r '.workflowComplete // false' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
echo "workflowComplete=$WORKFLOW_COMPLETE, status=$STATUS" >> "$DEBUG_LOG"

if [ "$WORKFLOW_COMPLETE" = "true" ] || [ "$STATUS" = "completed" ] || [ "$STATUS" = "cancelled" ] || [ "$STATUS" = "failed" ]; then
  echo "Workflow ended - clearing enforcement" >> "$DEBUG_LOG"
  jq --arg sid "$SESSION_ID" 'del(.sessions[$sid])' "$ENFORCEMENT_FILE" > "$ENFORCEMENT_FILE.tmp" 2>/dev/null
  if [ -f "$ENFORCEMENT_FILE.tmp" ]; then
    mv "$ENFORCEMENT_FILE.tmp" "$ENFORCEMENT_FILE"
  fi
  exit 0
fi

# Debug: show response structure
echo "RESPONSE keys: $(echo "$RESPONSE" | jq -r 'keys | join(", ")' 2>/dev/null)" >> "$DEBUG_LOG"

# Try to extract enforcement from multiple locations:
# 1. Top-level .enforcement (start_team_run, advance_step)
# 2. .instructions.enforcement (get_current_step in agent phase)
ENFORCEMENT=$(echo "$RESPONSE" | jq -r '.enforcement // .instructions.enforcement // empty' 2>/dev/null)
echo "ENFORCEMENT found: $(echo "$ENFORCEMENT" | head -c 200)" >> "$DEBUG_LOG"

if [ -z "$ENFORCEMENT" ] || [ "$ENFORCEMENT" = "null" ]; then
  echo "No enforcement data - nothing to update" >> "$DEBUG_LOG"
  exit 0
fi

# Extract enforcement fields
WORKFLOW_ACTIVE=$(echo "$ENFORCEMENT" | jq -r '.workflowActive // empty' 2>/dev/null)
RUN_ID=$(echo "$RESPONSE" | jq -r '.runId // empty' 2>/dev/null)

# Build currentState from enforcement data
# For get_current_step: enforcement has allowedSubagentTypes, requiredComponentName
# For advance_step/start_team_run: enforcement has currentState object
CURRENT_STATE_JSON=$(echo "$ENFORCEMENT" | jq -r '.currentState // null' 2>/dev/null)

if [ "$CURRENT_STATE_JSON" = "null" ] || [ -z "$CURRENT_STATE_JSON" ]; then
  # Build from get_current_step format
  ALLOWED_TYPES=$(echo "$ENFORCEMENT" | jq -c '.allowedSubagentTypes // null' 2>/dev/null)
  COMPONENT_NAME=$(echo "$ENFORCEMENT" | jq -r '.requiredComponentName // empty' 2>/dev/null)
  STATE_NAME=$(echo "$RESPONSE" | jq -r '.currentState.name // empty' 2>/dev/null)

  if [ -n "$COMPONENT_NAME" ] && [ "$ALLOWED_TYPES" != "null" ]; then
    CURRENT_STATE_JSON=$(jq -n \
      --arg name "$STATE_NAME" \
      --arg comp "$COMPONENT_NAME" \
      --argjson types "$ALLOWED_TYPES" \
      '{name: $name, componentName: $comp, allowedSubagentTypes: $types}')
    WORKFLOW_ACTIVE="true"
  fi
fi

echo "WORKFLOW_ACTIVE=$WORKFLOW_ACTIVE, RUN_ID=$RUN_ID" >> "$DEBUG_LOG"
echo "CURRENT_STATE_JSON=$CURRENT_STATE_JSON" >> "$DEBUG_LOG"

# Only update if we have valid data
if [ "$WORKFLOW_ACTIVE" = "true" ] || [ -n "$RUN_ID" ]; then
  # Default workflow_active to true if we have run_id
  if [ -z "$WORKFLOW_ACTIVE" ]; then
    WORKFLOW_ACTIVE="true"
  fi

  # Build the update
  JQ_RESULT=$(jq --arg sid "$SESSION_ID" \
     --argjson active "$WORKFLOW_ACTIVE" \
     --arg runId "$RUN_ID" \
     --argjson state "$CURRENT_STATE_JSON" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.sessions[$sid] = {
        workflowActive: $active,
        runId: $runId,
        currentState: $state,
        updatedAt: $ts
      }' \
     "$ENFORCEMENT_FILE" 2>&1)

  if [ $? -eq 0 ]; then
    echo "$JQ_RESULT" > "$ENFORCEMENT_FILE.tmp"
    mv "$ENFORCEMENT_FILE.tmp" "$ENFORCEMENT_FILE"
    echo "SUCCESS: Updated enforcement state" >> "$DEBUG_LOG"
  else
    echo "ERROR: jq failed: $JQ_RESULT" >> "$DEBUG_LOG"
  fi
else
  echo "No valid enforcement data to update" >> "$DEBUG_LOG"
fi

exit 0
