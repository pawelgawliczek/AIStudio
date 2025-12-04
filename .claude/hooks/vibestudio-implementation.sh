#!/bin/bash
# VibeStudio Implementation Hook
# Guide Claude to story/team workflow after planning
#
# Triggers: PostToolUse (ExitPlanMode)
# Purpose:
#   1. Inject implementation workflow guidance
#   2. Detect plan file for auto-upload
#   3. Guide Claude to create story and use team

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
    "additionalContext": "## Implementation Phase Started\\n\\nNow that planning is complete, follow the VibeStudio implementation workflow:\\n\\n1. **Create Story**: Use \`create_story\` with the plan summary\\n2. **Create Worktree**: Use \`git_create_worktree\` for the story\\n3. **Select Team**: Use \`list_teams\` to show available teams, ask user which to use\\n4. **Upload Plan Artifact**: Store the plan as an artifact using \`upload_artifact\`\\n5. **Execute**: Use \`execute_story_with_team\` to start team execution\\n\\nAsk the user which team they want to use for implementation.$PLAN_INFO"
  }
}
IMPL_EOF

exit 0
