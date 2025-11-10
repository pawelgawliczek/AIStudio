# UC-PM-004: Assign Story to Agentic Framework

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated
- Story exists with status "planning" or later
- Story has complexity fields filled (business_impact, business_complexity, technical_complexity)
- At least one active agentic framework exists in the project

## Main Flow
1. PM opens story detail view
2. PM clicks "Assignment" tab
3. System displays available frameworks filtered by project
4. PM reviews framework capabilities:
   - Framework name and description
   - Included agents (BA, Architect, Dev, QA)
   - Historical performance metrics for similar complexity
5. PM selects target framework from dropdown
6. PM optionally sets constraints:
   - Maximum token budget
   - Deadline
   - Quality gates required
7. PM clicks "Assign to Framework"
8. System validates:
   - Framework is active
   - Story has required complexity fields
   - Estimated token cost is set
9. System creates assignment record
10. System updates story status to "assigned"
11. System triggers notification to framework (if MCP client is listening)
12. System displays confirmation with estimated metrics
13. Story appears in framework's work queue

## Postconditions
- Story is assigned to framework
- Assignment record exists with timestamp
- Story is visible in framework's backlog in Claude Code/Codex
- Audit log records assignment
- Framework can now work on story via MCP tools

## Alternative Flows

### 8a. Missing complexity fields
- At step 8, system detects missing required fields
- System displays error: "Story must have complexity assessment before assignment"
- System highlights missing fields
- PM returns to UC-PM-003 to complete complexity

### 8b. Framework inactive
- At step 8, system detects framework is deactivated
- System shows error with list of active alternatives
- PM returns to step 5

### 6a. Set advanced constraints
- At step 6, PM clicks "Advanced Constraints"
- System shows additional options:
  - Specific agent restrictions
  - Code review requirements
  - Test coverage thresholds
- PM configures and proceeds to step 7

## Business Rules
- Only stories with status >= "planning" can be assigned
- Complexity fields are mandatory before assignment
- Only active frameworks can receive assignments
- One story can be assigned to only one framework at a time
- Assignment can be changed before work starts (status < "impl")

## Related Use Cases
- UC-PM-003: Create Story
- UC-ADMIN-003: Manage Agentic Frameworks
- UC-DEV-001: Pull Assigned Stories
- UC-METRICS-002: View Framework Performance

## Acceptance Criteria
- Story is successfully assigned to framework
- Framework receives notification via MCP
- Assignment constraints are enforced during execution
- PM can view assignment history
- Metrics tracking begins upon assignment
