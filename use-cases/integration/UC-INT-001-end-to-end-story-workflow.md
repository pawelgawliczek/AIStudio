# UC-INT-001: End-to-End Story Workflow (User's Default Use Case)

## Overview
This use case describes the complete workflow that the user described as their default scenario:
> "user works either via Claude Code CLI or via webinterface on stories and plan → user asks claude code to implement first story → all of the updates on project telemetry, agents efficiency are being saved automatically"

## Actors
- PM (via Web UI)
- BA (via Web UI or Claude Code)
- Architect (via Web UI or Claude Code)
- Developer (Agent via Claude Code)
- QA (Agent or human via Claude Code/Web UI)
- System (MCP Server, Metrics collectors)

## Preconditions
- Project is bootstrapped (UC-ADMIN-001)
- Framework is configured and active (UC-ADMIN-002)
- MCP server is running
- Web UI is accessible at https://studio.example.com/

## Main Flow

### Phase 1: Planning (PM via Web UI)

1. PM logs into Web UI at https://studio.example.com/
2. PM navigates to project → Tracker tab
3. PM creates epic: "User Authentication System"
4. PM creates story:
   - Title: "Implement password reset flow"
   - Type: Feature
   - Description: "Users should be able to reset their password via email"
   - Sets complexity estimates:
     - Business Impact: 4
     - Business Complexity: 3
     - Technical Complexity: 3
     - Estimated Token Cost: Medium
5. PM assigns story to "BA+Arch+Dev+QA" framework
6. Story status: "planning" → "assigned"
7. System automatically saves telemetry:
   - `log_run` called for PM action
   - Audit log updated
   - Metrics start tracking

### Phase 2: BA Analysis (BA via Web UI or Claude Code)

8. BA receives notification: "ST-42 assigned for analysis"
9. BA reviews story in Web UI or Claude Code
10. BA performs analysis (UC-BA-001):
    - Links existing use cases (UC-LOGIN-001, UC-USER-PROFILE-003)
    - Creates new use case (UC-PASSWORD-RESET-001)
    - Defines business rules
    - Refines acceptance criteria
11. BA saves analysis
12. Story status: "assigned" → "analysis_complete"
13. System automatically:
    - Updates use case library
    - Versions use cases
    - Logs BA token usage: `log_run({ story_id, agent_id: ba_agent, tokens_input: 5K, tokens_output: 3K })`
    - Notifies Architect

### Phase 3: Architecture Assessment (Architect via Web UI or Claude Code)

14. Architect receives notification: "ST-42 ready for architecture review"
15. Architect reviews BA analysis
16. Architect calls MCP tool: `get_architect_insights({ project_id })`
17. System returns code quality metrics for auth module
18. Architect performs assessment (UC-ARCH-001):
    - Sets technical complexity: 3
    - Identifies components: backend/auth, frontend/forms, email-service
    - Creates 4 subtasks:
      - Backend API endpoint
      - Email template
      - Frontend form
      - Tests
    - Documents architectural approach
19. Architect saves assessment
20. Story status: "analysis_complete" → "architecture_complete"
21. System automatically:
    - Logs Architect token usage
    - Updates story with subtasks
    - Notifies PM and framework that story is ready for implementation

### Phase 4: Implementation (Developer Agent via Claude Code)

**User starts work session:**

22. Developer opens Claude Code in repository
23. Developer asks: **"Show my assigned work"**
24. Claude Code skill activates, calls MCP: `get_changes({ project_id, since_cursor })`
25. System returns:
    ```
    📋 New Assignment: ST-42: Implement password reset flow
    - Type: feature, Priority: 4, Complexity: 3
    - Components: backend/auth, frontend/forms, email-service
    - 4 subtasks available
    - Token budget: 50k
    ```
26. Developer asks: **"Implement the first subtask"**
27. Claude Code:
    - Calls MCP: `log_run({ story_id: ST-42, subtask_id: backend-api, started_at: now })`
    - Reads story details, BA analysis, architecture assessment
    - Reviews linked use cases
    - Implements backend API endpoint
    - Writes tests
    - Runs tests locally
28. All tests pass
29. Developer creates commit: `[ST-42] Add password reset API endpoint`
30. Git hook triggers, calls MCP: `link_commit({ commit_hash, story_id: ST-42 })`
31. Claude Code calls MCP: `update_subtask({ subtask_id: backend-api, status: "done" })`
32. Claude Code calls MCP: `log_run({ run_id, finished_at: now, tokens_input: 12K, tokens_output: 8K, success: true, iterations: 8 })`
33. System automatically:
    - Links commit to story
    - Updates subtask status
    - Records metrics: tokens, duration, iterations
    - Updates story progress (1/4 subtasks done)

34. Developer repeats for remaining subtasks (steps 26-33)
35. After all subtasks complete, story status: "impl" → "review"

### Phase 5: QA Testing (QA Agent or Human via Claude Code)

