#!/bin/bash
# VibeStudio Start Workflow Hook (ST-221)
# Update running-workflows.json when a workflow run starts
#
# Triggers: PostToolUse (mcp__vibestudio__start_team_run)
# Purpose:
#   Links the current session to the workflow run by adding
#   runId, workflowId, and storyId to the session entry.
#   This enables the track-agents hook to properly track spawned agents.

# Enable debug logging
DEBUG_LOG="/tmp/start-workflow-hook.log"
exec 2>>"$DEBUG_LOG"
echo "=== Hook started at $(date) ===" >> "$DEBUG_LOG"

# Read hook input from stdin
INPUT=$(cat)
echo "INPUT length: ${#INPUT}" >> "$DEBUG_LOG"

# Validate JSON input
if ! echo "$INPUT" | jq empty 2>/dev/null; then
  echo "ERROR: Invalid JSON input" >> "$DEBUG_LOG"
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
echo "TOOL_NAME: $TOOL_NAME" >> "$DEBUG_LOG"

# Only handle start_team_run
if [ "$TOOL_NAME" != "mcp__vibestudio__start_team_run" ]; then
  echo "Skipping - not start_team_run" >> "$DEBUG_LOG"
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
echo "SESSION_ID: $SESSION_ID" >> "$DEBUG_LOG"
if [ -z "$SESSION_ID" ]; then
  echo "ERROR: No session_id" >> "$DEBUG_LOG"
  exit 0
fi

# Extract workflow run details from tool response
RUN_ID=$(echo "$INPUT" | jq -r '.tool_response.runId // empty')
WORKFLOW_ID=$(echo "$INPUT" | jq -r '.tool_response.workflowId // empty')
STORY_ID=$(echo "$INPUT" | jq -r '.tool_response.context.storyId // empty')
STORY_KEY=$(echo "$INPUT" | jq -r '.tool_response.context.storyKey // .tool_response.story.key // empty')

echo "RUN_ID: $RUN_ID" >> "$DEBUG_LOG"
echo "WORKFLOW_ID: $WORKFLOW_ID" >> "$DEBUG_LOG"
echo "STORY_ID: $STORY_ID" >> "$DEBUG_LOG"
echo "STORY_KEY: $STORY_KEY" >> "$DEBUG_LOG"

if [ -z "$RUN_ID" ]; then
  # No runId in response - might be an error response
  echo "ERROR: No runId in response" >> "$DEBUG_LOG"
  exit 0
fi

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"
SESSION_WORKFLOW_FILE="$PROJECT_DIR/.claude/.session-workflow"

echo "PROJECT_DIR: $PROJECT_DIR" >> "$DEBUG_LOG"
echo "WORKFLOWS_FILE: $WORKFLOWS_FILE" >> "$DEBUG_LOG"

# Ensure .claude directory exists
mkdir -p "$PROJECT_DIR/.claude"

# Ensure workflows file exists and is valid JSON
if [ ! -f "$WORKFLOWS_FILE" ] || ! jq empty "$WORKFLOWS_FILE" 2>/dev/null; then
  echo "Creating new workflows file" >> "$DEBUG_LOG"
  echo '{"currentRunId": null, "sessions": {}}' > "$WORKFLOWS_FILE"
fi

echo "Running jq update..." >> "$DEBUG_LOG"

# Update session entry with workflow run details (with error handling)
JQ_OUTPUT=$(jq --arg sid "$SESSION_ID" \
      --arg rid "$RUN_ID" \
      --arg wid "$WORKFLOW_ID" \
      --arg stid "$STORY_ID" \
      --arg stkey "$STORY_KEY" \
      '.currentRunId = $rid |
       .sessions[$sid] = (.sessions[$sid] // {}) |
       .sessions[$sid].runId = $rid |
       .sessions[$sid].workflowId = $wid |
       .sessions[$sid].storyId = $stid |
       .sessions[$sid].storyKey = $stkey' \
      "$WORKFLOWS_FILE" 2>&1)
JQ_EXIT=$?
echo "JQ exit code: $JQ_EXIT" >> "$DEBUG_LOG"

if [ $JQ_EXIT -eq 0 ]; then
  echo "$JQ_OUTPUT" > "$WORKFLOWS_FILE.tmp"
  mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"
  echo "SUCCESS: Updated workflows file" >> "$DEBUG_LOG"
else
  echo "ERROR: JQ failed: $JQ_OUTPUT" >> "$DEBUG_LOG"
  rm -f "$WORKFLOWS_FILE.tmp"
fi

# Also update .session-workflow for compaction recovery
echo "$SESSION_ID:$RUN_ID:$STORY_KEY" > "$SESSION_WORKFLOW_FILE" 2>/dev/null || true
echo "Updated .session-workflow" >> "$DEBUG_LOG"

# Output hook response with instruction to rename session
if [ -n "$STORY_KEY" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "action": "RENAME_SESSION",
    "storyKey": "$STORY_KEY",
    "runId": "$RUN_ID",
    "instruction": "Use the SlashCommand tool to rename this session to '$STORY_KEY' by calling: /rename $STORY_KEY"
  }
}
EOF
fi

exit 0
