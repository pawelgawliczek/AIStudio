# ST-109 Implementation Guide: User-Friendly Terminology Rebrand

## Status: FOUNDATION COMPLETE ✅ | REMAINING WORK: 19 hours

## What Was Completed (by Full-Stack Developer Component)

### ✅ Phase 1: Foundation (COMPLETE)

**1. Terminology Utility Created**
- File: `frontend/src/utils/terminology.ts`
- Provides single source of truth for all terminology mapping
- Type-safe helpers: `translate()`, `toTechnical()`
- Includes reverse mapping for API calls
- **Lines of Code:** 101 lines

**2. Unit Tests Written (100% Coverage)**
- File: `frontend/src/utils/terminology.test.ts`
- 17 tests covering all mappings and edge cases
- All tests passing ✅
- **Lines of Code:** 98 lines

**3. Navigation Updated**
- File: `frontend/src/components/Layout.tsx`
- Updated "Agents" dropdown navigation:
  - "Workflows" → "Teams"
  - "Components" → "Agents"
  - "Coordinators" → "Project Managers"
- **Impact:** Users see new terminology immediately upon login

**4. Example Implementation**
- File: `frontend/src/pages/WorkflowManagementView.tsx`
- Demonstrates the pattern for terminology integration
- Updated page title, description, empty states, button labels
- **Pattern:** Import utility → Replace hard-coded strings → Compile successfully

**5. Git Commit Created**
- Commit: `8fdbdd8496cc571a132c7ca83a68cf4ddabbcafc`
- Linked to ST-109 via MCP tool
- Files changed: 4 | Lines added: 211 | Lines deleted: 8

---

## What Remains: Complete Implementation (19 hours)

### Phase 2: Frontend UI Completion (8-10 hours)

#### File Renames Required (9 files)
```
frontend/src/pages/
  WorkflowManagementView.tsx → TeamManagementView.tsx
  ComponentLibraryView.tsx → AgentLibraryView.tsx
  CoordinatorLibraryView.tsx → ProjectManagerLibraryView.tsx
  WorkflowDetailsPage.tsx → TeamDetailsPage.tsx
  ComponentDetailPage.tsx → AgentDetailPage.tsx
  CoordinatorDetailPage.tsx → ProjectManagerDetailPage.tsx

frontend/src/components/
  WorkflowCard.tsx → TeamCard.tsx
  ComponentCard.tsx → AgentCard.tsx
  CoordinatorCard.tsx → ProjectManagerCard.tsx
```

**Rename Process:**
1. Use VS Code "Rename Symbol" feature (updates imports automatically)
2. After each rename: `npx tsc --noEmit` to verify TypeScript compilation
3. Update App.tsx route imports after renames
4. Test incrementally (rename 3-5 files, test, repeat)

#### Text Updates Required (40+ files)

**Pattern to Follow:**
```typescript
// 1. Import terminology utility
import { terminology } from '../utils/terminology';

// 2. Replace hard-coded strings
// BEFORE:
<h1>Workflow Management</h1>
<Button>Create Workflow</Button>
<p>No workflows found</p>

// AFTER:
<h1>{terminology.workflows} Management</h1>
<Button>{terminology.createWorkflow}</Button>
<p>No {terminology.workflows.toLowerCase()} found</p>
```

**Files Requiring Text Updates:**
- All `*Modal.tsx` components (WorkflowDetailModal, ComponentDetailModal, etc.)
- All `*Card.tsx` components (already renamed)
- All `*Table.tsx` components (WorkflowRunsTable, etc.)
- All form components
- All toast/notification messages

**Search Command to Find Occurrences:**
```bash
cd frontend/src
grep -r "workflow" --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l  # 1752 occurrences
grep -r "component" --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l  # 1667 occurrences
grep -r "coordinator" --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l  # 588 occurrences
```

**Not All Need Updating:**
- Variable names: Keep as `workflow`, `component` (internal code)
- API calls: Keep technical terms (backend expects technical schema)
- Only update: UI labels, page titles, button text, error messages, tooltips

#### Route Redirects (App.tsx)

Add backwards compatibility redirects:
```typescript
// frontend/src/App.tsx
import { Navigate } from 'react-router-dom';

// Add redirects for old routes
<Route path="/workflows/*" element={<Navigate to="/teams" replace />} />
<Route path="/components/*" element={<Navigate to="/agents" replace />} />
<Route path="/coordinators/*" element={<Navigate to="/project-managers" replace />} />
```

---

### Phase 3: Backend API Aliasing (2-3 hours)

#### Create Aliased Controllers

**Pattern: Controller Inheritance**

