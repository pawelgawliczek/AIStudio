#!/bin/bash
# Test Suite for vibestudio-enforce-agent-spawn.sh
# ST-276: Additional Edge Case Testing

set -e

PROJECT_DIR="/Users/pawelgawliczek/projects/AIStudio"
HOOK_SCRIPT="$PROJECT_DIR/.claude/hooks/vibestudio-enforce-agent-spawn.sh"
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
  local check_flag="${6:-false}"

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
  local test_passed=true
  if [ $ACTUAL_EXIT -ne $expected_exit ]; then
    test_passed=false
  fi

  # Check if agent-active flag was created when expected
  if [ "$check_flag" = "true" ] && [ $expected_exit -eq 0 ]; then
    if [ ! -f "$AGENT_ACTIVE_FILE" ]; then
      echo -e "${YELLOW}WARNING: Agent-active flag was not created${NC}"
      test_passed=false
    fi
  fi

  if [ "$test_passed" = true ]; then
    echo -e "${GREEN}PASS${NC}"
    echo "Actual exit code: $ACTUAL_EXIT"
    if [ "$check_flag" = "true" ] && [ -f "$AGENT_ACTIVE_FILE" ]; then
      echo "Agent-active flag created: Yes"
    fi
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAIL${NC}"
    echo "Expected exit code: $expected_exit"
    echo "Actual exit code: $ACTUAL_EXIT"
    echo "Output: $OUTPUT"
    if [ "$check_flag" = "true" ]; then
      echo "Agent-active flag exists: $([ -f "$AGENT_ACTIVE_FILE" ] && echo Yes || echo No)"
    fi
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

setup_workflow_active_no_restrictions() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Pre-Planning",
        "componentName": "None",
        "allowedSubagentTypes": []
      }
    }
  }
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

setup_workflow_active_with_restrictions() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Implementation",
        "componentName": "Implementer",
        "allowedSubagentTypes": ["coder", "implementation"]
      }
    }
  }
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

setup_malformed_enforcement() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": "not a boolean",
      "currentState": "not an object"
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

setup_null_allowed_types() {
  cat > "$ENFORCEMENT_FILE" <<EOF
{
  "sessions": {
    "test-session-123": {
      "workflowActive": true,
      "currentState": {
        "name": "Planning",
        "componentName": "PM",
        "allowedSubagentTypes": null
      }
    }
  }
}
EOF
  rm -f "$AGENT_ACTIVE_FILE"
}

# Test cases
echo "========================================"
echo "Testing vibestudio-enforce-agent-spawn.sh"
echo "========================================"

# Group 1: Tool Variations
run_test \
  "Task_With_Allowed_Type_Coder" \
  "Task with allowed subagent_type 'coder' should be allowed" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"coder","prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "true"

run_test \
  "Task_With_Allowed_Type_Implementation" \
  "Task with allowed subagent_type 'implementation' should be allowed" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"implementation","prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "true"

run_test \
  "Task_With_Disallowed_Type" \
  "Task with disallowed subagent_type 'explorer' should be blocked" \
  2 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"explorer","prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "false"

run_test \
  "Task_Without_Subagent_Type" \
  "Task without subagent_type should be allowed (defaults)" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "true"

run_test \
  "Non_Task_Tool" \
  "Non-Task tools should always be allowed" \
  0 \
  '{"tool_name":"Bash","session_id":"test-session-123","tool_input":{"command":"ls"}}' \
  "setup_workflow_active_with_restrictions" \
  "false"

# Group 2: Error Handling
run_test \
  "Missing_Enforcement_File" \
  "Should allow when enforcement file doesn't exist" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"coder","prompt":"test"}}' \
  "setup_no_enforcement" \
  "false"

run_test \
  "Malformed_Enforcement_File" \
  "Should handle malformed JSON gracefully (allow on jq errors)" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"coder","prompt":"test"}}' \
  "setup_malformed_enforcement" \
  "false"

run_test \
  "Empty_Sessions_Object" \
  "Should allow when sessions object is empty" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"coder","prompt":"test"}}' \
  "setup_empty_sessions" \
  "false"

run_test \
  "Null_Allowed_Types" \
  "Should allow when allowedSubagentTypes is null" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"coder","prompt":"test"}}' \
  "setup_null_allowed_types" \
  "true"

# Group 3: Multi-Phase
run_test \
  "Workflow_Inactive" \
  "Should allow any Task when workflow is not active" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"explorer","prompt":"test"}}' \
  "setup_workflow_inactive" \
  "false"

run_test \
  "No_Restrictions_Phase" \
  "Should allow any Task type when no restrictions set" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"anything","prompt":"test"}}' \
  "setup_workflow_active_no_restrictions" \
  "true"

# Edge cases with various subagent_type values
run_test \
  "Task_With_Empty_Subagent_Type" \
  "Task with empty string subagent_type should be allowed" \
  0 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":"","prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "true"

run_test \
  "Task_With_Numeric_Subagent_Type" \
  "Task with numeric subagent_type should be blocked (wrong type)" \
  2 \
  '{"tool_name":"Task","session_id":"test-session-123","tool_input":{"subagent_type":123,"prompt":"test"}}' \
  "setup_workflow_active_with_restrictions" \
  "false"

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
