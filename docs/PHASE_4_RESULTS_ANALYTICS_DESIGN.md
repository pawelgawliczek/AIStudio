# Phase 4: Results & Analytics - Design Document

**Status**: In Progress
**Created**: 2025-11-12
**Updated**: 2025-11-12
**Based On**: UC-METRICS-003, UC-METRICS-004

---

## Overview

Phase 4 implements workflow execution results tracking and performance analytics to help users evaluate and compare different workflow approaches. This enables data-driven decisions about which workflows to use for different types of tasks.

---

## Goals

1. **Track execution results** - Capture all workflow and component runs with comprehensive metrics
2. **View detailed results** - Show per-story execution timelines with all agent runs
3. **Compare workflows** - Week-over-week comparison of workflow performance
4. **Aggregate metrics** - Pre-calculate performance metrics for fast analytics
5. **Export results** - PDF, JSON, and Markdown export for sharing and documentation

---

## Terminology Mapping

Our implementation uses different terminology than the use cases:

| Use Case Term | Our Implementation | Description |
|---------------|-------------------|-------------|
| **Agent** | **Component** | Individual executable unit (linter, security scanner, etc.) |
| **Framework** | **Workflow** | Set of components orchestrated by a coordinator |
| **Agent Run** | **ComponentRun** | Single execution of a component |
| **Framework Execution** | **WorkflowRun** | Single execution of a workflow |
| **Story** | **Story** | Work item (maps 1:1) |
| **Epic** | **Epic** | Collection of stories (maps 1:1) |

---

## Architecture

### Database Models (Already Defined in Phase 1)

#### WorkflowRun
```prisma
model WorkflowRun {
  id                      String   @id @default(uuid())
  projectId               String
  workflowId              String
  storyId                 String?
  epicId                  String?

  // Timing
  startedAt               DateTime
  finishedAt              DateTime?
  durationSeconds         Int?

  // Aggregated metrics (calculated from component runs)
  totalUserPrompts        Int?
  totalIterations         Int?
  totalInterventions      Int?
  avgPromptsPerComponent  Float?
  totalTokensInput        Int?
  totalTokensOutput       Int?
  totalTokens             Int?
  totalLocGenerated       Int?

  // Cost
  estimatedCost           Float?

  // Status
  status                  RunStatus
  errorMessage            String?

  // Relations
  project                 Project  @relation(fields: [projectId], references: [id])
  workflow                Workflow @relation(fields: [workflowId], references: [id])
  story                   Story?   @relation(fields: [storyId], references: [id])
  epic                    Epic?    @relation(fields: [epicId], references: [id])
  componentRuns           ComponentRun[]
  coordinatorDecisions    Json? // Log of coordinator decisions

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@index([projectId])
  @@index([workflowId])
  @@index([storyId])
  @@index([status])
  @@index([startedAt])
}
```

