# Agent Workflow MVP - Implementation Plan

**Last Updated**: 2025-11-12
**Status**: In Progress - Phase 2 Complete (Backend + Frontend)

---

## Architecture Summary

**Pattern**: Generic Component + Coordinator
- **Components**: Reusable building blocks configured via 3 instruction sets
- **Coordinators**: Intelligent orchestrators that decide workflow execution
- **Workflows**: Link coordinator + trigger configuration
- **Execution**: Real-time monitoring, metrics tracking, defect leakage analysis

---

## Implementation Phases

### Phase 1: Foundation & Database Schema ✅ COMPLETED
**Goal**: Set up data model, migrations, and core backend services

- [x] Create implementation plan document
- [x] Database schema updates (Prisma)
  - [x] Update Story model (assignedWorkflowId, defectLeakageCount, defect relations)
  - [x] Update Subtask model (componentRunId relation)
  - [x] Add Component model (generic building block)
  - [x] Add CoordinatorAgent model (intelligent orchestrator)
  - [x] Add Workflow model (coordinator + trigger)
  - [x] Add WorkflowRun model (execution tracking with iteration metrics)
  - [x] Add ComponentRun model (component execution with prompts tracking)
  - [x] Add DefectNew model (enhanced defect tracking with origin)
  - [x] Add ActiveWorkflow model (Claude Code activation tracking)
  - [x] Add MetricsAggregation model (pre-calculated metrics)
  - [x] Add RunStatus enum
- [x] Database migration SQL created
- [ ] Run database migration (requires Prisma setup)
- [ ] Seed data for testing
- [ ] Core backend services setup

**Files to Create/Modify**:
- `backend/prisma/schema.prisma` - Schema updates
- `backend/prisma/migrations/` - Migration files
- `backend/src/components/` - Component service
- `backend/src/coordinators/` - Coordinator service
- `backend/src/workflows/` - Workflow service

---

### Phase 2: Component & Coordinator Management ✅ COMPLETED
**Goal**: Web UI for creating and managing components and coordinators

#### UC-MVP-001: Create Generic Component ✅ APPROVED
- [x] Backend API endpoints ✅ COMPLETED
  - [x] POST /api/projects/:projectId/components - Create component
  - [x] GET /api/projects/:projectId/components - List components
  - [x] GET /api/projects/:projectId/components/:id - Get component
  - [x] PUT /api/projects/:projectId/components/:id - Update component
  - [x] DELETE /api/projects/:projectId/components/:id - Delete component
  - [x] POST /api/projects/:projectId/components/:id/test - Test component
  - [x] POST /api/projects/:projectId/components/:id/activate - Activate component
  - [x] POST /api/projects/:projectId/components/:id/deactivate - Deactivate component
- [x] Frontend components ✅ COMPLETED
  - [x] ComponentLibraryView.tsx - Full page with search, filters, grid display
  - [x] ComponentCard.tsx - Card component with stats and actions
  - [x] CreateComponentModal.tsx - Create/edit modal with 3 instruction sets
  - [x] ComponentDetailModal.tsx - Detailed view with full info and usage stats

#### UC-MVP-002: Edit Existing Component ✅ APPROVED
- [x] Backend API endpoints ✅ COMPLETED
  - [x] PUT /api/projects/:projectId/components/:id - Update component
  - [x] GET /api/projects/:projectId/components/:id?includeStats=true - Get with usage statistics
  - [ ] POST /api/components/:id/version - Create new version (versioning TBD)
  - [ ] GET /api/components/:id/versions - List versions (versioning TBD)
- [ ] Frontend components
  - [ ] EditComponentModal.tsx
  - [ ] ComponentVersionHistory.tsx
  - [ ] ComponentUsageStats.tsx

#### UC-MVP-003: Create Coordinator Agent ✅ APPROVED
- [x] Backend API endpoints ✅ COMPLETED
  - [x] POST /api/projects/:projectId/coordinators - Create coordinator
  - [x] GET /api/projects/:projectId/coordinators - List coordinators
  - [x] GET /api/projects/:projectId/coordinators/:id - Get coordinator
  - [x] PUT /api/projects/:projectId/coordinators/:id - Update coordinator
  - [x] DELETE /api/projects/:projectId/coordinators/:id - Delete coordinator
  - [x] POST /api/projects/:projectId/coordinators/:id/activate - Activate coordinator
  - [x] POST /api/projects/:projectId/coordinators/:id/deactivate - Deactivate coordinator
  - [ ] POST /api/coordinators/:id/test - Test coordinator logic (requires execution engine)
