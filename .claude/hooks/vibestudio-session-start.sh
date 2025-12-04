#!/bin/bash
# VibeStudio Session Start Hook
# Prime context + track transcript paths for master session
#
# Triggers: SessionStart (startup, resume, compact)
# Purpose:
#   1. Track transcript_path in running-workflows.json
#   2. On compact: append NEW transcript to masterTranscripts[]
#   3. Prime Claude with VibeStudio workflow awareness

set -e

# Read hook input from stdin
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
SOURCE=$(echo "$INPUT" | jq -r '.source // "startup"')

# ST-172: Fallback to PWD if CLAUDE_PROJECT_DIR not set (happens during compaction)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
WORKFLOWS_FILE="$PROJECT_DIR/.claude/running-workflows.json"
SESSION_WORKFLOW_FILE="$PROJECT_DIR/.claude/.session-workflow"

# Ensure workflows file exists
if [ ! -f "$WORKFLOWS_FILE" ]; then
  echo '{"currentRunId": null, "sessions": {}}' > "$WORKFLOWS_FILE"
fi

# Track transcript path based on source
if [ "$SOURCE" = "compact" ]; then
  # COMPACT: Append new transcript to existing session's masterTranscripts
  SAVED=$(cat "$SESSION_WORKFLOW_FILE" 2>/dev/null || echo "")
  OLD_SID=$(echo "$SAVED" | cut -d: -f1)
  RUN_ID=$(echo "$SAVED" | cut -d: -f2)

  if [ -n "$RUN_ID" ] && [ -n "$OLD_SID" ]; then
    # Update local JSON first (for local fallback/debugging)
    jq --arg tp "$TRANSCRIPT_PATH" \
       --arg sid "$OLD_SID" \
       'if .sessions[$sid] then
          .sessions[$sid].masterTranscripts = ((.sessions[$sid].masterTranscripts // []) + [$tp] | unique)
        else . end' \
       "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

    # ST-172: Transcript path stored in local JSON
    # The orchestrator should call add_transcript MCP tool after compaction recovery
    # to persist the new transcript path to the database
    # (Hooks can't easily call MCP API due to session requirements)

    # Update session-workflow with new session ID (same runId)
    echo "$SESSION_ID:$RUN_ID" > "$SESSION_WORKFLOW_FILE"

    # Output compaction notice (shown to user via stderr)
    echo "CONTEXT COMPACTED - Workflow run: $RUN_ID" >&2
    echo "Added transcript: $TRANSCRIPT_PATH" >&2
    echo "Run: /orchestrate $RUN_ID to restore context" >&2
  fi
else
  # STARTUP/RESUME: Register transcript for potential workflow
  # (Will be linked to runId when start_team_run is called)
  jq --arg sid "$SESSION_ID" \
     --arg tp "$TRANSCRIPT_PATH" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.sessions[$sid] = (.sessions[$sid] // {}) |
      .sessions[$sid].masterTranscripts = ((.sessions[$sid].masterTranscripts // []) + [$tp] | unique) |
      .sessions[$sid].startedAt = (.sessions[$sid].startedAt // $ts)' \
     "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"
fi

# Prime context for ALL sessions (startup, resume, compact)
# This injects VibeStudio workflow awareness into Claude's context
# IMPORTANT: Use EOF (not 'EOF') to enable variable expansion for session identity

# ST-172: For compact, include explicit action for orchestrator to call add_transcript
if [ "$SOURCE" = "compact" ] && [ -n "$RUN_ID" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart:compact",
    "sessionId": "$SESSION_ID",
    "transcriptPath": "$TRANSCRIPT_PATH",
    "compactionInfo": {
      "runId": "$RUN_ID",
      "previousSessionId": "$OLD_SID",
      "newTranscriptPath": "$TRANSCRIPT_PATH"
    },
    "action": "ORCHESTRATOR: Context was compacted. Call add_transcript({ type: 'master', runId: '$RUN_ID', transcriptPath: '$TRANSCRIPT_PATH' }) to register the new transcript, then call get_orchestration_context({ runId: '$RUN_ID' }) to restore workflow state.",
    "additionalContext": "## Context Compaction Recovery\\n\\n**Your Session ID**: \`$SESSION_ID\`\\n**Your Transcript**: \`$TRANSCRIPT_PATH\`\\n**Workflow Run**: \`$RUN_ID\`\\n\\n⚠️ **Context was compacted.** You are the MasterSession orchestrator. Call \`add_transcript\` to register this transcript, then \`get_orchestration_context\` to restore your workflow state."
  }
}
EOF
else
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "sessionId": "$SESSION_ID",
    "transcriptPath": "$TRANSCRIPT_PATH",
    "additionalContext": "## VibeStudio Development Workflow\\n\\n**Your Session ID**: \`$SESSION_ID\`\\n**Your Transcript**: \`$TRANSCRIPT_PATH\`\\n\\nThis project uses VibeStudio for structured development. When implementing features or making code changes:\\n\\n1. **Create a Story** - Use \`create_story\` MCP tool to track the work\\n2. **Create Worktree** - Use \`git_create_worktree\` for isolated development\\n3. **Assign Team** - Select appropriate team for execution\\n4. **Upload Artifacts** - Store analysis/design in artifacts for the workflow\\n5. **Execute with Team** - Let the team's agents handle implementation\\n\\nAvailable MCP tools: list_projects, list_teams, create_story, git_create_worktree, upload_artifact, execute_story_with_team\\n\\nWhen user requests implementation after planning, automatically transition to this workflow."
  }
}
EOF
fi

exit 0
