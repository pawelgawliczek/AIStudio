# AIStudio Agentic Development Workflow

## Overview

This workflow adapts proven agentic development patterns to the AIStudio MCP Control Plane project. It provides a hierarchical, complexity-aware process with intelligent agent orchestration and parallel execution.

---

## I. Workflow Phases & Decision Tree

### Task Classification (by Coordinator)

**Trivial (⚡)**: < 10 lines, zero logic
- "Fix typo, CSS tweak, comment, copy change"
- Single component: Full-stack only
- Duration: 5-10 minutes
- Skip BA and Architect

**Simple (🏃)**: < 50 lines, single file, no DB/API
- "UI bug fix, config change, minor logic fix"
- Components: Full-stack → Architect (spot-check)
- Duration: 20-30 minutes
- Skip BA

**Medium (🚶)**: Multi-file, no DB/API changes
- "New component, refactor, feature enhancement"
- Components: BA → (Architect + Full-stack parallel) → QA
- Duration: 1-2 hours
- Full context gathering

**Complex (🏋️)**: API/DB changes, new service
- "New endpoint, schema migration, MCP tool integration"
- Full workflow: BA → Architect → Full-stack → QA → DevOps
- Duration: 2-4 hours
- Full documentation

**Critical (🔒)**: Database schema, metrics, code quality system
- "Prisma migrations, metrics aggregation, code analysis"
- Full workflow + extra validation
- Testing on separate database instance
- Duration: 3-5 hours

---

## II. Agent Components & MCP Tools

### 1. Coordinator Agent (Orchestrator)

**Role**: Workflow orchestration and decision-making

**Responsibilities**:
1. Classify story complexity using decision algorithm
2. Select appropriate components for execution
3. Create context document for medium+ tasks via Explore component
4. Track progress with MCP workflow tools
5. Make routing decisions based on component outputs

**MCP Tools Available**:
- `get_workflow_context` - Get current workflow state
- `record_component_start` - Log component execution start
- `record_component_complete` - Log component completion
- `update_workflow_status` - Update overall workflow status
- `get_story` - Get story details with use cases
- `list_projects` - Get project information
- `search_use_cases` - Find related use cases

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.7,
  "maxInputTokens": 20000,
  "maxOutputTokens": 4000,
  "timeout": 300000,
  "maxRetries": 3
}
```

**Coordinator Instructions**:
```
You are the Workflow Coordinator for AIStudio development tasks.

Your job is to:
1. Analyze the story and classify its complexity
2. Decide which components to execute and in what order
3. Manage context handoff between components
4. Make decisions based on component outputs
5. Track metrics and ensure quality

Decision Strategy: Adaptive
- Trivial: Full-stack only
- Simple: Full-stack → Architect spot-check
- Medium: BA → (Architect + Full-stack parallel) → QA
- Complex: BA → Architect → Full-stack → QA → DevOps
- Critical: Full workflow + validation

Always use MCP tools to:
- Retrieve story and use case context
- Log component execution
- Store intermediate outputs
- Track workflow progress
```

---

### 2. Context Explore Component

**Purpose**: One-time context gathering to eliminate redundant investigation

**When to Execute**:
- Medium+ complexity stories
- When user doesn't provide specific files
- Skip for trivial/simple or when files are specified

**Input Instructions**:
```
You will receive:
- Story ID and description
- Project ID
- Use case links (if any)

Your job is to discover:
1. All relevant files and their purposes
2. Current system behavior
3. Database tables/models involved
4. Existing tests and coverage
5. Dependencies and imports
6. Related documentation
```

**Operation Instructions**:
```
Use MCP tools to:
1. search_use_cases - Find related use cases by story
2. get_file_dependencies - Understand file relationships
3. get_file_health - Assess code quality of key files
4. analyze_file_impact - Understand blast radius

Use standard tools to:
1. Grep - Search for patterns and keywords
2. Read - Examine key files
3. Glob - Find related files

Create a comprehensive context document with:
- Relevant files (backend/src/foo/bar.ts:45-120)
- Current behavior explanation
- Database models and relationships
- Test coverage status
- Dependencies and imports
- Documentation references
```

**Output Instructions**:
```
Produce a compact TEMP_context.md file (<5KB) with:

## Relevant Files
- `file/path.ts` (lines X-Y): Purpose and current behavior
- ...

## Database Models
- Model: Purpose, key fields, relationships
- ...

## Current Behavior
[Clear explanation of how the system currently works]

## Dependencies
- External: npm packages, APIs
- Internal: imports, service dependencies

## Test Coverage
- Unit: X% (files: ...)
- Integration: Y% (files: ...)
- E2E: Z% (files: ...)