- [x] Frontend components ✅ COMPLETED
  - [x] CoordinatorLibraryView.tsx - Full page with search, domain filters, grid display
  - [ ] CreateCoordinatorModal.tsx (TBD - Phase 3)
  - [ ] CoordinatorEditor.tsx (TBD - Phase 3)
  - [ ] ComponentLibrarySelector.tsx (TBD - Phase 3)
  - [ ] DecisionStrategySelector.tsx (TBD - Phase 3)

#### UC-MVP-004: Create Workflow ✅ APPROVED
- [x] Backend API endpoints ✅ COMPLETED
  - [x] POST /api/projects/:projectId/workflows - Create workflow
  - [x] GET /api/projects/:projectId/workflows - List workflows
  - [x] GET /api/projects/:projectId/workflows/:id - Get workflow
  - [x] GET /api/projects/:projectId/workflows/:id?includeStats=true - Get with usage statistics
  - [x] PUT /api/projects/:projectId/workflows/:id - Update workflow
  - [x] DELETE /api/projects/:projectId/workflows/:id - Delete workflow
  - [x] POST /api/projects/:projectId/workflows/:id/activate - Activate workflow
  - [x] POST /api/projects/:projectId/workflows/:id/deactivate - Deactivate workflow
- [x] Frontend components ✅ COMPLETED
  - [x] WorkflowManagementView.tsx - Full page with search, filters, grid display
  - [ ] CreateWorkflowModal.tsx (TBD - Phase 3)
  - [ ] WorkflowEditor.tsx (TBD - Phase 3)
  - [ ] TriggerConfigForm.tsx (TBD - Phase 3)

**Backend Files Created** ✅:
- Components Module:
  - ✅ `backend/src/components/components.controller.ts` - REST API with JWT auth
  - ✅ `backend/src/components/components.service.ts` - Business logic + usage stats
  - ✅ `backend/src/components/components.module.ts` - NestJS module
  - ✅ `backend/src/components/dto/create-component.dto.ts`
  - ✅ `backend/src/components/dto/update-component.dto.ts`
  - ✅ `backend/src/components/dto/component-response.dto.ts`
  - ✅ `backend/src/components/dto/index.ts`
- Coordinators Module:
  - ✅ `backend/src/coordinators/coordinators.controller.ts` - REST API with JWT auth
  - ✅ `backend/src/coordinators/coordinators.service.ts` - Business logic + usage stats
  - ✅ `backend/src/coordinators/coordinators.module.ts` - NestJS module
  - ✅ `backend/src/coordinators/dto/create-coordinator.dto.ts`
  - ✅ `backend/src/coordinators/dto/update-coordinator.dto.ts`
  - ✅ `backend/src/coordinators/dto/coordinator-response.dto.ts`
  - ✅ `backend/src/coordinators/dto/index.ts`
- Workflows Module:
  - ✅ `backend/src/workflows/workflows.controller.ts` - REST API with JWT auth
  - ✅ `backend/src/workflows/workflows.service.ts` - Business logic + usage stats
  - ✅ `backend/src/workflows/workflows.module.ts` - NestJS module
  - ✅ `backend/src/workflows/dto/create-workflow.dto.ts`
  - ✅ `backend/src/workflows/dto/update-workflow.dto.ts`
  - ✅ `backend/src/workflows/dto/workflow-response.dto.ts`
  - ✅ `backend/src/workflows/dto/index.ts`
- ✅ Registered all modules in `backend/src/app.module.ts`

**Backend Features Implemented**:
- Full CRUD operations for Components, Coordinators, and Workflows
- JWT authentication on all endpoints
- Swagger/OpenAPI documentation
- Usage statistics calculation from run tables
- Activate/deactivate functionality
- Validation (prevent deletion with execution history)
- Query parameters for filtering (active, tags, domain, search)
- Proper error handling with appropriate HTTP status codes

**Frontend Files Created** ✅:
- Pages:
  - ✅ `frontend/src/pages/ComponentLibraryView.tsx` - Component management page
  - ✅ `frontend/src/pages/CoordinatorLibraryView.tsx` - Coordinator listing page
  - ✅ `frontend/src/pages/WorkflowManagementView.tsx` - Workflow management page