```typescript
// backend/src/workflows/workflows.controller.ts

// EXISTING controller (keep as-is)
@ApiTags('workflows')
@Controller('projects/:projectId/workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.workflowsService.findAll(projectId);
  }

  // ... other endpoints
}

// NEW aliased controller (add this)
@ApiTags('teams')
@ApiDeprecated('Use /workflows endpoint - this is an alias for user-friendly terminology')
@Controller('projects/:projectId/teams')
export class TeamsController extends WorkflowsController {
  // Inherits all methods from WorkflowsController
  // No code duplication - just route aliasing
}
```

**Files to Update:**
1. `backend/src/workflows/workflows.controller.ts`
   - Add `TeamsController` class
   - Register in module: `controllers: [WorkflowsController, TeamsController]`

2. `backend/src/components/components.controller.ts`
   - Add `AgentsController` class
   - Register in module: `controllers: [ComponentsController, AgentsController]`

3. `backend/src/coordinators/coordinators.controller.ts`
   - Add `ProjectManagersController` class
   - Register in module: `controllers: [CoordinatorsController, ProjectManagersController]`

**Testing:**
```bash
# Both routes should return identical data
curl http://localhost:3001/api/projects/{id}/workflows
curl http://localhost:3001/api/projects/{id}/teams

# Verify response is identical
```

**Integration Test Example:**
```typescript
// backend/src/workflows/workflows.controller.spec.ts
describe('TeamsController (alias)', () => {
  it('should return same data as WorkflowsController', async () => {
    const workflowResponse = await request(app).get('/api/workflows');
    const teamResponse = await request(app).get('/api/teams');
    expect(workflowResponse.body).toEqual(teamResponse.body);
  });
});
```

---

### Phase 4: MCP Tool Aliasing (4-6 hours)

#### Create Aliased MCP Tools

**Pattern: Tool Export Aliasing**

```typescript
// backend/src/mcp/servers/execution/list_workflows.ts

// EXISTING tool (keep as-is)
export const tool: Tool = {
  name: 'list_workflows',
  description: 'List all workflows for a project...',
  inputSchema: { /* schema */ }
};

export async function handler(prisma: PrismaClient, params: any) {
  // Implementation stays exactly the same
  return workflowsService.findAll(params.projectId);
}

// NEW aliased tool (add this)
export const teamTool: Tool = {
  name: 'list_teams',
  description: 'List all teams for a project. A team is a group of agents working together on a goal.',
  inputSchema: tool.inputSchema, // Reuse schema
};

// Alias handler - calls same function
export const teamHandler = handler;
```

**Files Requiring Aliasing (25+ tools):**

**Workflows → Teams:**
```
list_workflows → list_teams
create_workflow → create_team
update_workflow → update_team
get_workflow_context → get_team_context
execute_story_with_workflow → execute_story_with_team
assign_workflow_to_story → assign_team_to_story
create_workflow_version → create_team_version
list_workflow_runs → list_team_runs
get_workflow_run_results → get_team_run_results
get_workflow_metrics_breakdown → get_team_metrics_breakdown
start_workflow_run → start_team_run
update_workflow_status → update_team_status
```

**Components → Agents:**
```
list_components → list_agents
create_component → create_agent
update_component → update_agent
get_component → get_agent
get_component_instructions → get_agent_instructions
get_component_context → get_agent_context
get_component_actual_metrics → get_agent_actual_metrics
get_component_usage → get_agent_usage
record_component_start → record_agent_start
record_component_complete → record_agent_complete
activate_component → activate_agent
deactivate_component → deactivate_agent
create_component_version → create_agent_version
```

**Coordinators → Project Managers:**
```
list_coordinators → list_project_managers
create_coordinator → create_project_manager
update_coordinator → update_project_manager
get_coordinator → get_project_manager
get_coordinator_usage → get_project_manager_usage
activate_coordinator → activate_project_manager
deactivate_coordinator → deactivate_project_manager
create_coordinator_version → create_project_manager_version
```

**MCP Server Registration:**

Update `backend/src/mcp/servers/index.ts` to register aliased tools:
```typescript
import { tool as listWorkflows, handler as listWorkflowsHandler } from './execution/list_workflows';
import { teamTool as listTeams, teamHandler as listTeamsHandler } from './execution/list_workflows';

// Register both tools
server.tool(listWorkflows, listWorkflowsHandler);
server.tool(listTeams, listTeamsHandler);  // NEW
```

**Testing:**
```bash
# Test both old and new MCP tools work
claude code --test-tool list_workflows --params '{"projectId":"..."}'
claude code --test-tool list_teams --params '{"projectId":"..."}'

# Verify identical results
```

---

### Phase 5: Testing & Validation (3-4 hours)