#### ComponentRun
```prisma
model ComponentRun {
  id                    String   @id @default(uuid())
  workflowRunId         String
  componentId           String
  subtaskId             String?

  // Timing
  startedAt             DateTime
  finishedAt            DateTime?
  durationSeconds       Int?

  // Iteration tracking
  userPrompts           Int      @default(0)
  systemIterations      Int      @default(1)
  humanInterventions    Int      @default(0)
  iterationLog          Json     // Detailed log of each iteration

  // Tokens
  tokensInput           Int?
  tokensOutput          Int?
  totalTokens           Int?

  // Code metrics
  locGenerated          Int?     // From linked commits
  filesModified         String[] // Paths of modified files
  commits               String[] // Git commit hashes

  // Calculated efficiency metrics
  tokensPerLoc          Float?
  locPerPrompt          Float?
  runtimePerLoc         Float?
  runtimePerToken       Float?

  // Status
  status                RunStatus
  errorMessage          String?
  success               Boolean  @default(false)

  // Output
  output                String?  @db.Text
  artifacts             Json?    // References to S3 artifacts

  // Relations
  workflowRun           WorkflowRun @relation(fields: [workflowRunId], references: [id])
  component             Component   @relation(fields: [componentId], references: [id])
  subtask               Subtask?    @relation(fields: [subtaskId], references: [id])

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([workflowRunId])
  @@index([componentId])
  @@index([status])
}

enum RunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

#### MetricsAggregation
```prisma
model MetricsAggregation {
  id                String    @id @default(uuid())
  aggregationType   String    // 'daily', 'weekly', 'monthly', 'workflow', 'component'
  aggregationDate   DateTime  // For time-based aggregations
  projectId         String
  workflowId        String?   // For workflow-specific aggregations
  componentId       String?   // For component-specific aggregations

  // Aggregated data (flexible JSON)
  metrics           Json

  // Metadata
  lastCalculatedAt  DateTime
  calculationTime   Int       // milliseconds
  recordCount       Int       // number of runs aggregated

  project           Project  @relation(fields: [projectId], references: [id])
  workflow          Workflow? @relation(fields: [workflowId], references: [id])
  component         Component? @relation(fields: [componentId], references: [id])

  @@unique([projectId, aggregationType, aggregationDate, workflowId, componentId])
  @@index([projectId, aggregationType, aggregationDate])
}
```

---

## UI Components

### 1. Workflow Results View (UC-METRICS-003)

**Route**: `/workflows/:workflowId/runs/:runId/results`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Workflow Run Results: Code Review Workflow              │
│ Story ST-42: Implement password reset flow              │
├─────────────────────────────────────────────────────────┤
│ [Summary] [Timeline] [Components] [Decisions] [Export]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ SUMMARY TAB:                                             │
│ ┌─────────────────────────────────────────────────┐     │
│ │ Status: ✓ Completed                             │     │
│ │ Duration: 2h 48min                              │     │
│ │ Total Tokens: 74,100 (Input: 46,700, Output: 27,400) │
│ │ LOC Generated: 570 lines                        │     │
│ │ Component Runs: 7                               │     │
│ │ Iterations: 42 prompts                          │     │
│ │ Cost: $7.41                                     │     │
│ └─────────────────────────────────────────────────┘     │
│                                                          │
│ TIMELINE TAB:                                            │
│ Component Execution Timeline (7 runs)                    │
│ ┌──────────────────────────────────────────────┐        │
│ │ [1] Linter - Requirements Check              │        │
│ │     Duration: 25min | Tokens: 9K | LOC: 0    │        │
│ │     Status: ✓ Success                        │        │
│ │     [View Details]                            │        │
│ ├──────────────────────────────────────────────┤        │
│ │ [2] Security Scanner                         │        │
│ │     Duration: 15min | Tokens: 6.6K | LOC: 0  │        │
│ │     ...                                       │        │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ COMPONENTS TAB:                                          │
│ Component Breakdown by Type                              │
│ ┌────────────┬─────┬────────┬──────────┬─────────┐      │
│ │ Component  │Runs │ Tokens │ Runtime  │ LOC Gen │      │
│ ├────────────┼─────┼────────┼──────────┼─────────┤      │
│ │ Linter     │  1  │ 9,000  │  25 min  │    0    │      │
│ │ Security   │  3  │18,900  │  46 min  │    0    │      │
│ │ Implementer│  2  │42,700  │  83 min  │  483    │      │
│ │ Tester     │  1  │ 6,500  │  20 min  │   87    │      │
│ └────────────┴─────┴────────┴──────────┴─────────┘      │
│                                                          │
│ EXPORT:                                                  │
│ [Export as PDF] [Export as JSON] [Export as Markdown]   │
└─────────────────────────────────────────────────────────┘
```

**Components**:
- `WorkflowResultsView.tsx` - Main page
- `ExecutionSummary.tsx` - Summary card
- `ComponentTimeline.tsx` - Timeline visualization
- `ComponentBreakdown.tsx` - Table of component runs
- `CoordinatorDecisionLog.tsx` - Coordinator decisions
- `IterationBreakdown.tsx` - Iteration details per component
- `ExportMenu.tsx` - Export options

---

### 2. Performance Dashboard (UC-METRICS-004)

**Route**: `/analytics/performance`

**Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│ Performance Dashboard                                         │
├──────────────────────────────────────────────────────────────┤
│ Filters:                                                      │
│ [Project: All ▼] [Workflow: All ▼] [Weeks: Last 8 ▼]        │
│ [Complexity: All ▼] [Baseline: Project Avg ▼]               │
├──────────────────────────────────────────────────────────────┤
│ [Workflows] [Components] [Trends] [Comparisons]              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ WORKFLOWS TAB:                                                │
│ Weekly Performance Summary                                    │
│ ┌────────┬────────┬────────┬────────┬───────┬──────────┐    │
│ │ Week   │Stories │ Tokens │Defects │  Cost │ Velocity │    │
│ ├────────┼────────┼────────┼────────┼───────┼──────────┤    │
│ │ Week 44│   8 ✓  │ 58K ↓  │ 0.6 ↓  │$5.80↓ │ 92/100 ✓ │    │
│ │ Week 43│   6    │ 64K    │ 0.8    │$6.40  │ 88/100   │    │
│ │ Week 42│   7    │ 72K ⚠  │ 1.2 ⚠  │$7.20⚠ │ 75/100   │    │
│ │ Avg    │  6.5   │ 62K    │ 1.0    │$6.20  │ 82/100   │    │
│ └────────┴────────┴────────┴────────┴───────┴──────────┘    │
│                                                               │
│ Detailed Efficiency Metrics                                   │
│ ┌─────────┬──────────┬─────────┬─────────┬─────────┐        │
│ │ Week    │Tokens/LOC│LOC/Promp│Runtime/ │ Churn % │        │
│ │         │          │         │   LOC   │         │        │
│ ├─────────┼──────────┼─────────┼─────────┼─────────┤        │
│ │ Week 44 │ 136 ↓ ✓  │ 16.7 ↑  │ 5.5 min │  15% ✓  │        │
│ │ Week 43 │ 168      │ 14.2    │ 6.2 min │  17%    │        │
│ │ Week 42 │ 203 ⚠    │ 11.5 ↓  │ 7.8 min │  22% ⚠  │        │
│ └─────────┴──────────┴─────────┴─────────┴─────────┘        │
│                                                               │
│ TRENDS TAB:                                                   │
│ [Line chart showing stories delivered over time]              │
│ [Line chart showing quality metrics trend]                    │
│ [Line chart showing efficiency metrics trend]                 │
│                                                               │
│ COMPARISONS TAB:                                              │
│ Compare: [Workflow A ▼] vs [Workflow B ▼]                    │
│ Complexity: [Medium ▼]  Stories: [42 vs 38]                  │
│ [Side-by-side metrics comparison table]                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components**:
- `PerformanceDashboard.tsx` - Main page with tabs
- `WorkflowPerformanceTab.tsx` - Weekly workflow metrics
- `ComponentPerformanceTab.tsx` - Component-level analytics
- `TrendsTab.tsx` - Time-series charts
- `ComparisonsTab.tsx` - Workflow comparison
- `MetricWithBenchmark.tsx` - Metric display with industry benchmark
- `WeeklySummaryTable.tsx` - Table of weekly metrics
- `EfficiencyMetricsTable.tsx` - Detailed efficiency metrics
- `VelocityScoreCard.tsx` - Velocity score calculation breakdown

---

## Backend Implementation

### 1. Workflow Runs Module

**Directory**: `backend/src/workflow-runs/`

**Files**:
- `workflow-runs.controller.ts` - API endpoints
- `workflow-runs.service.ts` - Business logic
- `workflow-runs.module.ts` - NestJS module
- `dto/create-workflow-run.dto.ts`
- `dto/update-workflow-run.dto.ts`
- `dto/workflow-run-response.dto.ts`

**Endpoints**:
```typescript
POST   /api/projects/:projectId/workflow-runs              // Create run
GET    /api/projects/:projectId/workflow-runs              // List runs
GET    /api/projects/:projectId/workflow-runs/:id          // Get run
PUT    /api/projects/:projectId/workflow-runs/:id          // Update run
DELETE /api/projects/:projectId/workflow-runs/:id          // Delete run
GET    /api/projects/:projectId/workflow-runs/:id/results  // Get detailed results
POST   /api/projects/:projectId/workflow-runs/:id/export   // Export (PDF/JSON/MD)
```

---

### 2. Metrics Module

**Directory**: `backend/src/metrics/`

**Files**:
- `metrics.controller.ts` - API endpoints
- `metrics.service.ts` - Metrics calculation
- `aggregation.service.ts` - Pre-aggregation logic
- `benchmarks.service.ts` - Industry benchmarks
- `metrics.module.ts` - NestJS module
- `dto/` - DTOs for requests/responses

**Endpoints**:
```typescript
GET  /api/projects/:projectId/metrics/workflows                    // Workflow performance
GET  /api/projects/:projectId/metrics/components                   // Component performance
GET  /api/projects/:projectId/metrics/trends                       // Time-series trends
GET  /api/projects/:projectId/metrics/comparisons                  // Workflow comparisons
GET  /api/projects/:projectId/metrics/weekly                       // Weekly aggregations
POST /api/projects/:projectId/metrics/recalculate                  // Manual recalc
GET  /api/metrics/benchmarks                                       // Industry benchmarks
```

---

### 3. Export Module

**Directory**: `backend/src/exports/`

**Files**:
- `pdf-generator.service.ts` - Generate PDF reports
- `markdown-generator.service.ts` - Generate Markdown reports
- `json-serializer.service.ts` - Export as JSON
- `exports.module.ts` - NestJS module

