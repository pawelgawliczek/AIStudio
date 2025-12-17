# Domain Model

**Version:** 1.0
**Last Updated:** 2025-12-17
**Epic:** ST-279

## Overview

The Domain Model defines the core business entities that represent projects, work items, and requirements in the AI Studio system. These entities form the foundation for workflow orchestration, agent execution tracking, and quality metrics.

## Core Entities

### Entity Relationship Diagram

```
┌─────────────┐
│   Project   │
└──────┬──────┘
       │
       ├───┬─────────────┬──────────────┬───────────────┐
       │   │             │              │               │
       ▼   ▼             ▼              ▼               ▼
   ┌──────┐ ┌─────┐  ┌────────┐  ┌──────────┐  ┌─────────┐
   │ Epic │ │Story│  │UseCase │  │ Workflow │  │Component│
   └──┬───┘ └──┬──┘  └───┬────┘  └────┬─────┘  └─────────┘
      │        │         │             │
      │        └─────────┴─────┬───────┘
      │                        │
      ▼                        ▼
┌──────────┐          ┌──────────────┐
│ Subtask  │          │ WorkflowRun  │
└──────────┘          └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ComponentRun  │
                      └──────────────┘
```

## Data Structures

### Project (schema.prisma L39-76)

Top-level container for all work items and configuration.

