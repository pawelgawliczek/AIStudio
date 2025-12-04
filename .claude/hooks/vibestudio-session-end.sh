#!/bin/bash
# VibeStudio Session End Hook
# Finalize transcripts and mark session complete
#
# Triggers: SessionEnd
# Purpose:
#   1. Mark session as ended in running-workflows.json
#   2. Ensure final transcript_path is recorded
#   3. Record end reason for debugging

set -e

# Read hook input from stdin
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"')

WORKFLOWS_FILE="$CLAUDE_PROJECT_DIR/.claude/running-workflows.json"

if [ -f "$WORKFLOWS_FILE" ]; then
  # Mark session as ended and ensure transcript is recorded
  jq --arg sid "$SESSION_ID" \
     --arg tp "$TRANSCRIPT_PATH" \
     --arg reason "$REASON" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     'if .sessions[$sid] then
        .sessions[$sid].endedAt = $ts |
        .sessions[$sid].endReason = $reason |
        .sessions[$sid].masterTranscripts = ((.sessions[$sid].masterTranscripts // []) + [$tp] | unique)
      else . end' \
     "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"
fi

exit 0