**Export Formats**:

**JSON**:
```json
{
  "workflowRun": {
    "id": "uuid",
    "workflow": "Code Review Workflow",
    "story": "ST-42",
    "status": "COMPLETED",
    "metrics": { ... }
  },
  "componentRuns": [ ... ],
  "summary": { ... }
}
```

**Markdown**:
```markdown
# Workflow Run Results: Code Review Workflow

**Story**: ST-42 - Implement password reset flow
**Status**: ✓ Completed
**Duration**: 2h 48min

## Summary
- Total Tokens: 74,100
- LOC Generated: 570 lines
- Component Runs: 7
- Cost: $7.41

## Component Timeline
...
```

**PDF**: Professional formatted report with charts and tables

---

### 4. Aggregation System

**Background Job**: Nightly aggregation job

**Aggregation Types**:
1. **Daily** - Aggregate all runs from previous day
2. **Weekly** - Aggregate by week (Monday-Sunday)
3. **Monthly** - Aggregate by month
4. **Workflow-specific** - Per-workflow aggregations
5. **Component-specific** - Per-component aggregations

**Metrics Calculated**:
```typescript
interface AggregatedMetrics {
  // Counts
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;

  // Time
  avgDuration: number;
  totalDuration: number;

  // Tokens
  avgTokens: number;
  totalTokens: number;
  avgTokensPerLoc: number;

  // Code
  totalLoc: number;
  avgLocPerStory: number;
  avgLocPerPrompt: number;

  // Efficiency
  avgRuntimePerLoc: number;
  avgRuntimePerToken: number;
  avgPromptsPerRun: number;

  // Cost
  avgCost: number;
  totalCost: number;

  // Quality (future)
  defectsPerStory?: number;
  codeChurnPercent?: number;
  testCoverage?: number;
}
```

---

## Industry Benchmarks

**File**: `backend/data/industry-benchmarks.json`

```json
{
  "tokensPerLoc": {
    "excellent": 100,
    "good": 150,
    "average": 200,
    "poor": 300
  },
  "locPerPrompt": {
    "excellent": 20,
    "good": 15,
    "average": 10,
    "poor": 5
  },
  "runtimePerLoc": {
    "excellent": 5,
    "good": 10,
    "average": 15,
    "poor": 20
  },
  "defectsPerStory": {
    "excellent": 0.5,
    "good": 1.0,
    "average": 2.0,
    "poor": 3.0
  }
}
```

---

## Implementation Phases

### Phase 4.1: Run Tracking (Week 1)
- Implement WorkflowRun and ComponentRun models
- Create workflow-runs backend module
- Add API endpoints for run CRUD
- Build basic run tracking UI

### Phase 4.2: Metrics Aggregation (Week 1-2)
- Implement metrics service
- Create aggregation logic
- Add background job for nightly aggregation
- Industry benchmarks data

### Phase 4.3: Results View (Week 2)
- Build WorkflowResultsView component
- Component timeline visualization
- Execution summary
- Export functionality (JSON, Markdown)

### Phase 4.4: Performance Dashboard (Week 2-3)
- Build PerformanceDashboard component
- Weekly summary tables
- Trend charts (using Recharts)
- Workflow comparison view

### Phase 4.5: Advanced Features (Week 3)
- PDF export
- AI-generated insights (optional)
- Advanced filtering
- Velocity score calculation

---

## Success Criteria

- [ ] Users can view detailed results for any workflow run
- [ ] Weekly performance metrics are accurate and up-to-date
- [ ] Workflow comparison shows clear differences
- [ ] Export functionality produces professional reports
- [ ] Metrics are pre-aggregated for fast loading
- [ ] Industry benchmarks shown for context
- [ ] All metrics match UC-METRICS-003 and UC-METRICS-004 specifications

---

## Next Steps

1. ✅ Review use cases and create design document
2. ⏭️ Implement WorkflowRun and ComponentRun backend
3. ⏭️ Create workflow-runs API endpoints
4. ⏭️ Build metrics aggregation system
5. ⏭️ Implement Workflow Results View
6. ⏭️ Build Performance Dashboard
7. ⏭️ Add export functionality
8. ⏭️ Test with real data

---

## Notes

- Phase 4 does NOT include live execution - workflows are activated manually and results are logged after completion
- We'll use mock data initially for testing the UI components
- Real execution tracking will be added in Phase 3 (execution engine)
- For now, users can manually create workflow runs via the API
- S3 integration for artifacts is optional and can be added later
