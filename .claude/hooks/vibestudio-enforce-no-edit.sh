#!/bin/bash
# VibeStudio Enforce No Direct Edit Hook
# Blocks Edit/Write operations when workflow is running
#
# Triggers: PreToolUse (Edit, Write)
# Purpose: Ensure orchestrator uses Task agents instead of direct edits
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

if [ "$WORKFLOW_ACTIVE" = "true" ]; then
  # Get current state info for better error message
  STATE_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.name // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")
  COMPONENT_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.componentName // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")

  # Block the tool - exit code 2 is deterministic block
  echo "BLOCKED: Direct ${TOOL_NAME} not allowed during workflow execution."
  echo ""
  echo "You are the ORCHESTRATOR. You must use Task agents for all code changes."
  echo ""
  echo "Current State: ${STATE_NAME}"
  echo "Expected Agent: ${COMPONENT_NAME}"
  echo ""
  echo "To proceed:"
  echo "  1. Call get_current_step() to get agent spawn instructions"
  echo "  2. Use Task tool to spawn the ${COMPONENT_NAME} agent"
  echo "  3. Pass agent output to advance_step()"
  exit 2
fi

# No active workflow - allow
exit 0