- Components:
  - ✅ `frontend/src/components/ComponentCard.tsx` - Component card display
  - ✅ `frontend/src/components/CreateComponentModal.tsx` - Create/edit component modal
  - ✅ `frontend/src/components/ComponentDetailModal.tsx` - Component detail view
- Routes & Navigation:
  - ✅ Added routes to `frontend/src/App.tsx` (/components, /coordinators, /workflows)
  - ✅ Added navigation links to `frontend/src/components/Layout.tsx`

**Frontend Features Implemented**:
- Component Library: Full CRUD, search, tag filtering, usage stats
- Coordinator Library: List view, search, domain filtering, activate/deactivate
- Workflow Management: List view, search, status filtering, activation display
- Responsive grid layouts with loading states and empty states
- Consistent styling matching existing application design
- React Query integration for data fetching and caching

---

### Phase 3: Workflow Execution & Monitoring
**Goal**: Execute workflows and monitor in real-time

#### UC-MVP-005: Execute Workflow (Manual) 🔄 SKIPPED (to be reviewed)
- [ ] Backend execution engine
  - [ ] WorkflowExecutionService
  - [ ] CoordinatorExecutor
  - [ ] ComponentExecutor
  - [ ] Iteration tracking logic
  - [ ] User prompt tracking
- [ ] MCP tools
  - [ ] execute_workflow
  - [ ] invoke_component
  - [ ] get_workflow_state
  - [ ] get_component_output
- [ ] WebSocket setup for real-time updates

#### UC-MVP-006: Monitor Workflow Execution 🔄 SKIPPED (to be reviewed)
- [ ] Backend API endpoints
  - [ ] GET /api/workflow-runs/:id - Get execution status
  - [ ] GET /api/workflow-runs/:id/live - SSE/WebSocket endpoint
  - [ ] POST /api/workflow-runs/:id/pause - Pause execution
  - [ ] POST /api/workflow-runs/:id/cancel - Cancel execution
  - [ ] POST /api/workflow-runs/:id/resume - Resume execution
- [ ] Frontend components
  - [ ] WorkflowExecutionMonitor.tsx
  - [ ] LiveComponentExecution.tsx
  - [ ] LiveLogViewer.tsx
  - [ ] ExecutionProgressBar.tsx

**Files to Create**:
- Backend:
  - `backend/src/execution/workflow-execution.service.ts`
  - `backend/src/execution/coordinator-executor.service.ts`
  - `backend/src/execution/component-executor.service.ts`
  - `backend/src/execution/iteration-tracker.service.ts`
  - `backend/src/websocket/execution-gateway.ts`
- Frontend:
  - `frontend/src/pages/WorkflowExecution.tsx`
  - `frontend/src/components/execution/*.tsx`

---

### Phase 4: Results & Analytics
**Goal**: Review execution results and view performance metrics

#### UC-MVP-007: Review Workflow Execution Results ✅ REVIEWED
**Requirements**:
- Artifact storage: S3
- Code diffs: Inline
- Export formats: PDF + JSON + Markdown
- Retention: Forever (no policy)
- Sharing: No public URLs

- [ ] S3 integration
  - [ ] S3 client setup
  - [ ] Artifact upload service
  - [ ] Artifact retrieval service
- [ ] Backend API endpoints
  - [ ] GET /api/workflow-runs/:id/results - Get execution results
  - [ ] GET /api/workflow-runs/:id/artifacts - List artifacts
  - [ ] GET /api/workflow-runs/:id/artifacts/:artifactId - Get artifact
  - [ ] GET /api/workflow-runs/:id/coordinator-decisions - Get decisions
  - [ ] POST /api/workflow-runs/:id/export - Export results (PDF/JSON/Markdown)
- [ ] Frontend components
  - [ ] WorkflowResultsView.tsx
  - [ ] ExecutionSummary.tsx
  - [ ] ComponentBreakdown.tsx
  - [ ] ArtifactsViewer.tsx
  - [ ] InlineCodeDiff.tsx
  - [ ] CoordinatorDecisionLog.tsx
  - [ ] IterationBreakdown.tsx
- [ ] Export generators
  - [ ] PDF generator
  - [ ] Markdown generator
  - [ ] JSON serializer