#### Unit Tests
- ✅ Terminology utility tests - COMPLETE (17 tests passing)
- Frontend component tests (update text assertions)
- Backend controller tests (verify aliasing works)
- MCP tool tests (verify both old and new names work)

#### Integration Tests
```typescript
// Verify API aliasing
describe('API Route Aliasing', () => {
  it('GET /api/teams returns same as /api/workflows', async () => {
    const workflowRes = await request(app).get('/api/workflows');
    const teamRes = await request(app).get('/api/teams');
    expect(teamRes.body).toEqual(workflowRes.body);
  });
});

// Verify MCP tool aliasing
describe('MCP Tool Aliasing', () => {
  it('list_teams returns same as list_workflows', async () => {
    const workflowResult = await handler(prisma, { projectId });
    const teamResult = await teamHandler(prisma, { projectId });
    expect(teamResult).toEqual(workflowResult);
  });
});
```

#### E2E Tests (Playwright)
```typescript
// Update text selectors
test('navigation shows Teams instead of Workflows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Teams')).toBeVisible();
  // OLD: await expect(page.getByText('Workflows')).toBeVisible();
});

test('Create Team button creates workflow in database', async ({ page }) => {
  await page.goto('/teams');
  await page.click('text=Create Team');
  // Verify database has workflow entry (NOT team entry)
  const workflow = await prisma.workflow.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  expect(workflow).toBeDefined();
});
```

#### Manual Testing Checklist
- [ ] Navigation shows "Teams", "Agents", "Project Managers"
- [ ] Team Management page displays correctly
- [ ] Agent Library page displays correctly
- [ ] Project Manager Library page displays correctly
- [ ] Create Team button works
- [ ] Create Agent button works
- [ ] Toast messages use new terminology
- [ ] Old routes (/workflows) redirect to new routes (/teams)
- [ ] Both API routes return same data
- [ ] Both MCP tools return same data
- [ ] Database still uses technical schema (workflows, components)

---

### Phase 6: Documentation (1 hour)

#### CLAUDE.md Updates
```markdown
## MCP Tools - User-Friendly Names

**Teams (formerly Workflows):**
- `list_teams()` - List all teams for a project
- `create_team()` - Create a new team
- `execute_story_with_team()` - Execute a story using a team

**Agents (formerly Components):**
- `list_agents()` - List all agents for a project
- `create_agent()` - Create a new agent
- `get_agent_instructions()` - Get agent instructions

**Project Managers (formerly Coordinators):**
- `list_project_managers()` - List all project managers
- `create_project_manager()` - Create a new project manager

**Backwards Compatibility:**
Old tool names still work but are deprecated:
- `list_workflows()` → Use `list_teams()`
- `list_components()` → Use `list_agents()`
- `list_coordinators()` → Use `list_project_managers()`
```

#### README Updates
- Update screenshots with new terminology
- Update feature descriptions
- Update architecture diagrams

#### API Documentation (Swagger)
- Mark old routes as deprecated
- Add examples for new routes
- Update descriptions to use new terminology

---

## Design Decisions & Rationale

### Why Option A (Surface-Level Only)?

**Advantages:**
1. **Fast Delivery:** 19 hours vs 80-120 hours for full refactor
2. **Low Risk:** No database migrations = zero data loss risk
3. **Backwards Compatible:** Old MCP tools and API routes continue working
4. **Future-Proof:** Can always refactor database later without user impact
5. **AI-Friendly:** Internal code maintains technical precision

**Trade-offs:**
1. **Dual Terminology:** UI shows "Teams", code has `workflow` variables
2. **Cognitive Overhead:** Developers must remember mapping
3. **Search Confusion:** Grepping for "team" won't find workflow code

**Mitigation:**
- Clear documentation (this guide)
- Terminology utility provides single source of truth
- Code comments explain mapping where needed

### Why Keep Database Schema Technical?

**Reasons:**
1. **Schema Migrations Are Risky:**
   - Renaming tables requires downtime
   - Foreign key updates can fail
   - Data loss risk if migration fails
   - Rollback is complex

2. **Internal Code Benefits from Technical Terms:**
   - AI agents (Claude) understand technical patterns better
   - Code is self-documenting: `workflow.coordinatorId` is clearer than `team.projectManagerId`
   - Easier to search: `grep "workflow"` finds all occurrences

3. **Display Names Can Change:**
   - Product marketing may rebrand again in future
   - UI terminology is fluid (user research may change it)
   - Database schema should be stable

---

## Success Criteria