36. QA receives notification: "ST-42 ready for testing"
37. QA reviews story via Claude Code or Web UI
38. QA calls MCP: `get_impacted_tests({ files: [...] })`
39. System returns test cases and coverage report
40. QA executes tests (UC-QA-001):
    - Runs automated tests
    - Verifies acceptance criteria
    - Checks test coverage (85% - meets threshold)
    - Performs manual testing for edge cases
41. All tests pass, acceptance criteria met
42. QA calls MCP: `update_story({ story_id: ST-42, status: "done" })`
43. QA calls MCP: `log_run({ story_id: ST-42, agent_id: qa_agent, success: true, tokens: 4K })`
44. Story status: "review" → "done"

### Phase 6: Automatic Telemetry & Metrics Updates (System Background)

Throughout the entire workflow, system automatically:

45. **Collects metrics:**
    - All `log_run` calls → runs table
    - All commits → commits table with LOC analysis
    - All status changes → audit_log
    - All use case updates → use_case_versions

46. **Processes in background:**
    - Code quality analysis workers scan new commits
    - Calculate complexity deltas
    - Update test coverage metrics
    - Analyze code churn
    - Detect hotspots

47. **Aggregates metrics:**
    - Nightly job aggregates run data by framework, agent, complexity
    - Calculates framework effectiveness KPIs
    - Updates dashboard metrics
    - Generates alerts for anomalies

48. **Updates dashboards in real-time:**
    - Web UI shows story moving through statuses (WebSocket updates)
    - "Agent Effectiveness" tab updates with new data points
    - "Tracker" tab shows ST-42 in "Done" column
    - Project dashboard shows velocity update

### Phase 7: PM Reviews Results (PM via Web UI)

49. PM opens Web UI → Agent Effectiveness tab
50. PM sees updated metrics for "BA+Arch+Dev+QA" framework:
    - ST-42 completed in 6 hours
    - Total tokens: 35K (within budget)
    - 16 iterations
    - 0 defects
    - Test coverage: 85%
    - Code quality: maintained
51. PM can compare with "Dev-only" framework on similar complexity stories
52. PM uses insights to decide on framework for next stories

## Postconditions
- Story is complete and deployed
- All metrics are automatically captured
- Dashboards are updated in real-time
- PM has visibility into framework effectiveness
- No manual metric entry required
- Team can analyze and improve processes

## Success Metrics
- **Zero manual metric entry** - everything automatic
- **Real-time visibility** - dashboards update within 5 seconds
- **Complete traceability** - story → subtasks → commits → use cases → metrics
- **Actionable insights** - PM can make data-driven framework decisions

## Key Automation Points

### 1. Automatic Telemetry Collection
- Every agent action calls `log_run` automatically
- Git hooks automatically link commits
- Status changes automatically logged
- No user intervention required

### 2. Background Code Analysis
- Workers process commits asynchronously
- Developers never blocked by analysis
- Metrics always up-to-date

### 3. Real-time Dashboard Updates
- WebSocket connections to Web UI
- Changes appear within seconds
- No page refresh needed

### 4. Intelligent Workflow Routing
- Framework automatically routes story through phases
- Agents know when their turn comes
- Escalations happen automatically

## Related Use Cases
- UC-PM-003: Create Story
- UC-BA-001: Analyze Story Requirements
- UC-ARCH-001: Assess Technical Complexity
- UC-DEV-001: Pull Assigned Stories
- UC-DEV-002: Implement Story
- UC-QA-001: Test Story Implementation
- UC-METRICS-001: View Framework Effectiveness
- UC-METRICS-002: View Project Tracker

## Technical Flow Diagram

```
PM (Web UI)
    ↓ Create story, assign to framework
MCP Server
    ↓ Notify BA
BA Agent (Claude Code / Web UI)
    ↓ Analyze, link use cases, log_run
MCP Server
    ↓ Save analysis, notify Architect
Architect Agent (Claude Code / Web UI)
    ↓ Assess complexity, create subtasks, log_run
MCP Server
    ↓ Update story, notify framework
Dev Agent (Claude Code)
    ↓ Pull work: get_changes
    ↓ Implement: log_run(start)
    ↓ Commit: [ST-42] message
Git Hook
    ↓ link_commit
Dev Agent
    ↓ Complete: log_run(finish), update_subtask
MCP Server
    ↓ Trigger QA phase
QA Agent (Claude Code)
    ↓ Test, verify, log_run
    ↓ Approve: update_story(done)
MCP Server
    ↓ Store metrics
Background Workers
    ↓ Analyze code, calculate metrics
    ↓ Aggregate data
Metrics DB
    ↓ Query
Web UI Dashboards
    ↓ Display (WebSocket)
PM/Architect/Users
```

## Acceptance Criteria
- Complete story workflow requires ZERO manual metric entry
- All telemetry is captured automatically
- Dashboards update in real-time (< 5 second latency)
- Agent Effectiveness tab shows accurate framework comparison
- Tracker tab shows accurate real-time story status
- PM can drill down into any metric to see source data
- Framework effectiveness is comparable across complexity bands
- System handles concurrent agents working on different stories
- No data loss during failures (all logged in transactions)