## Documentation
- Links to relevant docs
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.3,
  "maxInputTokens": 50000,
  "maxOutputTokens": 4000
}
```

**MCP Tools**:
- `get_story`
- `search_use_cases`
- `find_related_use_cases`
- `get_file_dependencies`
- `get_file_health`
- `analyze_file_impact`

**Output Artifact**: TEMP_context.md (stored via coordinator)

**Token Savings**: 60-80% reduction on medium/complex tasks

---

### 3. Business Analyst Component

**Purpose**: Define clear requirements and acceptance criteria

**Input Instructions**:
```
You will receive:
- Story title and description
- TEMP_context.md (for medium+ tasks)
- Use case links
- Project context

Read context FIRST - do not re-investigate the codebase.
```

**Operation Instructions**:
```
Your job is to:
1. Analyze user goals and target users
2. Define user stories with acceptance criteria
3. Identify edge cases and dependencies
4. Create prioritized test case list (MoSCoW)
5. Link to relevant use cases

Use MCP tools to:
- search_use_cases - Find related use cases
- get_use_case_coverage - Check test coverage
- link_use_case_to_story - Link relevant use cases

User Story Format:
- As a [user type], I want [goal], so that [benefit]
- Acceptance criteria in Given/When/Then format
- Edge cases documented
- Dependencies identified

Test Case Priority:
- Must Have (Critical path)
- Should Have (Important flows)
- Could Have (Nice to have)
- Won't Have (Out of scope)
```

**Output Instructions**:
```
Produce TEMP_requirements.md with:

## User Story
As a [role], I want [goal], so that [benefit]

## Acceptance Criteria
1. Given [context], when [action], then [result]
2. ...

## Edge Cases
- Case 1: Description and expected behavior
- ...

## Test Cases (Prioritized)
### Must Have
- TC-1: Description
- ...

### Should Have
- ...

### Could Have
- ...

## Dependencies
- External: APIs, services
- Internal: Other stories, features

## Use Cases Linked
- UC-XXX-001: Use case title (implements/modifies)
- ...
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.5,
  "maxInputTokens": 30000,
  "maxOutputTokens": 3000
}
```

**MCP Tools**:
- `get_story`
- `search_use_cases`
- `find_related_use_cases`
- `get_use_case_coverage`
- `link_use_case_to_story`

**Standard Tools**: Read, Write, Grep, Glob

**Output Artifact**: TEMP_requirements.md

---

### 4. Software Architect Component

**Purpose**: Technical design and architecture validation

**Review Scope Decision**:
- **Skip**: < 10 lines, trivial changes
- **Spot-check** (5 min): < 50 lines, single file
- **Full review** (30+ min): Multi-file, new patterns, DB/API changes

**Input Instructions**:
```
You will receive:
- TEMP_context.md (for medium+ tasks)
- TEMP_requirements.md
- Story complexity classification

Based on complexity, perform appropriate review level.
```

**Operation Instructions**:
```
For Spot-Check:
1. Verify security considerations
2. Check pattern consistency
3. Identify obvious issues
4. 5-minute quick review

For Full Review:
1. Analyze architectural approach
2. Design API endpoints and payloads
3. Design database schema changes
4. Validate pattern consistency
5. Security considerations
6. Performance implications

Use MCP tools to:
- get_project_health - Assess overall code quality
- get_architect_insights - Get AI-powered recommendations
- get_file_dependencies - Understand coupling
- analyze_file_impact - Understand blast radius
- get_story_blast_radius - See what might break

Use Explore component if needed for pattern discovery.
```

**Output Instructions**:
```
For Spot-Check:
Brief inline review (no file needed)

For Full Review, produce TEMP_design.md:

## Architecture Approach
[High-level design explanation]

## API Design
### Endpoint: POST /api/foo/bar
Request:
```json
{ ... }
```

Response:
```json
{ ... }
```

## Database Changes
### Schema Changes
```prisma
model Foo {
  ...
}
```

### Migration Plan
1. Step 1
2. Step 2

## File Changes
- Create: `path/to/new/file.ts`
- Modify: `path/to/existing/file.ts` (add X, modify Y)
- Delete: `path/to/obsolete/file.ts`

## Security Considerations
- Authentication requirements
- Authorization checks
- Input validation
- Data encryption

## Performance Implications
- Database indexes needed
- Caching strategy
- Query optimization

## Risks & Mitigations
- Risk 1: Description → Mitigation
- ...

