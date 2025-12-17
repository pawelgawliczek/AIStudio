#!/bin/bash
# VibeStudio Enforce No Direct Edit Hook
# Blocks Edit/Write operations for ORCHESTRATOR when workflow is running
# ALLOWS spawned agents to Edit/Write (they're doing actual work)
#
# Triggers: PreToolUse (Edit, Write)
# Purpose: Ensure orchestrator uses Task agents instead of direct edits
#
# ST-273: Workflow Execution Enforcement
# ST-276: Uses .agent-active.json flag (set by enforce-agent-spawn, cleared by track-agents PostToolUse)
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
AGENT_ACTIVE_FILE="$PROJECT_DIR/.claude/.agent-active.json"

# Debug logging
DEBUG_LOG="/tmp/enforce-no-edit-debug.log"

# If no enforcement file, allow
if [ ! -f "$ENFORCEMENT_FILE" ]; then
  echo "$(date): ALLOWING $TOOL_NAME - no enforcement file" >> "$DEBUG_LOG"
  exit 0
fi

# Check if this session has an active workflow
WORKFLOW_ACTIVE=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].workflowActive // false' \
  "$ENFORCEMENT_FILE" 2>/dev/null || echo "false")

if [ "$WORKFLOW_ACTIVE" != "true" ]; then
  echo "$(date): ALLOWING $TOOL_NAME - no active workflow" >> "$DEBUG_LOG"
  exit 0
fi

# ST-276: Check if agent-active flag is set (by enforce-agent-spawn PreToolUse)
if [ -f "$AGENT_ACTIVE_FILE" ]; then
  AGENT_SESSION=$(jq -r '.sessionId // empty' "$AGENT_ACTIVE_FILE" 2>/dev/null)
  if [ "$AGENT_SESSION" = "$SESSION_ID" ]; then
    AGENT_ID=$(jq -r '.agentId // "unknown"' "$AGENT_ACTIVE_FILE" 2>/dev/null)
    echo "$(date): ALLOWING $TOOL_NAME - agent $AGENT_ID active (flag set)" >> "$DEBUG_LOG"
    exit 0
  fi
fi

# Workflow is active but no agent flag - block
STATE_NAME=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].currentState.name // "unknown"' \
  "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")
COMPONENT_NAME=$(jq -r --arg sid "$SESSION_ID" \
  '.sessions[$sid].currentState.componentName // "unknown"' \
  "$ENFORCEMENT_FILE" 2>/dev/null || echo "unknown")

MSG="BLOCKED: Direct ${TOOL_NAME} not allowed during workflow execution.

You are the ORCHESTRATOR. You must use Task agents for all code changes.

Current State: ${STATE_NAME}
Expected Agent: ${COMPONENT_NAME}

To proceed:
  1. Call get_current_step() to get agent spawn instructions
  2. Use Task tool to spawn the ${COMPONENT_NAME} agent
  3. Pass agent output to advance_step()"

echo "$(date): BLOCKING $TOOL_NAME - workflow active, no agent flag" >> "$DEBUG_LOG"
echo "$MSG"
echo "$MSG" >&2
exit 2
