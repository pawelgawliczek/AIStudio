#!/bin/bash
# VibeStudio Status Line
# Shows: Story # (if in workflow) | Context usage % | Model

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract context window info using current_usage (more accurate than cumulative totals)
CONTEXT_SIZE=$(echo "$INPUT" | jq -r '.context_window.context_window_size // 200000')
MODEL=$(echo "$INPUT" | jq -r '.model.display_name // "Claude"')

# Use current_usage for accurate context percentage (added in v2.0.70)
CURRENT_USAGE=$(echo "$INPUT" | jq '.context_window.current_usage // null')

if [ "$CURRENT_USAGE" != "null" ]; then
  # current_usage includes: input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
  INPUT_TOKENS=$(echo "$CURRENT_USAGE" | jq -r '.input_tokens // 0')
  CACHE_CREATE=$(echo "$CURRENT_USAGE" | jq -r '.cache_creation_input_tokens // 0')
  CACHE_READ=$(echo "$CURRENT_USAGE" | jq -r '.cache_read_input_tokens // 0')
  TOTAL_TOKENS=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))
else
  # Fallback to cumulative totals if current_usage not available
  INPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_input_tokens // 0')
  OUTPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_output_tokens // 0')
  TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS))
fi

# Calculate context usage percentage
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
