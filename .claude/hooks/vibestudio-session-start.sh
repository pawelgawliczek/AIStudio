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

# ST-190: Cleanup old sessions (older than 30 days with endedAt set)
# This prevents the file from growing unbounded
# macOS uses -v, Linux uses -d for date arithmetic
CUTOFF=$(date -u -v-30d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
if [ -n "$CUTOFF" ]; then
  jq --arg cutoff "$CUTOFF" '
    .sessions |= with_entries(
      select(
        # Keep if: no endedAt (active) OR startedAt > cutoff (recent)
        .value.endedAt == null or
        (.value.startedAt // "9999") > $cutoff
      )
    )
  ' "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" 2>/dev/null && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE" || true
fi

# Track transcript path based on source
if [ "$SOURCE" = "compact" ]; then
  # COMPACT: Append new transcript to existing session's masterTranscripts
  # ST-190: Now reads sessionId:runId:storyKey format
  SAVED=$(cat "$SESSION_WORKFLOW_FILE" 2>/dev/null || echo "")
  OLD_SID=$(echo "$SAVED" | cut -d: -f1)
  RUN_ID=$(echo "$SAVED" | cut -d: -f2)
  STORY_KEY=$(echo "$SAVED" | cut -d: -f3)

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

    # Update session-workflow with new session ID (same runId, preserve storyKey)
    echo "$SESSION_ID:$RUN_ID:$STORY_KEY" > "$SESSION_WORKFLOW_FILE"

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
# ST-190: Extract story key for better UX - prefer .session-workflow, fallback to running-workflows.json
if [ "$SOURCE" = "compact" ] && [ -n "$RUN_ID" ]; then
  # STORY_KEY already extracted from .session-workflow (line 52)
  # Fallback to running-workflows.json if not in .session-workflow (backward compatibility)
  if [ -z "$STORY_KEY" ]; then
    # Try storyKey first (human-readable like "ST-123")
    STORY_KEY=$(jq -r --arg sid "$OLD_SID" '.sessions[$sid].storyKey // empty' "$WORKFLOWS_FILE" 2>/dev/null)
    # Fall back to storyId (UUID) if storyKey not set - get_current_step accepts both
    if [ -z "$STORY_KEY" ]; then
      STORY_KEY=$(jq -r --arg sid "$OLD_SID" '.sessions[$sid].storyId // empty' "$WORKFLOWS_FILE" 2>/dev/null)
    fi
  fi

  # Build story param - prefer story key, fall back to runId
  if [ -n "$STORY_KEY" ]; then
    STORY_PARAM="story: '$STORY_KEY'"
  else
    STORY_PARAM="runId: '$RUN_ID'"
  fi

  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "source": "compact",
    "sessionId": "$SESSION_ID",
    "transcriptPath": "$TRANSCRIPT_PATH",
    "compactionInfo": {
      "runId": "$RUN_ID",
      "storyKey": "$STORY_KEY",
      "previousSessionId": "$OLD_SID",
      "newTranscriptPath": "$TRANSCRIPT_PATH"
    },
    "action": "Context compacted. Call get_orchestration_context({ $STORY_PARAM, sessionId: '$SESSION_ID', transcriptPath: '$TRANSCRIPT_PATH' }) then get_current_step({ $STORY_PARAM }) to continue.",
    "additionalContext": "## Context Compaction Recovery\\n\\n**Your Session ID**: \\\`$SESSION_ID\\\`\\n**Your Transcript**: \\\`$TRANSCRIPT_PATH\\\`\\n**Story**: \\\`${STORY_KEY:-$RUN_ID}\\\`\\n**Workflow Run**: \\\`$RUN_ID\\\`\\n\\n⚠️ **Context was compacted.** You are still the **PROJECT MANAGER** orchestrating this story's development.\\n\\n**Your mission remains unchanged**: Complete the story workflow by guiding agents through each phase.\\n\\n**Recovery Steps:**\\n1. Call \\\`get_orchestration_context({ $STORY_PARAM, sessionId: '$SESSION_ID', transcriptPath: '$TRANSCRIPT_PATH' })\\\`\\n2. Call \\\`get_current_step({ $STORY_PARAM })\\\` to get next instructions\\n3. Continue following the \\\`workflowSequence\\\` until story is complete\\n\\n**Remember**: You orchestrate agents, execute pre/post instructions, and call \\\`advance_step\\\` after each phase."
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
    "additionalContext": "## VibeStudio Development Workflow\\n\\n**Your Session ID**: \\\`$SESSION_ID\\\`\\n**Your Transcript**: \\\`$TRANSCRIPT_PATH\\\`\\n\\nYou are acting as a **PROJECT MANAGER** in this session. Your role is to help the user deliver software by orchestrating agents and actions.\\n\\n### Default Workflow (Manual Orchestration)\\n\\nUse \\\`get_current_step({ story: 'ST-XXX' })\\\` to get exact instructions for the current phase. This tool tells you:\\n- What state you're in (analysis, implementation, review, etc.)\\n- What phase (pre, agent, post)\\n- Complete MCP tool calls to execute\\n\\n**Typical Flow:**\\n1. User provides story (ST-123) or asks to implement something\\n2. Call \\\`get_current_step({ story: 'ST-123' })\\\`\\n3. Follow the \\\`workflowSequence\\\` - it has ALL the steps\\n4. After completing, call \\\`advance_step({ story: 'ST-123' })\\\`\\n5. Repeat until workflow_complete\\n\\n### Starting a New Workflow\\n\\nIf no active run exists for the story:\\n1. Use \\\`list_teams\\\` to show available teams\\n2. Use \\\`start_team_run\\\` with sessionId and transcriptPath from this hook\\n3. Call \\\`get_current_step\\\` to get first step instructions\\n\\n### Key MCP Tools\\n- \\\`get_current_step\\\` - Get exact instructions for current step\\n- \\\`advance_step\\\` - Move to next phase/state\\n- \\\`repeat_step\\\` - Retry with feedback\\n- \\\`list_teams\\\` - List available teams/workflows\\n- \\\`start_team_run\\\` - Start a new workflow run"
  }
}
EOF
fi

exit 0
