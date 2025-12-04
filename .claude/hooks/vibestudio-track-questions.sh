#!/bin/bash
# VibeStudio Track Questions Hook
# Escalate questions to AgentQuestions table via MCP
#
# Triggers: PostToolUse (AskUserQuestion)
# Purpose:
#   1. Create AgentQuestion record in database
#   2. Trigger WebSocket notification for real-time UI
#   3. Enable question visibility in WorkflowExecutionMonitor

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle AskUserQuestion
if [ "$TOOL_NAME" != "AskUserQuestion" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
QUESTIONS=$(echo "$INPUT" | jq -c '.tool_input.questions // []')

# Get current workflow run from running-workflows.json
WORKFLOWS_FILE="$CLAUDE_PROJECT_DIR/.claude/running-workflows.json"
RUN_ID=""

if [ -f "$WORKFLOWS_FILE" ]; then
  RUN_ID=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].runId // empty' "$WORKFLOWS_FILE" 2>/dev/null || echo "")
fi

# Also check .session-workflow file (for compact recovery scenarios)
if [ -z "$RUN_ID" ]; then
  SESSION_WORKFLOW_FILE="$CLAUDE_PROJECT_DIR/.claude/.session-workflow"
  if [ -f "$SESSION_WORKFLOW_FILE" ]; then
    RUN_ID=$(cat "$SESSION_WORKFLOW_FILE" 2>/dev/null | cut -d: -f2 || echo "")
  fi
fi

if [ -n "$RUN_ID" ]; then
  # Call MCP via curl to create AgentQuestion
  # This will trigger WebSocket notification for real-time UI
  curl -s -X POST "http://localhost:3001/api/mcp/call" \
    -H "Content-Type: application/json" \
    -d "{
      \"tool\": \"create_agent_question\",
      \"params\": {
        \"workflowRunId\": \"$RUN_ID\",
        \"sessionId\": \"$SESSION_ID\",
        \"questions\": $QUESTIONS,
        \"source\": \"hook\"
      }
    }" > /dev/null 2>&1 || true
fi

# Also log to local tracking file for debugging
TRACKING_FILE="$CLAUDE_PROJECT_DIR/.claude/pending-questions.json"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

jq -n \
  --arg ts "$TIMESTAMP" \
  --arg sid "$SESSION_ID" \
  --arg rid "$RUN_ID" \
  --argjson qs "$QUESTIONS" \
  '{timestamp: $ts, session_id: $sid, run_id: $rid, questions: $qs}' >> "$TRACKING_FILE" 2>/dev/null || true

exit 0
