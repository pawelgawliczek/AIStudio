#!/bin/bash
# VibeStudio Implementation Hook (ST-177)
# Guide Claude to story/team workflow after planning
#
# Triggers: PostToolUse (ExitPlanMode)
# Purpose:
#   Guides Claude to transition from planning to VibeStudio implementation
#   workflow after ExitPlanMode tool is used.
#
#   Key Features:
#   1. Auto-detects plan file:
#      - Looks for most recent .md file in .claude/plans/
#      - If found, instructs Claude to upload it using upload_artifact_from_file
#   2. Auto-detects workflow context:
#      - Gets workflowRunId from running-workflows.json if available
#   3. Injects implementation workflow:
#      - Creates story with create_story
#      - Lists teams with list_teams and asks user which to use
#      - Uploads plan artifact with upload_artifact_from_file (NEW - ST-177)
#      - Executes with execute_story_with_team

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Only handle ExitPlanMode
if [ "$TOOL_NAME" != "ExitPlanMode" ]; then
  exit 0
fi

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"

# Check if plan file exists
PLAN_FILE=$(ls -t "$PROJECT_DIR"/.claude/plans/*.md 2>/dev/null | head -1 || echo "")
PLAN_INFO=""
UPLOAD_INSTRUCTION=""

# Get workflowRunId from running-workflows.json if available
WORKFLOW_RUN_ID=""
if [ -f "$WORKFLOWS_FILE" ] && [ -n "$SESSION_ID" ]; then
  WORKFLOW_RUN_ID=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].runId // empty' "$WORKFLOWS_FILE" 2>/dev/null || echo "")
fi

if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
  PLAN_NAME=$(basename "$PLAN_FILE")

  if [ -n "$WORKFLOW_RUN_ID" ]; then
    # Workflow run already exists - give exact MCP tool call
    PLAN_INFO="\\n\\n**Plan File Detected**: \`$PLAN_NAME\` at \`$PLAN_FILE\`\\n**Workflow Run ID**: \`$WORKFLOW_RUN_ID\`"
    UPLOAD_INSTRUCTION="\\n\\n**ACTION REQUIRED**: Automatically upload the plan file using the new \`upload_artifact_from_file\` MCP tool:\\n\\n\`\`\`typescript\\nmcp__vibestudio__upload_artifact_from_file({\\n  filePath: \\\"$PLAN_FILE\\\",\\n  workflowRunId: \\\"$WORKFLOW_RUN_ID\\\",\\n  definitionKey: \\\"THE_PLAN\\\"\\n})\\n\`\`\`\\n\\nThis will read the file from your laptop and upload it to the database with zero token overhead!"
  else
    # No workflow run yet - instruct to upload after starting workflow
    PLAN_INFO="\\n\\n**Plan File Detected**: \`$PLAN_NAME\` at \`$PLAN_FILE\`"
    UPLOAD_INSTRUCTION="\\n\\nAfter starting the workflow run (via \`execute_story_with_team\`), upload the plan file using:\\n\\n\`\`\`typescript\\nmcp__vibestudio__upload_artifact_from_file({\\n  filePath: \\\"$PLAN_FILE\\\",\\n  workflowRunId: \\\"<run-id-from-execute_story_with_team>\\\",\\n  definitionKey: \\\"THE_PLAN\\\"\\n})\\n\`\`\`"
  fi
fi

# Inject implementation workflow guidance
cat <<IMPL_EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "toolName": "ExitPlanMode",
    "sessionId": "$SESSION_ID",
    "workflowRunId": "$WORKFLOW_RUN_ID",
    "planFile": "$PLAN_FILE",
    "additionalContext": "## Implementation Phase Started\\n\\nNow that planning is complete, follow the VibeStudio implementation workflow:\\n\\n1. **Create Story**: Use \`create_story\` with the plan summary\\n2. **Select Team**: Use \`list_teams\` to show available teams, ask user which to use\\n3. **Start Workflow**: Use \`start_team_run\` with the sessionId and transcriptPath from SessionStart hook\\n4. **Execute**: Run \`get_current_step({ story: 'ST-XXX' })\` - this will guide you through the entire workflow step by step\\n\\n$PLAN_INFO\\n\\n**How get_current_step works:**\\n- Returns a complete \`workflowSequence\` with all MCP tool calls for each phase\\n- Follow pre → agent → post for each state\\n- Call \`advance_step({ story: 'ST-XXX' })\` after completing each phase\\n- Repeat until workflow_complete\\n\\n**You are the PROJECT MANAGER** - orchestrate agents, execute instructions, and ensure the story completes!"
  }
}
IMPL_EOF

exit 0