#### UC-MVP-008: View Agent Performance Metrics ✅ REVIEWED
**Requirements**:
- Pre-aggregated metrics (manual recalculation option)
- Retention: Forever
- No alerts
- No BI tool export
- Show industry benchmarks

- [ ] Metrics aggregation system
  - [ ] Daily aggregation job
  - [ ] Weekly aggregation job
  - [ ] Monthly aggregation job
  - [ ] Manual recalculation endpoint
- [ ] Benchmark data
  - [ ] Industry benchmarks JSON
  - [ ] Benchmark comparison logic
- [ ] Backend API endpoints
  - [ ] GET /api/metrics/workflows - Workflow performance
  - [ ] GET /api/metrics/components - Component performance
  - [ ] GET /api/metrics/coordinators - Coordinator performance
  - [ ] GET /api/metrics/trends - Performance trends
  - [ ] GET /api/metrics/comparisons - Workflow comparisons
  - [ ] GET /api/metrics/benchmarks - Industry benchmarks
  - [ ] POST /api/metrics/recalculate - Manual recalculation
- [ ] Frontend components
  - [ ] PerformanceDashboard.tsx
  - [ ] WorkflowPerformanceTab.tsx
  - [ ] ComponentPerformanceTab.tsx
  - [ ] CoordinatorPerformanceTab.tsx
  - [ ] TrendsTab.tsx
  - [ ] ComparisonsTab.tsx
  - [ ] MetricWithBenchmark.tsx
  - [ ] DefectLeakageMetrics.tsx

**Files to Create**:
- Backend:
  - `backend/src/storage/s3.service.ts`
  - `backend/src/artifacts/artifacts.service.ts`
  - `backend/src/exports/pdf-generator.service.ts`
  - `backend/src/exports/markdown-generator.service.ts`
  - `backend/src/metrics/aggregation.service.ts`
  - `backend/src/metrics/benchmarks.service.ts`
  - `backend/src/metrics/metrics.controller.ts`
  - `backend/src/metrics/metrics.service.ts`
  - `backend/data/industry-benchmarks.json`
- Frontend:
  - `frontend/src/pages/WorkflowResults.tsx`
  - `frontend/src/pages/PerformanceDashboard.tsx`
  - `frontend/src/components/results/*.tsx`
  - `frontend/src/components/metrics/*.tsx`

---

### Phase 5: Defect Leakage Tracking
**Goal**: Track which stories introduced defects and measure quality

- [ ] Defect detection system
  - [ ] File change analyzer
  - [ ] Suspect story scorer
  - [ ] User confirmation UI
- [ ] Backend API endpoints
  - [ ] POST /api/defects - Create defect
  - [ ] GET /api/defects/:id - Get defect
  - [ ] POST /api/defects/:id/link-origin - Link to origin story
  - [ ] GET /api/defects/:id/suggest-origin - Get suspect stories
  - [ ] GET /api/stories/:id/defects-introduced - Get defects introduced
  - [ ] GET /api/stories/:id/defects-found - Get defects found
  - [ ] GET /api/components/:id/defect-leakage - Get component defect rate
- [ ] Frontend components
  - [ ] DefectOriginDetection.tsx
  - [ ] SuspectStoryList.tsx
  - [ ] DefectLeakageChart.tsx
  - [ ] DefectsByComponent.tsx

**Files to Create**:
- Backend:
  - `backend/src/defects/defects.controller.ts`
  - `backend/src/defects/defects.service.ts`
  - `backend/src/defects/defect-analyzer.service.ts`
  - `backend/src/defects/dto/*.dto.ts`
- Frontend:
  - `frontend/src/components/defects/*.tsx`

---

### Phase 6: Story View Enhancements
**Goal**: Show agent runs as subtasks with comprehensive KPIs

- [ ] Backend API endpoints
  - [ ] GET /api/stories/:id/agent-runs - Get agent runs for story
  - [ ] GET /api/stories/:id/workflow-summary - Get workflow KPIs
  - [ ] GET /api/subtasks/:id/agent-run-details - Get detailed agent run
- [ ] Frontend components
  - [ ] StoryAgentRunsTab.tsx
  - [ ] WorkflowKPISummary.tsx
  - [ ] SubtaskAgentRunView.tsx
  - [ ] IterationLog.tsx
  - [ ] DefectLinkedToRun.tsx

**Files to Create**:
- Backend:
  - `backend/src/stories/story-agent-runs.service.ts`
