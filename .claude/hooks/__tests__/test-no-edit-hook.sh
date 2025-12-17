#!/bin/bash
# Test Suite for vibestudio-enforce-no-edit.sh
# ST-276: Additional Edge Case Testing

set -e

PROJECT_DIR="/Users/pawelgawliczek/projects/AIStudio"
HOOK_SCRIPT="$PROJECT_DIR/.claude/hooks/vibestudio-enforce-no-edit.sh"
ENFORCEMENT_FILE="$PROJECT_DIR/.claude/.workflow-enforcement.json"
AGENT_ACTIVE_FILE="$PROJECT_DIR/.claude/.agent-active.json"
TEMP_ENFORCEMENT="/tmp/test-enforcement-$$.json"
TEMP_AGENT_FLAG="/tmp/test-agent-flag-$$.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test result tracking
declare -a FAILED_TESTS

run_test() {
  local test_name="$1"
  local test_description="$2"
  local expected_exit="$3"
  local hook_input="$4"
  local setup_func="$5"

  TESTS_RUN=$((TESTS_RUN + 1))

  echo ""
  echo "========================================="
  echo "Test $TESTS_RUN: $test_name"
  echo "Description: $test_description"
  echo "Expected: Exit code $expected_exit"
  echo "========================================="

  # Run setup if provided
  if [ -n "$setup_func" ]; then
    $setup_func
  fi

  # Run the hook with input
  set +e
  OUTPUT=$(echo "$hook_input" | CLAUDE_PROJECT_DIR="$PROJECT_DIR" "$HOOK_SCRIPT" 2>&1)
  ACTUAL_EXIT=$?
  set -e

  # Check result
  if [ $ACTUAL_EXIT -eq $expected_exit ]; then
    echo -e "${GREEN}PASS${NC}"
    echo "Actual exit code: $ACTUAL_EXIT"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAIL${NC}"
    echo "Expected exit code: $expected_exit"
    echo "Actual exit code: $ACTUAL_EXIT"
    echo "Output: $OUTPUT"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("$test_name")
  fi

  # Cleanup
  rm -f "$TEMP_ENFORCEMENT" "$TEMP_AGENT_FLAG"
  rm -f "$ENFORCEMENT_FILE" "$AGENT_ACTIVE_FILE"
}

# Setup functions
setup_no_enforcement() {
  rm -f "$ENFORCEMENT_FILE"
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_workflow_active_no_agent() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Implementation",
        "componentName": "Implementer"
      }
    }
  }
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_workflow_active_with_agent_flag() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Implementation",
        "componentName": "Implementer"
      }
    }
  }
}
EOF
  cat > "$AGENT_ACTIVE_FILE" <<EOF
{
  "sessionId": "test-session-123",
  "activatedAt": "2025-12-17T12:00:00Z"
}
EOF
}

setup_malformed_enforcement() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": "this should be boolean not string"
    }
  }
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_empty_sessions() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {}
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_workflow_inactive() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": false
    }
  }
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_wrong_session_in_flag() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Implementation",
        "componentName": "Implementer"
      }
    }
  }
}
EOF
  cat > "$AGENT_ACTIVE_FILE" <<EOF
{
  "sessionId": "different-session-456",
  "activatedAt": "2025-12-17T12:00:00Z"
}
EOF
}

# Test cases
echo "========================================"
echo "Testing vibestudio-enforce-no-edit.sh"
echo "========================================"

# Group 1: Tool Variations
run_test \
  "Write_Tool_During_Workflow" \
  "Write tool should be blocked when workflow active and no agent flag" \
  2 \
  '{"tool_name":"Write","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_workflow_active_no_agent"

run_test \
  "Edit_Tool_During_Workflow" \
  "Edit tool should be blocked when workflow active and no agent flag" \
  2 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_workflow_active_no_agent"

run_test \
  "Write_Tool_With_Agent_Flag" \
  "Write tool should be allowed when agent flag is set" \
  0 \
  '{"tool_name":"Write","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_workflow_active_with_agent_flag"

run_test \
  "Edit_Tool_With_Agent_Flag" \
  "Edit tool should be allowed when agent flag is set" \
  0 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_workflow_active_with_agent_flag"

# Group 2: Error Handling
run_test \
  "Missing_Enforcement_File" \
  "Should allow when enforcement file doesn't exist" \
  0 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_no_enforcement"

run_test \
  "Malformed_Enforcement_File" \
  "Should handle malformed JSON gracefully (allow on jq errors)" \
  0 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_malformed_enforcement"

run_test \
  "Empty_Sessions_Object" \
  "Should allow when sessions object is empty" \
  0 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_empty_sessions"

# Group 3: Multi-Phase
run_test \
  "Workflow_Inactive" \
  "Should allow when workflow is not active" \
  0 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_workflow_inactive"

run_test \
  "Agent_Flag_Wrong_Session" \
  "Should block when agent flag is for different session" \
  2 \
  '{"tool_name":"Edit","session_id":"test-session-123","tool_input":{"file_path":"test.ts"}}' \
  "setup_wrong_session_in_flag"

# Summary
echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo "Total Tests: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  ${RED}- $test${NC}"
  done
  exit 1
else
  echo ""
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