```typescript
{
  id: string;
  name: string;                    // Unique project name
  description?: string;
  repositoryUrl?: string;
  localPath?: string;              // Docker container path
  hostPath?: string;               // Host filesystem path for transcripts
  status: 'active' | 'archived';
  taxonomy?: string[];             // ST-207: Controlled vocabulary for use cases
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Relations:**
- Has many: Epic, Story, UseCase, Workflow, Component
- Has many: TestCase, Commit, Release, CodeMetrics

### Epic (schema.prisma L107-127)

High-level feature grouping that spans multiple stories.

```typescript
{
  id: string;
  projectId: string;
  key: string;                     // e.g., "EP-1", unique within project
  title: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'done' | 'archived';
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Story (schema.prisma L129-206)

Individual work item that flows through the workflow system.

```typescript
{
  id: string;
  projectId: string;
  epicId?: string;
  key: string;                     // e.g., "ST-123", unique within project
  type: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  title: string;
  description?: string;
  summary?: string;                // AI-generated 2-sentence summary (max 300 chars)
  status: StoryStatus;
  priority: number;

  // Complexity & Impact
  businessImpact?: number;         // 1-10 scale
  businessComplexity?: number;     // 1-10 scale
  technicalComplexity?: number;    // 1-10 scale
  estimatedTokenCost?: number;

  // Workflow Assignment
  assignedFrameworkId?: string;    // DEPRECATED: Use assignedWorkflowId
  assignedWorkflowId?: string;

  // Analysis fields (DEPRECATED - use Artifact system instead)
  contextExploration?: string;     // @deprecated ST-152
  baAnalysis?: string;             // @deprecated ST-152
  designerAnalysis?: string;       // @deprecated ST-152
  architectAnalysis?: string;      // @deprecated ST-152

  metadata?: object;               // Aggregated metrics, framework info

  createdAt: Date;
  updatedAt: Date;
}
```

**Key Relations:**
- Belongs to: Project, Epic (optional)
- Has many: Subtask, Commit, WorkflowRun, Artifact

### Story Status Flow

```
backlog → planning → analysis → architecture → design →
implementation → review → qa → done
                          ↓
                       blocked (can return to any status)
```

### Subtask (schema.prisma L208-232)

Granular work item within a story, can be assigned to human or agent.

```typescript
{
  id: string;
  storyId: string;
  key?: string;                    // Optional key within story
  title: string;
  description?: string;
  assigneeType: 'agent' | 'human';
  assigneeId?: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  componentRunId?: string;         // Link to agent execution
  createdAt: Date;
  updatedAt: Date;
}
```

### UseCase (schema.prisma L303-322)

Functional requirement or user story with versioned content.

```typescript
{
  id: string;
  projectId: string;
  key: string;                     // Unique within project
  title: string;
  area?: string;                   // Screen/flow/feature area
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Relations:**
- Has many: UseCaseVersion (versioned content)
- Has many: StoryUseCaseLink (links to stories)
- Has many: TestCase
- Has many: FileUseCaseLink (links to code files)

### UseCaseVersion (schema.prisma L324-343)

Version history for use case content.

```typescript
{
  id: string;
  useCaseId: string;
  version: number;
  summary?: string;
  content: string;                 // Markdown or JSON
  embedding?: vector(1536);        // pgvector for semantic search
  createdById: string;
  createdAt: Date;
  linkedStoryId?: string;          // Story that created this version
  linkedDefectId?: string;         // Defect that prompted this version
}
```

### Artifact (schema.prisma L1780-1813)

Story-scoped artifact with version history (ST-214). Replaces deprecated story analysis fields.

```typescript
{
  id: string;
  definitionId: string;
  storyId: string;
  workflowRunId?: string;

  content: string;                 // Full content or S3 URL
  contentPreview?: string;         // First 500 chars for token efficiency
  contentHash?: string;            // SHA256 for change detection
  contentType: string;             // MIME type
  size: number;
  currentVersion: number;          // Latest version number
  lastUpdatedRunId?: string;       // WorkflowRun that last updated this

  // Provenance
  createdByComponentId?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

**Artifact Types:**
- `markdown`: Documents (architecture, design, plans)
- `json`: Structured data (analysis results, metrics)
- `code`: Generated code snippets
- `report`: Test reports, quality metrics
- `image`: Diagrams, screenshots
- `other`: Miscellaneous artifacts

## Flows

### Story Creation Flow

1. User creates story via MCP tool `create_story`
2. System assigns story key (e.g., ST-123)
3. Story enters `backlog` status
4. PM assigns workflow via `assignedWorkflowId`
5. Story moves to `planning` status

### Story Execution Flow

1. User starts workflow via `start_team_run`
2. System creates WorkflowRun record
3. Orchestrator executes workflow states in sequence
4. Each state spawns component agent (ComponentRun created)
5. Component writes artifacts (PM plan, architecture doc, etc.)
6. Story status updates based on workflow progress
7. Story reaches `done` status when workflow completes

### Use Case to Story Linking

1. BA creates use cases via `create_use_case`
2. PM links use cases to stories via StoryUseCaseLink
3. Relationship types:
   - `implements`: Story implements this use case
   - `modifies`: Story modifies existing functionality
   - `deprecates`: Story removes functionality

### File to Use Case Mapping

1. System analyzes commits to identify file changes
2. AI infers which use cases are affected by file changes
3. FileUseCaseLink created with confidence score (0.0-1.0)
4. Mapping sources: commit_derived, ai_inferred, manual, pattern_matched, import_analysis

## Troubleshooting

### Story status not updating

**Symptom:** Story remains in old status after workflow state completes.

**Diagnosis:**
```sql
SELECT id, key, status, "assignedWorkflowId" FROM stories WHERE key = 'ST-XXX';
SELECT id, status, "currentStateId" FROM workflow_runs WHERE "storyId" = '<story-uuid>';
```

**Solution:** Status updates happen in `advance_step`. Ensure workflow state transitions are executed correctly.

### Missing artifacts for story

**Symptom:** Expected artifacts (plan, architecture doc) not visible in story detail.

**Diagnosis:**
```sql
SELECT a.*, ad.key, ad.name
FROM artifacts a
JOIN artifact_definitions ad ON a."definitionId" = ad.id
WHERE a."storyId" = '<story-uuid>';
```

**Solution:** Ensure components are configured with artifact write permissions via ArtifactAccess table.

### Use case not linked to files

**Symptom:** Use case shows no related code files despite implementation.

**Diagnosis:**
```sql
SELECT * FROM file_use_case_links
WHERE "useCaseId" = '<use-case-uuid>'
ORDER BY confidence DESC;
```

**Solution:** File links are created via commit analysis. Ensure commits reference use case keys in commit messages.

## References

- ST-279: Living Documentation System
- ST-152: Artifact Management (replaces story analysis fields)
- ST-207: Taxonomy for use case areas
- ST-214: Story-scoped artifacts with version history

## Changelog

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented core entities: Project, Epic, Story, Subtask, UseCase, Artifact
- Added entity relationship diagram
- Documented story status flow and execution patterns
