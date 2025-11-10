# UC-DEV-002: Implement Story

## Actor
Developer Agent (via Claude Code, Codex) or Human Developer

## Preconditions
- Story is assigned to agent/developer's framework
- Story has status "impl" or "in_progress"
- Story context is loaded (see UC-DEV-001)
- Repository is on correct branch
- Agent/Developer has reviewed:
  - Story description and acceptance criteria
  - BA analysis (use cases, business rules)
  - Architecture assessment (technical approach)
  - Subtasks (if decomposed)

## Main Flow
1. Agent/Developer selects story to implement
2. System calls MCP tool: `log_run({ project_id, story_id, agent_id, framework_id, tokens_input: 0, started_at: now })`
   - Creates run record to track this implementation session
   - Returns `run_id` for ongoing logging
3. Agent/Developer reviews implementation context:
   - Reads linked use cases for behavior requirements
   - Reviews architecture assessment for technical approach
   - Checks affected components and files
   - Reviews code quality constraints (if any)
4. If story has subtasks:
   - Agent selects first subtask matching their role/layer
   - Example: Dev-agent selects backend subtask
   - Updates subtask status to "in_progress" via MCP: `update_subtask({ subtask_id, status: "in_progress" })`
5. Agent/Developer implements code:
   - Writes/modifies code files
   - Follows architecture guidance
   - Implements according to use case specifications
   - Adds tests per acceptance criteria
   - Runs local tests
6. During implementation, system tracks:
   - Tokens consumed (input + output)
   - Iterations (number of prompts/edits)
   - Files modified
   - Duration
7. Agent/Developer completes implementation:
   - All acceptance criteria addressed
   - Tests pass locally
   - Code follows quality standards
8. Agent/Developer creates commit(s):
   - Commit message includes story ID: `[ST-42] Add password reset flow`
   - Or branch name includes story ID: `feature/ST-42-password-reset`
   - Follows project commit conventions
9. System calls MCP tool: `link_commit({ commit_hash, story_id })`
   - Links commit to story in database
   - Records: author, timestamp, LOC changes, files touched
10. If subtask: Agent calls MCP: `update_subtask({ subtask_id, status: "done" })`
11. If all subtasks done: Agent calls MCP: `update_story({ story_id, status: "review" })`
12. Agent logs completion: `log_run({ run_id, finished_at: now, success: true, tokens_input, tokens_output, iterations })`
13. System updates story status
14. System triggers notification to next phase (QA or review)
15. Agent/Developer moves to next story or subtask

## Postconditions
- Code is implemented and committed
- Commits are linked to story
- Story status updated to "review" or subtask marked "done"
- Run metrics are recorded (tokens, time, iterations)
- Audit log records implementation activity
- Next phase actor is notified

## Alternative Flows

### 5a. Implementation blocked by technical issue
- At step 5, agent encounters blocker (unclear requirements, technical limitation)
- Agent calls MCP: `update_story({ story_id, status: "blocked", blocked_reason: "..." })`
- Agent logs run with success: false, error_type: "blocked"
- System notifies Architect or PM
- Story flagged for human review

### 5b. Architecture change needed mid-implementation
- At step 5, agent realizes architecture assessment is insufficient
- Agent creates comment/note via MCP: `add_story_comment({ story_id, comment, author: agent_id })`
- Agent escalates to Architect
- Waits for updated guidance or proceeds with best judgment

### 8a. Commit message missing story ID
- At step 8, developer forgets story ID in commit
- Git hook or CI check detects missing story link
- Rejects commit with error: "Commit must reference story ID"
- Developer amends commit message

### 12a. Implementation failed
- At step 12, agent could not complete implementation
- Agent logs: `log_run({ run_id, success: false, error_type: "requirements_unclear" | "technical_limitation" | "timeout" })`
- System updates story status to "blocked"
- PM/Architect notified for intervention

### 4a. No subtasks - implement as whole
- Story has no subtask decomposition
- Agent implements entire story as single unit
- Skips subtask status updates
- Proceeds directly to step 11

## Business Rules
- Every commit must link to a story (enforced by git hook or CI)
- Commit message format: `[STORY-ID] Description` or branch name: `feature/STORY-ID-slug`
- Run tracking is mandatory for all agent work
- Token usage must be logged for cost analysis
- Story status workflow: impl → review → qa → done
- Subtask status independent of parent story status

## Technical Implementation
- Git hooks (pre-commit or commit-msg) validate story ID presence
- MCP tools handle all state updates
- Run records capture:
  ```json
  {
    "run_id": "uuid",
    "project_id": "uuid",
    "story_id": "uuid",
    "subtask_id": "uuid",
    "agent_id": "uuid",
    "framework_id": "uuid",
    "started_at": "2025-11-10T10:00:00Z",
    "finished_at": "2025-11-10T10:45:00Z",
    "tokens_input": 15000,
    "tokens_output": 8000,
    "iterations": 12,
    "success": true,
    "metadata": { "files_modified": 4, "tests_added": 3 }
  }
  ```

## Related Use Cases
- UC-DEV-001: Pull Assigned Stories
- UC-DEV-003: Link Commit to Story
- UC-QA-001: Review and Test Story
- UC-ARCH-001: Assess Technical Complexity
- UC-METRICS-001: View Framework Effectiveness

## Acceptance Criteria
- Story is implemented according to all acceptance criteria
- All commits are properly linked to story
- Run metrics are accurately logged
- Subtask tracking works correctly
- Story status updates propagate correctly
- Tests pass before marking complete
- Token usage is tracked for all agent interactions
- Blocked stories are properly escalated
- Notifications trigger to next phase actors