- Frontend:
  - `frontend/src/components/stories/AgentRunsTab.tsx`
  - `frontend/src/components/stories/WorkflowKPISummary.tsx`

---

### Phase 7: Claude Code Integration
**Goal**: Activate workflows in Claude Code via MCP

#### UC-MVP-009: Activate Workflow in Claude Code ✅ REVIEWED
**Requirements**:
- Handle file conflicts: Yes (show UI, backup old files)
- Version tracking: Yes
- Multiple workflows active: No (one at a time)
- Auto-updates: Yes (notify + manual sync)
- Validation: Yes (validate before commit)
- Cleanup: Yes (backup old files)

- [ ] MCP tools
  - [ ] activate_workflow
  - [ ] deactivate_workflow
  - [ ] sync_workflow
  - [ ] list_active_workflows
  - [ ] validate_workflow_files
- [ ] File generation
  - [ ] Coordinator agent file generator
  - [ ] Component agent file generator
  - [ ] Workflow skill file generator
  - [ ] Workflow metadata generator
- [ ] Validation system
  - [ ] Agent file structure validator
  - [ ] MCP tool reference validator
  - [ ] Workflow metadata validator
- [ ] Version tracking
  - [ ] Active workflow tracking
  - [ ] Auto-update notification
  - [ ] Sync command
- [ ] Backend API endpoints
  - [ ] POST /api/workflows/:id/activate - Activate workflow
  - [ ] POST /api/workflows/:id/deactivate - Deactivate workflow
  - [ ] POST /api/workflows/:id/sync - Sync to latest version
  - [ ] GET /api/workflows/active - Get active workflows
- [ ] Frontend components
  - [ ] ActivateWorkflowButton.tsx
  - [ ] WorkflowConflictResolver.tsx
  - [ ] WorkflowActivationStatus.tsx

**Files to Create**:
- Backend:
  - `backend/src/mcp/servers/activate-workflow.ts`
  - `backend/src/mcp/servers/deactivate-workflow.ts`
  - `backend/src/mcp/servers/sync-workflow.ts`
  - `backend/src/workflows/activation.service.ts`
  - `backend/src/workflows/file-generators/*.ts`
  - `backend/src/workflows/validators/*.ts`
- Frontend:
  - `frontend/src/components/workflows/Activation.tsx`

---

## Database Schema Changes

### Updated Models

```prisma
// ComponentRun - Add iteration tracking
model ComponentRun {
  // ... existing fields ...

  // NEW: Iteration tracking
  userPrompts          Int      @default(0)
  systemIterations     Int      @default(1)
  humanInterventions   Int      @default(0)
  iterationLog         Json
}

// WorkflowRun - Add aggregated metrics
model WorkflowRun {
  // ... existing fields ...

  // NEW: Aggregated iteration metrics
  totalUserPrompts     Int?
  totalIterations      Int?
  totalInterventions   Int?
  avgPromptsPerComponent Float?
}

// Story - Add defect tracking
model Story {
  // ... existing fields ...

  // NEW: Defect leakage tracking
  defectsIntroduced    Defect[]  @relation("DefectsIntroducedByStory")
  defectsFound         Defect[]  @relation("DefectsFoundInStory")
  defectLeakageCount   Int       @default(0)
}
```

### New Models

