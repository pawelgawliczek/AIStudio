# ST-198: Auto-inject record_agent_start/complete calls - Implementation Plan

## Problem Statement
Currently, users must manually add `record_agent_start` and `record_agent_complete` MCP tool calls to every agent's pre/post execution instructions. This is repetitive boilerplate, error-prone (easy to forget), and clutters the user-facing instructions.

## Current State Analysis

### Docker Runner (Already Has Auto-Injection)
- **File**: `runner/src/runner.ts` lines 790-866
- **Implementation**: Hardcoded calls to `record_agent_start` (line 791) and `record_agent_complete` (line 857)
- **Status**: ✅ WORKING - Auto-injection already implemented

### MasterSession Mode (Problem Area)
- **File**: `backend/src/mcp/servers/runner/get_current_step.ts`
- **Issue**: Lines 448-471 have **documentation** claiming auto-injection, but no actual implementation
- **Current Behavior**: Instructions tell user "auto-injection enabled" but it's just text, no actual injection happens
- **Problem**: MasterSession is a Claude Code session following instructions, not code that can inject calls

## Solution Approach

### Option 1: Clarify Instructions (Documentation Fix)
**Approach**: Update instructions to be honest - MasterSession CANNOT auto-inject because it's just Claude following text
**Changes**:
1. Remove misleading "AUTO-INJECTION" claims from get_current_step.ts
2. Provide clear 4-step workflow for agent phase
3. Document that auto-injection only works in Docker Runner mode

**Pros**: Simple, honest, matches reality
**Cons**: Doesn't solve the boilerplate problem for MasterSession users

### Option 2: Implement Hooks (Real Auto-Injection)
**Approach**: Add PostToolUse hooks for Task tool that automatically call record_agent_start/complete
**Changes**:
1. Create `.claude/hooks/vibestudio-track-agents.sh` hook (may already exist)
2. Hook triggers BEFORE Task tool execution → calls record_agent_start
3. Hook triggers AFTER Task tool completion → calls record_agent_complete
4. Update get_current_step.ts to mention hook-based auto-injection

**Pros**: Actually solves the problem, user doesn't need to do anything
**Cons**: More complex, requires hook infrastructure

### Option 3: Wrapper MCP Tool (Middle Ground)
**Approach**: Create a new MCP tool `spawn_tracked_agent` that wraps Task tool with tracking
**Changes**:
1. New tool: `spawn_tracked_agent({ componentId, prompt, model })`
2. Tool internally calls: record_agent_start → Task → record_agent_complete
3. Update get_current_step.ts to use this new tool instead of raw Task

**Pros**: Clean API, actual auto-injection, no hooks needed
**Cons**: Adds another tool, users must remember to use it instead of Task

## Recommended Solution: Option 2 (Hooks)

**Rationale**:
- Hooks already exist in the project (PostToolUse pattern in .claude/settings.local.json)
- Most transparent - users use normal Task tool, tracking happens automatically
- Aligns with ST-198's goal: "under the hood" automation

## Implementation Tasks

### Phase 1: Investigation
- [x] Analyze current state of Docker Runner auto-injection
- [x] Analyze current state of MasterSession instructions
- [x] Check if Task tool hooks already exist
- [ ] Review existing hook infrastructure (.claude/hooks/)
- [ ] Determine hook trigger points (before/after Task tool)

### Phase 2: Hook Implementation
- [ ] Create/update `.claude/hooks/vibestudio-track-agents.sh`
- [ ] Implement BEFORE Task logic: call record_agent_start MCP tool
- [ ] Implement AFTER Task logic: call record_agent_complete MCP tool
- [ ] Handle error cases (what if record_agent_start fails?)
- [ ] Test hook execution with actual Task tool usage

### Phase 3: Update Instructions
- [ ] Update `get_current_step.ts` to mention hook-based auto-injection
- [ ] Update `master-session-instructions.ts` to clarify hooks handle tracking
- [ ] Remove misleading manual call instructions
- [ ] Add notes explaining how hooks work

### Phase 4: Testing
- [ ] Unit tests: Verify hooks are triggered correctly
- [ ] Integration tests: Test full workflow with hooks
- [ ] E2E tests: Test MasterSession mode with real Task tool calls
- [ ] Verify metrics are recorded correctly

## Files to Modify

1. **backend/src/mcp/servers/runner/get_current_step.ts**
   - Update lines 448-471 (agent phase workflow sequence)
   - Change from "auto-injection" claims to "hook-based tracking"
   - Simplify to single Task spawn step

2. **backend/src/mcp/servers/execution/master-session-instructions.ts**
   - Update lines 99-114 (agent execution sequence)
   - Clarify hooks handle record_agent_start/complete
   - Remove DO NOT manually call warnings (hooks do it)

3. **.claude/hooks/vibestudio-track-agents.sh** (check if exists)
   - Create or update hook script
   - Call record_agent_start before Task
   - Call record_agent_complete after Task
   - Handle errors gracefully

4. **backend/src/mcp/servers/runner/advance_step.ts**
   - May need updates if it currently expects manual calls
   - Review lines 254-297 (agent phase handling)

## Test Files

1. **backend/src/mcp/servers/runner/__tests__/get_current_step.test.ts**
   - Add test: "should not include manual record_agent_start calls in agent phase"
   - Verify workflowSequence has single Task spawn step

2. **backend/src/e2e/ep8-story-runner/st198-auto-injection.e2e.test.ts** (create)
   - Test full workflow with hooks
   - Verify record_agent_start called before Task
   - Verify record_agent_complete called after Task

## Success Criteria

✅ User spawns Task agent via get_current_step instructions
✅ record_agent_start called automatically (via hook) BEFORE Task executes
✅ record_agent_complete called automatically (via hook) AFTER Task completes
✅ advance_step called automatically (via hook) after agent finishes
✅ User does NOT need to manually call any tracking tools
✅ All existing tests pass
✅ New tests verify hook-based auto-injection works

## Progress Tracking

- [ ] Phase 1: Investigation (0/4 tasks)
- [ ] Phase 2: Hook Implementation (0/5 tasks)
- [ ] Phase 3: Update Instructions (0/4 tasks)
- [ ] Phase 4: Testing (0/4 tasks)

**Current Status**: Investigation phase - analyzing solution options

## Notes for Reviewer

- The Docker Runner already has auto-injection (hardcoded in runner.ts)
- MasterSession mode currently has **misleading documentation** claiming auto-injection
- Real solution requires hooks or wrapper tool
- Recommended: Hook-based approach for transparency