## Pattern Validation
[Consistency with existing codebase patterns]
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.4,
  "maxInputTokens": 40000,
  "maxOutputTokens": 4000
}
```

**MCP Tools**:
- `get_project_health`
- `get_architect_insights`
- `get_file_health`
- `get_file_dependencies`
- `analyze_file_impact`
- `get_story_blast_radius`
- `suggest_files_for_story`

**Standard Tools**: Read, Write, Grep, Glob, Task (for Explore)

**Output Artifact**: TEMP_design.md (full review) or inline comments (spot-check)

---

### 5. Full-Stack Developer Component

**Purpose**: Implementation with comprehensive testing (TDD)

**Testing Ownership**: ALL tests (unit, integration, E2E except Playwright)

**Input Instructions**:
```
You will receive:
- TEMP_context.md
- TEMP_requirements.md
- TEMP_design.md
- Story details

Read all context documents FIRST.
```

**Operation Instructions**:
```
Follow TDD workflow:
1. Write failing tests (Red)
   - Unit tests (backend/src/**/*.spec.ts)
   - Integration tests (backend/src/**/*.integration.spec.ts)
   - E2E API tests (backend/tests/e2e/**/*.e2e-spec.ts)
   - Frontend tests (frontend/src/**/*.test.tsx)

2. Implement feature (Green)
   - Backend: NestJS services, controllers, modules
   - Frontend: React components, hooks, pages
   - Database: Prisma schema, migrations
   - MCP: Tools, handlers, server

3. Refactor (Clean)
   - Code quality improvements
   - Performance optimization
   - Documentation

Coverage Targets:
- Critical paths: 100%
- Unit: 95%+
- Integration: 90%+
- Overall: 95%+

Use MCP tools to:
- log_run - Track execution metrics
- link_commit - Link commits to story
- update_story - Update story status
- update_file_mappings - Map files to use cases

Use standard tools extensively:
- Read, Write, Edit - File operations
- Bash - Run tests, builds, commands
- Grep, Glob - Code search
```

**Output Instructions**:
```
Produce:
1. Implementation code (following existing patterns)
2. Comprehensive test suites
3. Prisma migrations (if DB changes)
4. Updated documentation (inline)

Create commit with format:
<type>: <description> [Story-<key>]

Example:
feat: Add workflow metrics tracking [Story-ST-123]
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.3,
  "maxInputTokens": 60000,
  "maxOutputTokens": 8000
}
```

**MCP Tools**:
- `log_run`
- `link_commit`
- `update_story`
- `update_file_mappings`
- `get_story_blast_radius`

**Standard Tools**: Read, Write, Edit, Bash, Grep, Glob, Task

**Output**: Code + Tests + Migrations

---

### 6. QA Automation Component

**Purpose**: Playwright E2E tests for complex multi-user flows

**Input Instructions**:
```
You will receive:
- TEMP_requirements.md
- TEMP_design.md
- Implementation details
- Story details

Focus on complex UI flows that require Playwright.
```

**Operation Instructions**:
```
Your responsibilities:
1. Write Playwright E2E tests for complex flows
2. Review full-stack's test strategy
3. Validate critical path coverage
4. Multi-user scenario testing

Do NOT:
- Rewrite unit tests (full-stack owns)
- Rewrite integration tests (full-stack owns)
- Rewrite E2E API tests (full-stack owns)

Focus on:
- Multi-user interactions
- Complex UI workflows
- Cross-browser testing
- Visual regression testing

Use MCP tools to:
- get_use_case_coverage - Check test coverage
- get_component_test_coverage - Verify coverage
```

**Output Instructions**:
```
Produce Playwright tests:

Location: frontend/tests/e2e/*.spec.ts

Format:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform complex workflow', async ({ page, context }) => {
    // Multi-step user flow
  });
});
```

Coverage Report:
- Critical paths tested: [list]
- Multi-user scenarios: [list]
- Edge cases covered: [list]
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.3,
  "maxInputTokens": 40000,
  "maxOutputTokens": 4000
}
```

**MCP Tools**:
- `get_use_case_coverage`
- `get_component_test_coverage`

**Standard Tools**: Read, Write, Edit, Bash, Glob

**Output**: Playwright E2E tests

---

### 7. DevOps Engineer Component

**Purpose**: Build, deploy, and verify deployment

**Input Instructions**:
```
You will receive:
- Code changes
- Database migrations
- Build requirements
- Environment configuration

Prepare for deployment and verification.
```

**Operation Instructions**:
```
Deployment Steps:
1. Build services
   ```bash
   cd backend && npm run build
   cd frontend && npm run build
   ```

2. Run migrations (if any)
   ```bash
   cd backend
   DATABASE_URL='...' npx prisma migrate deploy
   ```

3. Deploy services
   ```bash
   # For Docker Compose
   docker compose build --no-cache api
   docker compose build --no-cache web
   docker compose restart api web
   ```

4. MANDATORY Verification
   ```bash
   # Verify backend build
   docker compose exec api ls -lt /app/dist/ | head -10

   # Verify frontend build
   docker compose exec web ls -lt /app/dist/ | head -10

   # Clear Redis cache
   docker compose exec redis redis-cli FLUSHALL

   # Health check
   curl http://localhost:3000/api/health
   curl http://localhost:5173/
   ```

5. Run smoke tests
   ```bash
   npm run test:e2e:smoke
   ```

Success Criteria:
- ✅ Services running
- ✅ Migrations applied
- ✅ Changed files verified in containers
- ✅ Cache cleared
- ✅ Health checks passing
- ✅ Smoke tests passing
```

**Output Instructions**:
```
Provide deployment report:

## Deployment Status: SUCCESS / FAILED

### Build Results
- Backend: ✅ Success
- Frontend: ✅ Success

### Migrations Applied
- 20250113_add_workflow_metrics.sql: ✅ Success

### Services Verified
- API (port 3000): ✅ Running
- Web (port 5173): ✅ Running
- Redis: ✅ Running
- Database: ✅ Running

### Health Checks
- API health: ✅ Passing
- Web loaded: ✅ Passing

### Cache Status
- Redis: ✅ Flushed

### Smoke Tests
- Critical paths: ✅ Passing (10/10)

### Issues
[Any issues encountered and resolutions]
```

**Configuration**:
```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.2,
  "maxInputTokens": 30000,
  "maxOutputTokens": 3000
}
```

**MCP Tools**: None (uses standard tools only)

**Standard Tools**: Read, Write, Edit, Bash, Grep, Glob

**Output**: Deployment verification report

---

## III. Parallelization Strategy

### Where Parallelization Occurs

**BA + Architect (Simultaneous)**:
```
Coordinator spawns both components in parallel:
- BA defines requirements (NEW information)
- Architect reviews patterns (EXISTING codebase)
- No data dependency between tasks
- Saves ~30 minutes per medium/complex task
```

**Implementation Pattern**:
```typescript
// Coordinator spawns parallel components
const [baOutput, architectOutput] = await Promise.all([
  executeComponent('BA', { storyId, context }),
  executeComponent('Architect', { storyId, context })
]);

// Merge outputs for next step
const designContext = {
  requirements: baOutput,
  design: architectOutput
};
```

**Sequential Dependencies**:
```
Explore → (BA + Architect parallel) → Full-stack → QA → DevOps
```

---

## IV. Context Handoff Protocol

### For Medium+ Tasks

**1. Coordinator Delegates to Explore Component**:
```
Input: Story ID, project context
Task: "Find all related files, explain current behavior, identify patterns"
```

**2. Explore Creates TEMP_context.md**:
```
Size: ~5KB
Contents:
- Relevant files with line ranges
- Current behavior explanation
- Database models
- Test coverage
- Dependencies
```

**3. All Components Read TEMP_context.md**:
```
No re-investigation of codebase
Direct context consumption
Faster execution
```

### Token Comparison

Traditional (every component explores):
- Explore: 150K
- BA: 150K
- Architect: 200K
- Full-stack: 250K
- **Total: 750K tokens**

Optimized (Explore once, share via TEMP):
- Explore: 150K (once)
- BA: 15K (read context)
- Architect: 20K (read context)
- Full-stack: 40K (read context)
- **Total: 225K tokens**

**Savings: 525K tokens (70% reduction)**

---

## V. Metrics Tracking Integration

### Workflow Run Metrics

Tracked automatically via MCP tools:

```typescript
// Coordinator
start_workflow_run(workflowId, storyId, triggeredBy)
→ Returns runId

// Each component
record_component_start(runId, componentId, input)
record_component_complete(runId, componentId, {
  status: 'completed',
  output: {...},
  metrics: {
    tokensUsed: 15000,
    durationSeconds: 120,
    filesModified: 3,
    linesOfCode: 245,
    costUsd: 0.05,
    userPrompts: 2,
    systemIterations: 1,
    humanInterventions: 0
  }
})

// Coordinator
update_workflow_status(runId, 'completed', summary)
```

### Commit Tracking

```bash
# Commit format
<type>: <description> [Story-<key>]

# Examples
feat: Add workflow metrics endpoint [Story-ST-123]
fix: Resolve race condition in metrics [Story-ST-123]
test: Add integration tests for workflows [Story-ST-123]
```

### Metrics Collected

1. **Velocity**: Estimated vs actual time, baseline comparison
2. **Quality**: Code coverage, complexity, maintainability
3. **Throughput**: Lead time, stories per week, LOC per day
4. **Efficiency**: User prompts, handoffs, iterations, tokens per story
5. **Cost**: Total tokens, estimated cost, cost per story

---

## VI. Component Decision Matrix

| Complexity | Explore | BA | Architect | Full-Stack | QA | DevOps | Duration |
|------------|---------|----|-----------|-----------|----|---------|----------|
| Trivial ⚡ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | 5-10m |
| Simple 🏃 | ❌ | ❌ | ✅ (spot) | ✅ | ❌ | ❌ | 20-30m |
| Medium 🚶 | ✅ | ✅ | ✅ (full) | ✅ | ✅ | ❌ | 1-2h |
| Complex 🏋️ | ✅ | ✅ | ✅ (full) | ✅ | ✅ | ✅ | 2-4h |
| Critical 🔒 | ✅ | ✅ | ✅ (full) | ✅ | ✅ | ✅ | 3-5h |

---

## VII. Workflow Execution Flow

### Story Assignment Trigger

```
1. User assigns story to workflow
   └─> Coordinator receives story via webhook/manual trigger

2. Coordinator retrieves context
   - get_story (with use cases, subtasks)
   - get_project (project details)
   - start_workflow_run (initialize tracking)

3. Coordinator classifies complexity
   ├─ Trivial: Skip to Full-stack
   ├─ Simple: Skip to Full-stack + Architect spot-check
   ├─ Medium: Execute Explore → (BA + Architect) → Full-stack → QA
   ├─ Complex: Execute Explore → (BA + Architect) → Full-stack → QA → DevOps
   └─ Critical: Execute Explore → (BA + Architect) → Full-stack → QA → DevOps + validation

4. Coordinator executes components in order
   - record_component_start
   - Execute component
   - record_component_complete
   - store_artifact (if needed)

5. Coordinator makes routing decisions
   - Analyze component outputs
   - Decide next steps
   - Handle errors/retries

6. Coordinator completes workflow
   - update_workflow_status
   - Update story status
   - Cleanup temp files
   - Generate summary
```

---

## VIII. Key Design Principles

1. **Hierarchical Orchestration**: Coordinator makes all routing decisions
2. **Context Handoff**: TEMP files eliminate redundant investigation (70% token savings)
3. **Parallelization**: BA + Architect run simultaneously when possible
4. **Testing Ownership**: Full-stack owns all tests except Playwright
5. **Metrics via MCP**: Automatic tracking of all workflow metrics
6. **Adaptive Complexity**: Right-sized team based on story complexity
7. **Quality First**: Comprehensive testing at every level
8. **Clear Handoffs**: Well-defined inputs/outputs for each component

---

## IX. Success Metrics

### Workflow Efficiency
- Average time per story by complexity
- Token usage per story
- Cost per story
- Component reuse rate

### Quality Metrics
- Test coverage by story
- Defects found in review vs production
- Code complexity trends
- Maintainability index

### Velocity Metrics
- Stories completed per week
- Lead time (story assigned → deployed)
- Cycle time (development → deployed)
- Throughput trends

### Agent Efficiency
- Tokens per component
- User prompts per component
- Iterations per component
- Human interventions needed

---

## X. Implementation Checklist

- [ ] Create coordinator agent configuration
- [ ] Implement all 7 components with proper instructions
- [ ] Set up MCP tool access for each component
- [ ] Configure parallel execution capability
- [ ] Implement context handoff mechanism (TEMP files via artifacts)
- [ ] Set up workflow metrics tracking
- [ ] Create workflow trigger (story assignment)
- [ ] Implement decision algorithms
- [ ] Add error handling and retry logic
- [ ] Create monitoring dashboard
- [ ] Write workflow documentation
- [ ] Test with sample stories (each complexity level)

---

## XI. Next Steps

1. **Get approval** for this workflow design
2. **Implement coordinator agent** with decision logic
3. **Create all component definitions** in database
4. **Test workflow** with a simple story
5. **Iterate and refine** based on results
6. **Scale to production** with monitoring

---

## Summary

This workflow provides:
- ✅ **Intelligent Routing**: Right-sized teams based on complexity
- ✅ **Context Optimization**: 70% token reduction via Explore component
- ✅ **Parallel Execution**: BA + Architect run simultaneously
- ✅ **Comprehensive Testing**: TDD with high coverage targets
- ✅ **Automatic Metrics**: Complete tracking via MCP tools
- ✅ **Quality Focus**: Architecture review and code quality checks
- ✅ **Scalable Design**: Handles trivial to critical complexity
