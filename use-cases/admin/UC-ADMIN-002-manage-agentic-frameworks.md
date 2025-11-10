# UC-ADMIN-002: Manage Agentic Frameworks

## Actor
Admin, Architect, PM (with permissions)

## Preconditions
- User is authenticated with framework management permissions
- Project exists

## Main Flow
1. User navigates to "Agent Studio" in Web UI
2. System displays Framework Management dashboard:
   - List of existing frameworks (global and project-specific)
   - Active/inactive status
   - Framework performance summary
   - "Create Framework" button

3. User clicks "Create Framework" or "Edit Framework"
4. System displays Framework Configuration UI with sections:

   **A. Basic Info**
   - Framework name (e.g., "BA+Arch+Dev+QA", "Dev-only", "Full Stack AI")
   - Description
   - Scope: Global (available to all projects) or Project-specific
   - Status: Active / Inactive

   **B. Agent Composition** (Visual builder)
   - Select agents to include:
     ```
     [x] Business Analyst
         - Role: Requirements analysis, use case management
         - System prompt: [Edit custom prompt]
         - Tools: [list_use_cases, create_use_case, link_use_case, ...]
         - Constraints: [Max tokens, quality gates]

     [x] Architect
         - Role: Technical assessment, design guidance
         - System prompt: [Edit custom prompt]
         - Tools: [get_architect_insights, analyze_dependencies, ...]
         - Constraints: [Max complexity threshold]

     [x] Developer
         - Role: Code implementation
         - System prompt: [Edit custom prompt]
         - Tools: [read_file, write_file, run_tests, ...]
         - Constraints: [Code quality gates, test coverage]

     [x] QA Tester
         - Role: Testing and validation
         - System prompt: [Edit custom prompt]
         - Tools: [run_tests, report_defect, get_coverage, ...]
         - Constraints: [Min coverage threshold]
     ```

   **C. Workflow Routing**
   - Define workflow sequence:
     ```
     Story created
       ↓
     [BA] Analyze requirements
       ↓ (if complexity > 2)
     [Architect] Assess technical approach
       ↓
     [Developer] Implement
       ↓
     [QA] Test and validate
       ↓
     Done
     ```
   - Conditional routing rules:
     - If complexity ≤ 2: skip Architect
     - If type = "bug": skip BA, go straight to Dev
     - If critical defect: notify human immediately

   **D. Agent Configuration**
   For each agent, configure:
   - System prompt (base + project-specific additions)
   - Available MCP tools (whitelist)
   - Token budget per story
   - Quality gates and constraints
   - Escalation rules (when to involve human)
   - Safety rules (what agent cannot do)

   **E. Framework Policies**
   - Max parallel stories per framework instance
   - Token budget limits (per story, per day, per month)
   - Auto-escalation triggers:
     - Story blocked for > X hours
     - Token usage exceeds Y%
     - Multiple failures on same story
   - Code review requirements:
     - Human review required for complexity ≥ 4
     - Architect approval for architectural changes

   **F. Target Complexity Bands**
   - Recommended for: Low (1-2) | Medium (3) | High (4-5) | All
   - Based on historical performance

5. User configures each section
6. User saves framework configuration
7. System validates:
   - At least one Developer agent (required)
   - Workflow sequence is valid (no cycles)
   - Tool permissions are valid
   - Token budgets are reasonable
8. System calls MCP tool: `create_framework({ name, config, scope, project_id })`
   or `update_framework({ framework_id, config })`
9. System saves framework configuration
10. If framework is active, system generates host-specific config:
    - For Claude Code: `.claude/agents/` files
    - For Codex: their equivalent
    - Includes all prompts, tools, constraints
11. System displays success message
12. Framework available for assignment to stories

## Postconditions
- Framework is created/updated in database
- Framework appears in framework list
- Framework can be assigned to stories
- Host-specific config files generated (if active)
- Audit log records framework changes
- Metrics tracking configured for framework

## Alternative Flows

### 3a. Clone existing framework
- At step 3, user clicks "Clone" on existing framework
- System creates copy with "-Copy" suffix
- User can modify clone
- Useful for creating variations

