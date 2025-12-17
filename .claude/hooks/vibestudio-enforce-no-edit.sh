#!/bin/bash
# VibeStudio Enforce No Direct Edit Hook
# Blocks Edit/Write operations for ORCHESTRATOR when workflow is running
# ALLOWS spawned agents to Edit/Write (they're doing actual work)
#
# Triggers: PreToolUse (Edit, Write)
# Purpose: Ensure orchestrator uses Task agents instead of direct edits
#
# ST-273: Workflow Execution Enforcement
# ST-276: Fixed - use running-workflows.json to distinguish orchestrator from spawned agents
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
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"
ENFORCEMENT_FILE="$PROJECT_DIR/.claude/.workflow-enforcement.json"

# If no workflows file, allow (no way to determine if orchestrator)
if [ ! -f "$WORKFLOWS_FILE" ]; then
  exit 0
fi

# ST-276: Check if this session is the ORCHESTRATOR
# Orchestrator sessions have runId in running-workflows.json
# Spawned agents have different session IDs not registered there
IS_ORCHESTRATOR=$(jq -r --arg sid "$SESSION_ID" '
  .sessions[$sid].runId != null
' "$WORKFLOWS_FILE" 2>/dev/null || echo "false")

# DEBUG: Log session info to understand spawned agent behavior
echo "$(date): TOOL=$TOOL_NAME SESSION_ID=$SESSION_ID IS_ORCHESTRATOR=$IS_ORCHESTRATOR" >> /tmp/enforce-no-edit-debug.log

# If NOT orchestrator (spawned agent), ALWAYS allow Edit/Write
if [ "$IS_ORCHESTRATOR" != "true" ]; then
  exit 0
fi

# This IS the orchestrator - check if workflow is active
if [ ! -f "$ENFORCEMENT_FILE" ]; then
  exit 0
fi

WORKFLOW_ACTIVE=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].workflowActive // false' \
  "$ENFORCEMENT_FILE" 2>/dev/null || echo "false")

if [ "$WORKFLOW_ACTIVE" = "true" ]; then
  # Get current state info for error message
  STATE_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.name // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")
  COMPONENT_NAME=$(jq -r --arg sid "$SESSION_ID" \
    '.sessions[$sid].currentState.componentName // "unknown"' \
    "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")

  # Block the orchestrator from direct edits
  MSG="BLOCKED: Direct ${TOOL_NAME} not allowed during workflow execution.

You are the ORCHESTRATOR. You must use Task agents for all code changes.

Current State: ${STATE_NAME}
Expected Agent: ${COMPONENT_NAME}

To proceed:
  1. Call get_current_step() to get agent spawn instructions
  2. Use Task tool to spawn the ${COMPONENT_NAME} agent
  3. Pass agent output to advance_step()"

  echo "$MSG"
  echo "$MSG" >&2
  exit 2
fi

# No active workflow - allow
exit 0
