#!/bin/bash
# VibeStudio Implementation Hook (ST-177, ST-214)
# Guide Claude to story/team workflow after planning
#
# Triggers: PostToolUse (ExitPlanMode)
# Purpose:
#   Guides Claude to transition from planning to VibeStudio implementation
#   workflow after ExitPlanMode tool is used.
#
#   Key Features (ST-214 Update):
#   1. Reads plan content directly from the .md file
#   2. Instructs Claude to upload as story-scoped artifact (no workflowRunId needed)
#   3. Deletes .md file after successful upload
#   4. Uses storyId for artifact upload (enabled by ST-214)

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

# Check if plan file exists
PLAN_FILE=$(ls -t "$PROJECT_DIR"/.claude/plans/*.md 2>/dev/null | head -1 || echo "")
PLAN_INFO=""

if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
  PLAN_NAME=$(basename "$PLAN_FILE")
  PLAN_INFO="\\n\\n**Plan File Detected**: \`$PLAN_NAME\`\\n\\n**IMPORTANT (ST-214)**: Upload the plan as a story-scoped artifact IMMEDIATELY after creating the story. The plan content is in the file - use \`upload_artifact\` with storyId (not workflowRunId).\\n\\nAfter successful upload, delete the .md file: \`rm $PLAN_FILE\`"
fi

# Inject implementation workflow guidance
cat <<IMPL_EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "toolName": "ExitPlanMode",
    "sessionId": "$SESSION_ID",
    "planFile": "$PLAN_FILE",
    "additionalContext": "## Implementation Phase Started\\n\\nNow that planning is complete, follow the VibeStudio implementation workflow:\\n\\n1. **Create Story**: Use \`create_story\` with the plan summary\\n2. **Upload Plan as Artifact**: Read the plan file and use \`upload_artifact({ storyId, definitionKey: 'THE_PLAN', content })\` - ST-214 enables story-scoped artifacts!\\n3. **Delete .md File**: Run \`rm <plan-file-path>\` to clean up\\n4. **Select Team**: Use \`list_teams\` to show available teams, ask user which to use\\n5. **Start Workflow**: Use \`start_team_run\` with the sessionId and transcriptPath from SessionStart hook\\n6. **Execute**: Run \`get_current_step({ story: 'ST-XXX' })\` - this will guide you through the entire workflow step by step$PLAN_INFO\\n\\n**How get_current_step works:**\\n- Returns a complete \`workflowSequence\` with all MCP tool calls for each phase\\n- Follow pre → agent → post for each state\\n- Call \`advance_step({ story: 'ST-XXX' })\` after completing each phase\\n- Repeat until workflow_complete\\n\\n**You are the PROJECT MANAGER** - orchestrate agents, execute instructions, and ensure the story completes!"
  }
}
IMPL_EOF

exit 0