```prisma
// Component - Generic building block
model Component {
  id                    String   @id @default(uuid())
  projectId             String
  name                  String
  description           String?

  inputInstructions     String   @db.Text
  operationInstructions String   @db.Text
  outputInstructions    String   @db.Text

  config                Json
  tools                 String[]
  subtaskConfig         Json?
  onFailure             String

  tags                  String[]
  active                Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  project               Project  @relation(fields: [projectId], references: [id])
  componentRuns         ComponentRun[]

  @@index([projectId])
  @@index([tags])
}

// CoordinatorAgent - Intelligent orchestrator
model CoordinatorAgent {
  id                      String   @id @default(uuid())
  projectId               String
  name                    String
  description             String
  domain                  String

  coordinatorInstructions String   @db.Text

  config                  Json
  tools                   String[]
  decisionStrategy        String
  componentIds            String[]

  active                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  project                 Project  @relation(fields: [projectId], references: [id])
  workflows               Workflow[]
  workflowRuns            WorkflowRun[]

  @@index([projectId])
  @@index([domain])
}

// Workflow - Coordinator + Trigger
model Workflow {
  id               String            @id @default(uuid())
  projectId        String
  coordinatorId    String
  name             String
  description      String?
  version          String            @default("v1.0")

  triggerConfig    Json

  active           Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  project          Project           @relation(fields: [projectId], references: [id])
  coordinator      CoordinatorAgent  @relation(fields: [coordinatorId], references: [id])
  workflowRuns     WorkflowRun[]
  stories          Story[]

  @@index([projectId])
  @@index([coordinatorId])
  @@index([active])
}

// Defect - Bug tracking with origin story
model Defect {
  id                   String    @id @default(uuid())
  projectId            String
  key                  String    @unique
  title                String
  description          String
  severity             String

  foundInStoryId       String?
  introducedByStoryId  String?
  confirmedByUserId    String?

  introducedByWorkflowRunId  String?
  introducedByComponentId    String?

  status               String
  confirmedAt          DateTime?
  fixedAt              DateTime?

  project              Project   @relation(fields: [projectId], references: [id])
  foundInStory         Story?    @relation("DefectsFoundInStory", fields: [foundInStoryId], references: [id])
  introducedByStory    Story?    @relation("DefectsIntroducedByStory", fields: [introducedByStoryId], references: [id])
  introducedByWorkflowRun  WorkflowRun?  @relation(fields: [introducedByWorkflowRunId], references: [id])
  introducedByComponent    Component?    @relation(fields: [introducedByComponentId], references: [id])

  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([foundInStoryId])
  @@index([introducedByStoryId])
  @@index([status])
}

// ActiveWorkflow - Track activated workflows
model ActiveWorkflow {
  id              String   @id @default(uuid())
  projectId       String
  workflowId      String
  version         String
  activatedAt     DateTime @default(now())
  activatedBy     String
  filesGenerated  String[]
  status          String
  autoSync        Boolean  @default(false)

  project         Project  @relation(fields: [projectId], references: [id])
  workflow        Workflow @relation(fields: [workflowId], references: [id])

  @@unique([projectId])
  @@index([workflowId])
}

// MetricsAggregation - Pre-calculated metrics
model MetricsAggregation {
  id                String    @id @default(uuid())
  aggregationType   String
  aggregationDate   DateTime
  projectId         String

  metrics           Json

  lastCalculatedAt  DateTime
  calculationTime   Int

  project           Project  @relation(fields: [projectId], references: [id])

  @@index([projectId, aggregationType, aggregationDate])
}
```

---

## MCP Tools to Implement

### Component Management
- [ ] `create_component`
- [ ] `update_component`
- [ ] `list_components`
- [ ] `get_component`
- [ ] `delete_component`
- [ ] `test_component`

### Coordinator Management
- [ ] `create_coordinator`
- [ ] `update_coordinator`
- [ ] `list_coordinators`
- [ ] `get_coordinator`
- [ ] `delete_coordinator`
- [ ] `test_coordinator`

### Workflow Management
- [ ] `create_workflow`
- [ ] `update_workflow`
- [ ] `list_workflows`
- [ ] `get_workflow`
- [ ] `delete_workflow`
- [ ] `activate_workflow` ⭐
- [ ] `deactivate_workflow`
- [ ] `sync_workflow`

### Workflow Execution
- [ ] `execute_workflow` ⭐
- [ ] `invoke_component`
- [ ] `get_workflow_state`
- [ ] `get_component_output`
- [ ] `pause_workflow`
- [ ] `cancel_workflow`
- [ ] `resume_workflow`

### Defect Tracking
- [ ] `create_defect`
- [ ] `link_defect_to_story`
- [ ] `suggest_defect_origin` ⭐
- [ ] `get_defect_leakage_metrics`

### Metrics
- [ ] `get_workflow_metrics`
- [ ] `get_component_metrics`
- [ ] `get_coordinator_metrics`
- [ ] `recalculate_metrics`
- [ ] `get_benchmarks`

---

## Testing Strategy

### Unit Tests
- [ ] Component service tests
- [ ] Coordinator service tests
- [ ] Workflow service tests
- [ ] Execution engine tests
- [ ] Defect analyzer tests
- [ ] Metrics aggregation tests

### Integration Tests
- [ ] Workflow execution end-to-end
- [ ] Defect origin detection
- [ ] Metrics aggregation pipeline
- [ ] S3 artifact storage

