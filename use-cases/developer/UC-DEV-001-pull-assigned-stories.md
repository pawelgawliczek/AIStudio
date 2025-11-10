# UC-DEV-001: Pull Assigned Stories (Agent/Developer via MCP)

## Actor
Developer Agent (via Claude Code, Codex) or Human Developer

## Preconditions
- Agent/Developer is authenticated via MCP
- Project is bootstrapped with `.ai-studio/config.json` containing `project_id`
- Agent framework is active and has assigned stories
- MCP server is accessible

## Main Flow
1. Developer/Agent starts work session (e.g., launches Claude Code in repo)
2. Agent/Developer issues command: "Show my assigned work" or uses MCP tool directly
3. System calls MCP tool: `get_changes({ project_id, since_cursor })`
4. MCP server returns delta since last sync:
   - New stories assigned to this framework
   - Updated stories (priority changes, requirement updates)
   - Deleted/unassigned stories
   - Updated architecture guidance
   - New constraints or quality gates
5. System displays sync summary:
   ```
   📋 Project Sync - 3 changes since last session

   New Assignments:
   - ST-42: Add password reset flow [Priority: 4, Complexity: 3]
   - ST-43: Fix user profile image upload bug [Priority: 5, Complexity: 2]

   Updates:
   - ST-40: Login timeout - Priority increased to 5, deadline moved to 2025-11-15

   Suggest syncing local context? (y/n)
   ```
6. Agent/Developer confirms sync
7. System calls MCP tool: `list_subtasks({ story_id })` for each new story
8. For each story, system retrieves:
   - Full story details (title, description, acceptance criteria)
   - BA analysis (linked use cases, business rules)
   - Architecture assessment (technical approach, affected components)
   - Subtasks (if decomposed)
   - Constraints (token budget, quality gates, deadline)
9. System updates local context files (e.g., `.claude/context/current-work.md`)
10. System displays actionable work list:
    ```
    🎯 Ready to implement:
    1. ST-42: Add password reset flow
       - Type: feature, Complexity: 3
       - Components: backend/auth, frontend/forms, email service
       - 4 subtasks: API endpoint, email template, UI form, tests
       - Token budget: 50k

    2. ST-43: Fix user profile image upload bug
       - Type: bug, Priority: 5, Complexity: 2
       - Files likely involved: upload-service.ts, user-profile.tsx
       - No subtasks

    Which story would you like to work on?
    ```

## Postconditions
- Agent/Developer has current work context
- Local files updated with latest story details
- Cursor updated so next sync only fetches new changes
- Agent/Developer can start implementation
- No redundant or stale work in queue

## Alternative Flows

### 4a. No changes since last sync
- At step 4, MCP returns empty delta
- System displays: "✅ No new work. All stories up to date."
- Agent/Developer can:
  - Continue work on in-progress story
  - Request additional work
  - View all assigned backlog

### 4b. Story unassigned or moved to different framework
- At step 4, MCP returns story removal
- System displays: "⚠️ ST-39 has been reassigned to another framework"
- System removes story from local queue
- If work was in progress, system prompts:
  - "Save current work as WIP commit? (y/n)"
  - If yes, creates commit with [WIP] prefix

### 8a. Story has blocking dependencies
- At step 8, story has dependency on incomplete story
- System flags: "⏸️ ST-42 blocked by ST-40 (in progress)"
- Story appears in queue but marked as blocked
- Agent/Developer can choose to work on unblocked stories first

### 9a. Auto-select highest priority story
- At step 9, if only one unblocked story exists
- System auto-suggests: "Starting work on ST-43 (highest priority, unblocked)"
- Agent/Developer can accept or choose different story

## Business Rules
- Sync occurs at session start and can be manually triggered
- Cursor persists in `.ai-studio/sync-cursor.json`
- Only stories with status >= "impl" and assigned to current framework appear
- Stories are sorted by: blockers (blocked last), priority (high first), complexity (simple first)
- Token budget and quality gates are mandatory constraints

## Technical Implementation
- MCP tool `get_changes` uses event sourcing or timestamp-based delta
- Local context files in `.claude/context/` or `.codex/context/`
- Integration with Claude Code skills to auto-display work queue
- Sync cursor format: `{ "timestamp": "2025-11-10T10:00:00Z", "last_event_id": 12345 }`

## Related Use Cases
- UC-DEV-002: Implement Story
- UC-DEV-003: Link Commit to Story
- UC-PM-004: Assign Story to Framework
- UC-INTEGRATION-001: Bootstrap Project

## Acceptance Criteria
- Sync completes within 2 seconds
- Delta is accurate (no missed or duplicate changes)
- Local context files are properly updated
- Work queue is sorted correctly by priority and blockers
- Blocking dependencies are clearly indicated
- Agent/Developer can immediately start work on presented stories
- Sync cursor persists correctly across sessions
