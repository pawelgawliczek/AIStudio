#!/bin/bash
# VibeStudio Status Line
# Shows: Story # (if in workflow) | Context usage % | Model

set -e

# Read hook input from stdin
INPUT=$(cat)

# Debug: log to temp file to see what we're getting
echo "$INPUT" | jq '{input: .context_window.total_input_tokens, output: .context_window.total_output_tokens, size: .context_window.context_window_size}' >> /tmp/statusline-debug.log 2>/dev/null

# Extract context window info
INPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_output_tokens // 0')
CONTEXT_SIZE=$(echo "$INPUT" | jq -r '.context_window.context_window_size // 200000')
MODEL=$(echo "$INPUT" | jq -r '.model.display_name // "Claude"')

# Calculate context usage percentage
TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS))
if [ "$CONTEXT_SIZE" -gt 0 ]; then
  PERCENT_USED=$((TOTAL_TOKENS * 100 / CONTEXT_SIZE))
else
  PERCENT_USED=0
fi

# Get story key from session-workflow file
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
SESSION_WORKFLOW_FILE="$PROJECT_DIR/.claude/.session-workflow"
STORY_KEY=""

if [ -f "$SESSION_WORKFLOW_FILE" ]; then
  # Format: sessionId:runId:storyKey
  STORY_KEY=$(cut -d: -f3 < "$SESSION_WORKFLOW_FILE" 2>/dev/null || echo "")
fi

# Build status line with ANSI colors
# Colors: \033[36m = cyan, \033[33m = yellow, \033[32m = green, \033[31m = red, \033[0m = reset

# Color code context usage: green <50%, yellow 50-80%, red >80%
if [ "$PERCENT_USED" -lt 50 ]; then
  CTX_COLOR="\033[32m"  # green
elif [ "$PERCENT_USED" -lt 80 ]; then
  CTX_COLOR="\033[33m"  # yellow
else
  CTX_COLOR="\033[31m"  # red
fi

if [ -n "$STORY_KEY" ]; then
  # With story: show story key prominently
  echo -e "\033[36m${STORY_KEY}\033[0m │ ${CTX_COLOR}${PERCENT_USED}%\033[0m ctx │ ${MODEL}"
else
  # No story: just show context and model
  echo -e "${CTX_COLOR}${PERCENT_USED}%\033[0m ctx │ ${MODEL}"
fi
