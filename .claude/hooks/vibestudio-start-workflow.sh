#!/bin/bash
# VibeStudio Start Workflow Hook (ST-221)
# Update running-workflows.json when a workflow run starts
#
# Triggers: PostToolUse (mcp__vibestudio__start_team_run)
# Purpose:
#   Links the current session to the workflow run by adding
#   runId, workflowId, and storyId to the session entry.
#   This enables the track-agents hook to properly track spawned agents.

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle start_team_run
if [ "$TOOL_NAME" != "mcp__vibestudio__start_team_run" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Extract workflow run details from tool response
RUN_ID=$(echo "$INPUT" | jq -r '.tool_response.runId // empty')
WORKFLOW_ID=$(echo "$INPUT" | jq -r '.tool_response.workflowId // empty')
STORY_ID=$(echo "$INPUT" | jq -r '.tool_response.context.storyId // empty')
STORY_KEY=$(echo "$INPUT" | jq -r '.tool_response.context.storyKey // .tool_response.story.key // empty')

if [ -z "$RUN_ID" ]; then
  # No runId in response - might be an error response
  exit 0
fi

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"
SESSION_WORKFLOW_FILE="$PROJECT_DIR/.claude/.session-workflow"

# Ensure workflows file exists
if [ ! -f "$WORKFLOWS_FILE" ]; then
  echo '{"currentRunId": null, "sessions": {}}' > "$WORKFLOWS_FILE"
fi

# Update session entry with workflow run details
jq --arg sid "$SESSION_ID" \
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
   "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

# Also update .session-workflow for compaction recovery
echo "$SESSION_ID:$RUN_ID:$STORY_KEY" > "$SESSION_WORKFLOW_FILE"

exit 0