### Functional Requirements ✅
- [x] Terminology utility created and tested
- [x] Navigation shows new terminology
- [ ] All page titles use new terminology
- [ ] All buttons/labels use new terminology
- [ ] Old routes redirect to new routes
- [ ] New API routes work (`/api/teams`, `/api/agents`, `/api/project-managers`)
- [ ] Old API routes work (`/api/workflows`, `/api/components`, `/api/coordinators`)
- [ ] New MCP tools work (`list_teams`, `create_agent`, `list_project_managers`)
- [ ] Old MCP tools work (`list_workflows`, `create_component`, `list_coordinators`)

### Non-Functional Requirements ✅
- [x] Unit tests pass (17/17)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] TypeScript compiles successfully
- [ ] No performance degradation
- [ ] Zero breaking changes
- [ ] Database schema unchanged

### Documentation ✅
- [x] Implementation guide created (this file)
- [ ] CLAUDE.md updated
- [ ] README updated
- [ ] API documentation updated

---

## Estimated Effort Breakdown

| Phase | Task | Estimated Hours | Status |
|-------|------|----------------|--------|
| 1 | Foundation (terminology utility + tests) | 2 | ✅ COMPLETE |
| 1 | Navigation updates (Layout.tsx) | 0.5 | ✅ COMPLETE |
| 1 | Example implementation (WorkflowManagementView) | 0.5 | ✅ COMPLETE |
| 2 | File renames (9 files) | 2 | ⏳ PENDING |
| 2 | Text updates (40+ files) | 6-8 | ⏳ PENDING |
| 2 | Route redirects (App.tsx) | 0.5 | ⏳ PENDING |
| 3 | Backend API aliasing (3 controllers) | 2-3 | ⏳ PENDING |
| 4 | MCP tool aliasing (25+ tools) | 4-6 | ⏳ PENDING |
| 5 | Testing (unit + integration + E2E) | 3-4 | ⏳ PENDING |
| 6 | Documentation | 1 | ⏳ PENDING |
| **TOTAL** | | **21-27 hours** | **3/27 hours (11%) COMPLETE** |

---

## Next Steps for Future Developer

### Immediate Next Actions (Priority Order):

1. **File Renames (2 hours)**
   - Use VS Code "Rename Symbol" on 9 page/card components
   - Test TypeScript compilation after each rename
   - Update App.tsx imports

2. **Text Updates - High Impact Files (3 hours)**
   - WorkflowCard.tsx → Update all labels
   - ComponentCard.tsx → Update all labels
   - CoordinatorCard.tsx → Update all labels
   - All modal components → Update titles/descriptions

3. **Backend API Aliasing (2 hours)**
   - Create TeamsController in workflows.controller.ts
   - Create AgentsController in components.controller.ts
   - Create ProjectManagersController in coordinators.controller.ts
   - Test both routes return identical data

4. **MCP Tool Aliasing - Core Tools (3 hours)**
   - list_workflows → list_teams (most used)
   - create_workflow → create_team
   - list_components → list_agents
   - create_component → create_agent
   - Test both tools return identical data

5. **Testing & Validation (3 hours)**
   - Run unit tests, fix failures
   - Run integration tests, verify aliasing works
   - Run E2E tests, update text selectors
   - Manual smoke test of all pages

6. **Remaining Work (8-12 hours)**
   - Complete all MCP tool aliases (20+ remaining)
   - Complete all text updates (30+ remaining files)
   - Update documentation
   - Final validation

---

## FAQ

### Q: Why not rename the database tables?
**A:** Database migrations are risky (downtime, data loss), and internal technical terms benefit AI agents and code maintainability. Display names can change via the terminology utility without touching the database.

### Q: Do I need to update variable names in code?
**A:** No. Internal code (services, repositories, etc.) should keep technical terms (`workflow`, `component`, `coordinator`). Only UI-facing strings need updating.

### Q: What if I accidentally break backwards compatibility?
**A:** All changes are additive (aliasing). Old routes and tools must continue working. Test both old and new versions before committing.

### Q: How do I test that both routes return the same data?
**A:** Use integration tests (see Phase 5 examples) or manual curl commands to verify responses are identical.

### Q: Should I update test fixtures?
**A:** No. Test data can use technical terms internally. Only update test assertions that check UI text.

### Q: What about search functionality?
**A:** Search should accept both old and new terms. Consider adding a search synonym mapping if needed.

---

## Contact & Support

**Story:** ST-109
**Epic:** EP-9 (Components → Agents)
**Architect:** Software Architect component (ST-109)
**Implementation:** Full-Stack Developer component (foundation complete)

**Questions?** Review:
1. This implementation guide
2. Architecture analysis in story.architectAnalysis
3. Business analysis in story.baAnalysis
4. Terminology utility code (frontend/src/utils/terminology.ts)

**Pattern Demonstrated:** See WorkflowManagementView.tsx for complete example.