### E2E Tests
- [ ] Create component → Create coordinator → Create workflow → Execute
- [ ] Defect creation → Origin suggestion → User confirmation
- [ ] Workflow activation → Claude Code integration

---

## Dependencies

### Backend
- AWS SDK (S3 integration)
- PDFKit (PDF export)
- Bull (background jobs for aggregation)

### Frontend
- React DnD (drag-and-drop for component library)
- Monaco Editor (code diff viewer)
- Recharts (metrics visualization)

---

## Progress Tracking

**Phase 1**: ✅ Completed (100% - Database schema & migration)
**Phase 2**: ✅ Completed (100% - Backend APIs + Frontend UI)
**Phase 3**: ⏸️ Deferred (Will implement after Phase 7)
**Phase 4**: ⏸️ Next After Phase 7 (Workflow comparisons & analytics)
**Phase 5**: ⏸️ Not Started
**Phase 6**: ⏸️ Deferred (Will implement with Phase 3)
**Phase 7**: 🔄 In Progress (Claude Code Integration - CURRENT PRIORITY)

**Overall Progress**: 35% (Backend + Frontend complete, starting Claude Code integration)

**Implementation Strategy**:
1. ✅ Phase 1 + 2: Foundation complete
2. 🔄 Phase 7: Enable workflow activation in Claude Code (CURRENT)
3. ⏭️ Phase 4: Results & workflow comparison analytics (NEXT)
4. ⏭️ Phase 3 + 6: Live execution engine & monitoring (LATER)

---

## Next Steps (Phase 7: Claude Code Integration)

1. ✅ Create implementation plan
2. ✅ Update Prisma schema
3. ✅ Create migration SQL
4. ✅ Set up backend module structure (components, coordinators, workflows)
5. ✅ Create backend service classes
6. ✅ Implement Component CRUD API endpoints
7. ✅ Implement Coordinator CRUD API endpoints
8. ✅ Implement Workflow CRUD API endpoints
9. ✅ Build frontend UI for component/coordinator/workflow management
10. 🔄 Design MCP server architecture for workflow activation
11. ⏭️ Implement agent file generators (coordinator + component)
12. ⏭️ Build workflow validation system
13. ⏭️ Create MCP tools (activate_workflow, deactivate_workflow, sync_workflow)
14. ⏭️ Add frontend activation UI
15. ⏭️ Test end-to-end workflow activation flow

---

## Notes & Decisions

- **2025-11-12 13:00**: Initial plan created based on UC-MVP-001 through UC-MVP-009
- **2025-11-12 13:30**: User requirements captured:
  - Iteration/prompt tracking required
  - Defect leakage tracking required
  - Story view should show agent runs as subtasks
  - All workflow KPIs important (runtime, cost, tokens, LOC, iterations, prompts, coverage, defects)
  - S3 for artifact storage (no retention policy)
  - Pre-aggregated metrics (manual recalculation option)
  - Industry benchmarks required
  - One active workflow per project at a time
  - Auto-update notifications when workflow changes in UI
- **2025-11-12 14:00**: Phase 1 completed - Database schema updates:
  - Updated Story and Subtask models with new relations
  - Created 7 new models: Component, CoordinatorAgent, Workflow, WorkflowRun, ComponentRun, DefectNew, ActiveWorkflow, MetricsAggregation
  - Added RunStatus enum for workflow execution states
  - Created migration SQL with all DDL statements
  - Schema includes: iteration tracking, user prompts, defect leakage, S3 artifact references
  - Ready for backend service implementation
- **2025-11-12 15:30**: Phase 2 completed - Backend + Frontend implementation:
  - Full CRUD APIs for Components, Coordinators, Workflows
  - JWT authentication, Swagger docs, usage statistics
  - Frontend pages: ComponentLibraryView, CoordinatorLibraryView, WorkflowManagementView
  - Search, filtering, activation controls, responsive design
- **2025-11-12 [CURRENT]**: Strategy decision - Revised implementation order:
  - **New approach**: Phase 7 → Phase 4 → Phase 3+6 (instead of sequential 1-7)
  - **Rationale**: Deliver Claude Code integration first for immediate value
  - Users can activate & manually execute workflows before auto-execution engine
  - Workflow comparison analytics come next to help optimize workflow designs
  - Live execution engine deferred to final phase
