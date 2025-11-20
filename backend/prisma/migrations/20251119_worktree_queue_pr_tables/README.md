# ST-38: Database Schema - Worktree & Queue Management

**Epic**: EP-7 - Git Workflow Agent - Backend & MCP Tools
**Date**: 2025-11-19
**Status**: Implementation Complete

## Overview

This migration establishes the foundational data structures for automated git workflow management in AI Studio. It enables:

1. **Parallel Development**: Track multiple git worktrees per story
2. **Automated Testing**: Queue-based test orchestration
3. **PR Lifecycle Management**: Complete pull request tracking
4. **Workflow Phase Tracking**: Enhanced story progression visibility

## Schema Changes

### New Enums (4)

1. **WorktreeStatus**: `active | idle | cleaning | removed`
2. **QueueStatus**: `pending | running | passed | failed | cancelled | skipped`
3. **PRStatus**: `draft | open | approved | changes_requested | merged | closed | conflict`
4. **StoryPhase**: `context | ba | design | architecture | implementation | testing | review | done`

### New Tables (3)

#### 1. Worktree
Tracks git worktrees for isolated parallel development.

**Fields**:
- `id`: UUID (primary key)
- `story_id`: UUID (foreign key → stories)
- `branch_name`: String
- `worktree_path`: String (absolute path)
- `base_branch`: String (default: 'main')
- `status`: WorktreeStatus (default: 'active')
- `created_at`, `updated_at`: Timestamps

**Indexes**:
- `[story_id, status]` - Query worktrees by story and status
- `[status]` - Find all active/idle/cleaning worktrees
- `[branch_name]` - Lookup by branch

**Business Rules**:
- Multiple worktrees per story allowed
- CASCADE delete when story deleted
- Status transitions: `active ↔ idle → cleaning → removed`

#### 2. TestQueue
Queue-based story testing with priority management.

**Fields**:
- `id`: UUID (primary key)
- `story_id`: UUID (foreign key → stories)
- `position`: Integer (for FIFO ordering)
- `priority`: Integer (default: 0)
- `status`: QueueStatus (default: 'pending')
- `submitted_by`: String (user/agent ID)
- `test_results`: JSONB (nullable)
- `error_message`: String (nullable)
- `created_at`, `updated_at`: Timestamps

**Indexes**:
- `[status, position]` - Process queue in FIFO order
- `[status, priority]` - Process by priority override
- `[story_id]` - Find all queue entries for story
- `[submitted_by]` - Track submissions by user/agent

**Business Rules**:
- Process by priority DESC, then position ASC
- Use position gaps (100, 200, 300) for efficient insertion
- Multiple queue entries per story allowed (re-testing)

#### 3. PullRequest
GitHub/GitLab pull request lifecycle tracking.

**Fields**:
- `id`: UUID (primary key)
- `story_id`: UUID (foreign key → stories)
- `pr_number`: Integer
- `pr_url`: String
- `title`: String
- `description`: String (nullable)
- `status`: PRStatus (default: 'draft')
- `created_at`, `updated_at`: Timestamps

**Indexes**:
- `[story_id, status]` - Query PRs by story and status
- `[pr_number]` - GitHub webhook lookups
- `[status]` - Find all open/merged PRs

**Business Rules**:
- 1:N relationship (Story → PullRequest[])
- Both prNumber and prUrl required
- CASCADE delete when story deleted

### Story Model Extensions

**New Field**:
- `current_phase`: StoryPhase (nullable)
  - Tracks current workflow phase independent of status
  - Maps to analysis fields (context → contextExploration, etc.)
  - Nullable for backward compatibility

**New Relations**:
- `worktrees`: Worktree[]
- `testQueueEntries`: TestQueue[]
- `pullRequests`: PullRequest[]

## Data Model Relationships

```
Story (EXTENDED)
  ├─→ Worktree[] (1:N, CASCADE)
  ├─→ TestQueue[] (1:N, CASCADE)
  └─→ PullRequest[] (1:N, CASCADE)
```

## Migration Safety

### Zero-Downtime Migration
- All additions are new tables or nullable fields
- No existing data modified
- No breaking changes to existing functionality

### Backward Compatibility
- `currentPhase` is nullable (existing stories remain valid)
- All foreign key columns reference existing Story IDs
- New enums don't affect existing enums

### Rollback Safety
- Complete rollback plan provided
- No data loss on rollback (only new structures removed)

## Query Performance

### Expected Query Times (10K stories, 30K worktrees, 50K queue entries)
- Get worktrees for story: <10ms
- Get next queue entry: <20ms
- Find PR by prNumber: <5ms
- Get all active worktrees: <50ms

### Index Strategy
- Composite indexes for common queries
- Single indexes for foreign keys
- Query-optimized based on access patterns

## Example Usage

### Create Worktree
```typescript
await prisma.worktree.create({
  data: {
    storyId: 'story-uuid',
    branchName: 'feature/ST-38-db-schema',
    worktreePath: '/opt/stack/AIStudio/.worktrees/ST-38-feature',
    baseBranch: 'main'
  }
});
```

### Submit to Test Queue
```typescript
const maxPosition = await prisma.testQueue.aggregate({
  _max: { position: true }
});

await prisma.testQueue.create({
  data: {
    storyId: 'story-uuid',
    position: (maxPosition._max.position || 0) + 100,
    priority: 5,
    submittedBy: 'agent:git-workflow-001'
  }
});
```

### Create Pull Request
```typescript
await prisma.pullRequest.create({
  data: {
    storyId: 'story-uuid',
    prNumber: 142,
    prUrl: 'https://github.com/org/AIStudio/pull/142',
    title: 'feat(ST-38): Add database schema',
    status: 'draft'
  }
});
```

### Update Story Phase
```typescript
await prisma.story.update({
  where: { id: 'story-uuid' },
  data: { currentPhase: 'implementation' }
});
```

## Testing Strategy

### Unit Tests
- Worktree status transition validation
- Queue position calculation
- PR status lifecycle

### Integration Tests
- Foreign key cascade delete
- Index usage verification
- JSONB query performance

### E2E Tests
- Full workflow: Create story → Worktree → Queue → PR → Delete
- Verify cascade deletes work correctly

## Monitoring

### Key Metrics
- Active worktree count
- Queue depth (pending entries)
- Average queue wait time
- PR cycle time (created → merged)

### Health Checks
- Orphaned worktrees (DB vs filesystem)
- Stale queue entries (pending >7 days)
- PR status drift (DB vs GitHub)

## Next Steps

1. **Immediate**: Apply migration to dev/staging/production
2. **Phase 2**: Implement NestJS services (WorktreesModule, TestQueueModule, PullRequestsModule)
3. **Phase 3**: Git Workflow Agent integration
4. **Phase 4**: Automation & webhooks

## References

- **Architecture Document**: See `architectAnalysis` field in ST-38
- **Business Requirements**: See `baAnalysis` field in ST-38
- **Acceptance Criteria**: See story description
- **Epic**: EP-7 - Git Workflow Agent - Backend & MCP Tools

## Contact

- **Story**: ST-38
- **Epic**: EP-7
- **Complexity**: Business=5, Technical=8
- **Implementation**: Database schema changes only (NestJS services in separate story)