### 3b. Use framework template
- At step 3, user selects "Create from Template"
- System shows common templates:
  - "Dev-only" (single Developer agent)
  - "BA+Dev" (requirements + implementation)
  - "Full Pipeline" (BA+Arch+Dev+QA)
  - "Bug Fix Fast" (Dev+QA only)
  - "Architecture Heavy" (BA+Arch+Arch-Review+Dev+QA)
- User selects template, system pre-fills configuration

### 7a. Invalid workflow configuration
- At step 7, system detects workflow issue:
  - Circular dependency
  - Missing required agent (Developer)
  - Tool permission conflict
- System displays specific error
- User returns to step 5 to fix

### 10a. Export framework as code
- At step 10, user clicks "Export as JSON"
- System generates framework definition:
  ```json
  {
    "name": "BA+Arch+Dev+QA",
    "agents": [...],
    "workflow": [...],
    "policies": {...}
  }
  ```
- User can version control, share, or import elsewhere

### 11a. Activate/deactivate framework
- At step 11, user toggles framework status
- If activating:
  - System regenerates config files
  - Framework available for new assignments
- If deactivating:
  - Existing assignments remain
  - No new assignments allowed
  - System suggests alternative framework for pending stories

### 6a. Test framework before deployment
- At step 6, user clicks "Test Framework"
- System creates sandbox environment
- User selects test story
- System simulates framework execution on test story
- User reviews:
  - Token usage estimate
  - Workflow sequence
  - Agent responses (dry run)
- User can iterate before saving

## Business Rules
- Framework must have at least one Developer agent
- Framework name must be unique within scope
- Global frameworks available to all projects
- Project-specific frameworks override global for that project
- Active frameworks cannot be deleted (deactivate first)
- Workflow must not have circular dependencies
- Token budgets cannot exceed account limits
- System prompts must follow safety guidelines

## Advanced Features

### Agent Customization per Project
- Base agent definition (global)
- Project-specific overrides:
  - Additional instructions
  - Project-specific tools
  - Custom constraints
- Inheritance: project agents inherit from base + add customizations

### Framework Versioning
- Each framework change creates new version
- Can rollback to previous version
- Can compare versions (diff)
- Stories track which framework version was used

### A/B Testing Frameworks
- User can create multiple framework variants
- System can auto-assign stories to different frameworks
- Metrics compare effectiveness
- User can promote winning framework

## Technical Implementation

### MCP Tools
```typescript
{
  name: "create_framework",
  parameters: {
    name: string,
    description: string,
    scope: "global" | "project",
    project_id?: string,
    config: {
      agents: AgentDefinition[],
      workflow: WorkflowNode[],
      policies: FrameworkPolicies
    }
  }
}

{
  name: "activate_framework",
  parameters: {
    project_id: string,
    framework_id: string
  },
  handler: async (params) => {
    // 1. Validate framework is compatible with project
    // 2. Generate host-specific config files
    // 3. Set as active framework
    // 4. Return file plan for Claude Code/.claude/ updates
  }
}
```

### Config Generation
For Claude Code, generates:
```
.claude/agents/
  ├── ba-agent.md           (BA system prompt + tools)
  ├── architect-agent.md    (Architect system prompt + tools)
  ├── dev-agent.md          (Developer system prompt + tools)
  └── qa-agent.md           (QA system prompt + tools)

.claude/workflows/
  └── story-workflow.json   (workflow routing rules)
```

## Related Use Cases
- UC-ADMIN-001: Bootstrap Project
- UC-PM-004: Assign Story to Framework
- UC-METRICS-001: View Framework Effectiveness
- UC-DEV-001: Pull Assigned Stories

## Acceptance Criteria
- Framework can be created with all configuration options
- Visual workflow builder is intuitive
- Agent configuration supports custom prompts and tools
- Validation prevents invalid configurations
- Host-specific config generation works correctly
- Framework templates accelerate setup
- A/B testing infrastructure works
- Framework versioning allows rollback
- Export/import enables sharing frameworks
- Test mode validates framework before deployment
- UI is significantly better than old implementation (per user feedback)
