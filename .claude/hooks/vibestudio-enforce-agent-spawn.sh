#!/bin/bash
# VibeStudio Enforce Agent Spawn Hook
# Validates Task agent type matches expected workflow component
#
# Triggers: PreToolUse (Task)
# Purpose: Ensure correct agent type is spawned for current workflow state
#
# ST-273: Workflow Execution Enforcement
#
# Exit codes:
#   0 = Allow (hook passes, tool proceeds)
#   2 = Block (hook blocks the tool, CANNOT be bypassed)

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

# Only enforce for Task tool
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

# Determine project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ENFORCEMENT_FILE="$PROJECT_DIR/.claude/.workflow-enforcement.json"

# If no enforcement file, allow
if [ ! -f "$ENFORCEMENT_FILE" ]; then
  exit 0
fi

# Check if this session has an active workflow
WORKFLOW_ACTIVE=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].workflowActive // false' \
  "$ENFORCEMENT_FILE" 2>/dev/null || echo "false")

# If no active workflow, allow any Task spawn
if [ "$WORKFLOW_ACTIVE" != "true" ]; then
  exit 0
fi

# Get allowed subagent types for current state
ALLOWED_TYPES=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].currentState.allowedSubagentTypes // []' \
  "$ENFORCEMENT_FILE" 2>/dev/null)

# If no restrictions, allow
if [ -z "$ALLOWED_TYPES" ] || [ "$ALLOWED_TYPES" = "null" ] || [ "$ALLOWED_TYPES" = "[]" ]; then
  exit 0
fi

# Get the subagent_type from tool input
SUBAGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)

# If no subagent_type provided, allow (Task tool will use default)
if [ -z "$SUBAGENT_TYPE" ]; then
  exit 0
fi

# Check if subagent_type is in allowed list
IS_ALLOWED=$(echo "$ALLOWED_TYPES" | jq -r --arg type "$SUBAGENT_TYPE" \
  'if . | type == "array" then
     if . | map(. == $type) | any then "true" else "false" end
   else "true" end' 2>/dev/null || echo "true")

if [ "$IS_ALLOWED" = "false" ]; then
  # Get state info for error message
  STATE_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.name // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")
  COMPONENT_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.componentName // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")
  ALLOWED_LIST=$(echo "$ALLOWED_TYPES" | jq -r 'join(", ")' 2>/dev/null || echo "unknown")

  # Block the tool - output to BOTH stdout and stderr for visibility
  MSG="BLOCKED: Wrong agent type '${SUBAGENT_TYPE}' for current workflow state.

Current State: ${STATE_NAME}
Expected Component: ${COMPONENT_NAME}
Allowed Agent Types: ${ALLOWED_LIST}
Requested Type: ${SUBAGENT_TYPE}

To proceed:
  Use Task with subagent_type from the allowed list: ${ALLOWED_LIST}"

  echo "$MSG"
  echo "$MSG" >&2
  exit 2
fi

# Allowed - proceed
exit 0
