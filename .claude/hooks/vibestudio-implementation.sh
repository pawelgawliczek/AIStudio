#!/bin/bash
# VibeStudio Implementation Hook
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
#      - If found, reminds Claude to upload it as PLAN artifact (requires workflow)
#   2. Injects implementation workflow:
#      - Creates story with create_story
#      - Lists teams with list_teams and asks user which to use
#      - Uploads plan artifact with upload_artifact
#      - Executes with execute_story_with_team

set -e

# Read hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only handle ExitPlanMode
if [ "$TOOL_NAME" != "ExitPlanMode" ]; then
  exit 0
fi

# Check if plan file exists
PLAN_FILE=$(ls -t "$CLAUDE_PROJECT_DIR"/.claude/plans/*.md 2>/dev/null | head -1 || echo "")
PLAN_INFO=""

if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
  PLAN_NAME=$(basename "$PLAN_FILE")
  PLAN_INFO="\\n\\n**Plan File Found**: \`$PLAN_NAME\`\\nUpload this as PLAN artifact when creating the story using \`upload_artifact\`."
fi

# Inject implementation workflow guidance
cat <<IMPL_EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "## Implementation Phase Started\\n\\nNow that planning is complete, follow the VibeStudio implementation workflow:\\n\\n1. **Create Story**: Use \`create_story\` with the plan summary\\n2. **Select Team**: Use \`list_teams\` to show available teams, ask user which to use\\n3. **Upload Plan Artifact**: Store the plan as an artifact using \`upload_artifact\`\\n4. **Execute**: Use \`execute_story_with_team\` to start team execution and orchestrate the execution\\n\\nAsk the user which team they want to use for implementation.$PLAN_INFO"
  }
}
IMPL_EOF

exit 0
