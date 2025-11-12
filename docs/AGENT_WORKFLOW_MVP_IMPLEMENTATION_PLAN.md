# Agent Workflow MVP - Implementation Plan

**Last Updated**: 2025-11-12
**Status**: In Progress - Phase 1 Started

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

### Phase 2: Component & Coordinator Management
**Goal**: Web UI for creating and managing components and coordinators

#### UC-MVP-001: Create Generic Component ✅ APPROVED
- [ ] Backend API endpoints
  - [ ] POST /api/components - Create component
  - [ ] GET /api/components - List components
  - [ ] GET /api/components/:id - Get component
  - [ ] PUT /api/components/:id - Update component
  - [ ] DELETE /api/components/:id - Delete component
  - [ ] POST /api/components/:id/test - Test component
- [ ] Frontend components
  - [ ] ComponentLibraryView.tsx
  - [ ] CreateComponentModal.tsx
  - [ ] ComponentEditor.tsx (3 instruction sets)
  - [ ] ComponentTestSandbox.tsx

#### UC-MVP-002: Edit Existing Component ✅ APPROVED
- [ ] Backend API endpoints
  - [ ] PUT /api/components/:id - Update component
  - [ ] POST /api/components/:id/version - Create new version
  - [ ] GET /api/components/:id/versions - List versions
  - [ ] GET /api/components/:id/usage - Get usage statistics
- [ ] Frontend components
  - [ ] EditComponentModal.tsx
  - [ ] ComponentVersionHistory.tsx
  - [ ] ComponentUsageStats.tsx

#### UC-MVP-003: Create Coordinator Agent ✅ APPROVED
- [ ] Backend API endpoints
  - [ ] POST /api/coordinators - Create coordinator
  - [ ] GET /api/coordinators - List coordinators
  - [ ] GET /api/coordinators/:id - Get coordinator
  - [ ] PUT /api/coordinators/:id - Update coordinator
  - [ ] DELETE /api/coordinators/:id - Delete coordinator
  - [ ] POST /api/coordinators/:id/test - Test coordinator logic
- [ ] Frontend components
  - [ ] CoordinatorLibraryView.tsx
  - [ ] CreateCoordinatorModal.tsx
  - [ ] CoordinatorEditor.tsx
  - [ ] ComponentLibrarySelector.tsx
  - [ ] DecisionStrategySelector.tsx

#### UC-MVP-004: Create Workflow ✅ APPROVED
- [ ] Backend API endpoints
  - [ ] POST /api/workflows - Create workflow
  - [ ] GET /api/workflows - List workflows
  - [ ] GET /api/workflows/:id - Get workflow
  - [ ] PUT /api/workflows/:id - Update workflow
  - [ ] DELETE /api/workflows/:id - Delete workflow
  - [ ] POST /api/workflows/:id/activate - Activate workflow
  - [ ] POST /api/workflows/:id/deactivate - Deactivate workflow
- [ ] Frontend components
  - [ ] WorkflowListView.tsx
  - [ ] CreateWorkflowModal.tsx
  - [ ] WorkflowEditor.tsx
  - [ ] TriggerConfigForm.tsx

**Files to Create**:
- Backend:
  - `backend/src/components/components.controller.ts`
  - `backend/src/components/components.service.ts`
  - `backend/src/components/dto/*.dto.ts`
  - `backend/src/coordinators/coordinators.controller.ts`
  - `backend/src/coordinators/coordinators.service.ts`
  - `backend/src/coordinators/dto/*.dto.ts`
  - `backend/src/workflows/workflows.controller.ts`
  - `backend/src/workflows/workflows.service.ts`
  - `backend/src/workflows/dto/*.dto.ts`
- Frontend:
  - `frontend/src/pages/ComponentLibrary.tsx`
  - `frontend/src/pages/CoordinatorLibrary.tsx`
  - `frontend/src/pages/WorkflowManagement.tsx`
  - `frontend/src/components/components/*.tsx`
  - `frontend/src/components/coordinators/*.tsx`
  - `frontend/src/components/workflows/*.tsx`

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

**Phase 1**: ✅ Completed (100% complete)
**Phase 2**: ⏸️ Not Started
**Phase 3**: ⏸️ Not Started
**Phase 4**: ⏸️ Not Started
**Phase 5**: ⏸️ Not Started
**Phase 6**: ⏸️ Not Started
**Phase 7**: ⏸️ Not Started

**Overall Progress**: 15% (Database schema complete, ready for backend implementation)

---

## Next Steps

1. ✅ Create implementation plan
2. ✅ Update Prisma schema
3. ✅ Create migration SQL
4. ⏳ Set up backend module structure (components, coordinators, workflows)
5. Create backend service classes
6. Implement Component CRUD API endpoints
7. Implement Coordinator CRUD API endpoints
8. Implement Workflow CRUD API endpoints
9. ...

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
