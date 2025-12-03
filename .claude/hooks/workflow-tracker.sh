#!/bin/bash
# Workflow Tracker Helper
# Manages .claude/running-workflows.json for multi-workflow tracking
#
# Usage:
#   workflow-tracker.sh register <runId> <workflowId> [storyId] [sessionId]
#   workflow-tracker.sh unregister <runId>
#   workflow-tracker.sh set-current <runId>
#   workflow-tracker.sh get-current
#   workflow-tracker.sh list

WORKFLOWS_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/running-workflows.json"

# Ensure file exists
if [ ! -f "$WORKFLOWS_FILE" ]; then
    echo '{"currentRunId": null, "sessions": {}}' > "$WORKFLOWS_FILE"
fi

case "$1" in
    register)
        RUN_ID="$2"
        WORKFLOW_ID="$3"
        STORY_ID="${4:-null}"
        SESSION_ID_ARG="$5"

        if [ -z "$RUN_ID" ] || [ -z "$WORKFLOW_ID" ]; then
            echo "Usage: workflow-tracker.sh register <runId> <workflowId> [storyId] [sessionId]"
            exit 1
        fi

        # Auto-detect Claude session from transcripts if not provided
        if [ -z "$SESSION_ID_ARG" ]; then
            TRANSCRIPT_DIR="$HOME/.claude/projects"
            SESSION_ID=""

            if [ -d "$TRANSCRIPT_DIR" ]; then
                # Find transcripts - exclude agent-* (spawned subagents)
                # Use stat to get proper modification time sorting (xargs ls -t doesn't sort across batches)
                RECENT_TRANSCRIPTS=$(find "$TRANSCRIPT_DIR" -name "*.jsonl" ! -name "agent-*.jsonl" -type f -mmin -60 -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -50 | cut -d' ' -f2-)

                for transcript in $RECENT_TRANSCRIPTS; do
                    # Look for the session that STARTED this workflow (called start_team_run)
                    # Must have BOTH: the actual MCP tool call AND our workflowId
                    # Tool call format: "name":"mcp__vibestudio__start_team_run"
                    if grep -q '"name":"mcp__vibestudio__start_team_run"' "$transcript" 2>/dev/null; then
                        if grep -q "$WORKFLOW_ID" "$transcript" 2>/dev/null; then
                            SESSION_ID=$(basename "$transcript" .jsonl)
                            echo "Auto-detected Master Session (has start_team_run call + workflowId): $SESSION_ID"
                            break
                        fi
                    fi
                done

                # If not found in recent, expand search to last 24 hours
                if [ -z "$SESSION_ID" ]; then
                    echo "Not found in last 60 min, expanding search to 24 hours..."
                    ALL_TRANSCRIPTS=$(find "$TRANSCRIPT_DIR" -name "*.jsonl" ! -name "agent-*.jsonl" -type f -mmin -1440 -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -100 | cut -d' ' -f2-)

                    for transcript in $ALL_TRANSCRIPTS; do
                        if grep -q '"name":"mcp__vibestudio__start_team_run"' "$transcript" 2>/dev/null; then
                            if grep -q "$WORKFLOW_ID" "$transcript" 2>/dev/null; then
                                SESSION_ID=$(basename "$transcript" .jsonl)
                                echo "Auto-detected Master Session from expanded search: $SESSION_ID"
                                break
                            fi
                        fi
                    done
                fi
            fi

            # Report error if not found - don't generate random UUID
            if [ -z "$SESSION_ID" ]; then
                echo "WARNING: No transcript found with start_team_run call for workflowId=$WORKFLOW_ID"
                echo "Context recovery will not work for this workflow run."
                echo "Searched transcripts modified in last 60 minutes in: $TRANSCRIPT_DIR"
                # Use runId as session key so we can still track the workflow
                # but context recovery won't work
                SESSION_ID="no-transcript-$RUN_ID"
            fi
        else
            SESSION_ID="$SESSION_ID_ARG"
        fi

        # Update JSON file
        jq --arg runId "$RUN_ID" \
           --arg workflowId "$WORKFLOW_ID" \
           --arg storyId "$STORY_ID" \
           --arg sessionId "$SESSION_ID" \
           --arg startedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
           '.currentRunId = $runId | .sessions[$sessionId] = {
               runId: $runId,
               workflowId: $workflowId,
               storyId: (if $storyId == "null" then null else $storyId end),
               startedAt: $startedAt
           }' "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

        echo "Registered workflow run: $RUN_ID"
        ;;

    unregister)
        RUN_ID="$2"

        if [ -z "$RUN_ID" ]; then
            echo "Usage: workflow-tracker.sh unregister <runId>"
            exit 1
        fi

        # Remove sessions with this runId and clear currentRunId if it matches
        jq --arg runId "$RUN_ID" '
            .sessions = (.sessions | to_entries | map(select(.value.runId != $runId)) | from_entries) |
            if .currentRunId == $runId then .currentRunId = null else . end
        ' "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

        echo "Unregistered workflow run: $RUN_ID"
        ;;

    set-current)
        RUN_ID="$2"

        if [ -z "$RUN_ID" ]; then
            echo "Usage: workflow-tracker.sh set-current <runId>"
            exit 1
        fi

        jq --arg runId "$RUN_ID" '.currentRunId = $runId' "$WORKFLOWS_FILE" > "$WORKFLOWS_FILE.tmp" && mv "$WORKFLOWS_FILE.tmp" "$WORKFLOWS_FILE"

        echo "Current workflow run set to: $RUN_ID"
        ;;

    get-current)
        jq -r '.currentRunId // empty' "$WORKFLOWS_FILE"
        ;;

    list)
        echo "=== Running Workflows ==="
        echo "Current: $(jq -r '.currentRunId // "none"' "$WORKFLOWS_FILE")"
        echo ""
        jq -r '.sessions | to_entries[] | "Session: \(.key)\n  Run ID: \(.value.runId)\n  Workflow: \(.value.workflowId)\n  Story: \(.value.storyId // "none")\n  Started: \(.value.startedAt)\n"' "$WORKFLOWS_FILE"
        ;;

    *)
        echo "Workflow Tracker - Manages running workflow sessions"
        echo ""
        echo "Usage:"
        echo "  workflow-tracker.sh register <runId> <workflowId> [storyId] [sessionId]"
        echo "  workflow-tracker.sh unregister <runId>"
        echo "  workflow-tracker.sh set-current <runId>"
        echo "  workflow-tracker.sh get-current"
        echo "  workflow-tracker.sh list"
        exit 1
        ;;
esac
