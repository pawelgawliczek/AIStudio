# UC-PM-008: View Project Statistics with Aggregation Tools

## Actor
Project Manager, Product Owner, Scrum Master

## Preconditions
- User is authenticated with PM or Admin role
- Project exists with stories and epics
- AI Studio MCP Server is running (for MCP integration)
- Web UI is accessible

## Main Flow

### Via Web UI
1. PM navigates to Project Dashboard
2. System displays project selector dropdown
3. PM selects project from dropdown
4. System calls API: `GET /api/projects/{projectId}/summary`
5. Backend calls aggregation logic (same as `get_project_summary` MCP tool)
6. System returns aggregated statistics:
   ```json
   {
     "project": {
       "id": "uuid",
       "name": "AI Studio",
       "status": "active"
     },
     "statistics": {
       "storiesByStatus": {
         "planning": 5,
         "analysis": 3,
         "architecture": 2,
         "design": 1,
         "impl": 8,
         "review": 4,
         "qa": 3,
         "done": 15
       },
       "storiesByType": {
         "feature": 28,
         "bug": 7,
         "chore": 3,
         "spike": 3
       },
       "totalEpics": 4,
       "epicsWithStories": 4,
       "totalStories": 41
     }
   }
   ```
7. System renders dashboard with visualizations:
   - **Status Funnel:** Stories by workflow stage (planning → done)
   - **Type Pie Chart:** Distribution of story types
   - **Epic Progress:** Stories per epic with completion %
   - **Summary Cards:** Total epics, total stories, completion %

### Via MCP Tools (Claude Code)
1. PM/Agent calls: `get_project_summary({ projectId: 'uuid' })`
2. System aggregates data from database (same backend logic as API)
3. Returns JSON summary (same structure as above)
4. Agent formats and displays to user

## Postconditions
- PM sees high-level project health at a glance
- Statistics are accurate and up-to-date
- No need to manually count stories or calculate percentages
- Decision-making data readily available

## Alternative Flows

### 4a. Detailed Story Breakdown by Status
- At step 4, PM wants to see stories grouped by status with complexity
- PM/Agent calls: `get_story_summary({ projectId: 'uuid', groupBy: 'status' })`
- System returns:
  ```json
  {
    "groupBy": "status",
    "summary": [
      {
        "status": "impl",
        "count": 8,
        "avgComplexity": 6.2
      },
      {
        "status": "review",
        "count": 4,
        "avgComplexity": 5.5
      }
    ]
  }
  ```
- PM identifies high-complexity stories bottlenecked in review

### 4b. Stories Grouped by Epic
- PM wants to see epic progress breakdown
- PM/Agent calls: `get_story_summary({ projectId: 'uuid', groupBy: 'epic' })`
- System returns:
  ```json
  {
    "groupBy": "epic",
    "summary": [
      {
        "epicId": "uuid-1",
        "epic": {
          "id": "uuid-1",
          "key": "EP-1",
          "title": "User Authentication"
        },
        "count": 12
      },
      {
        "epicId": "uuid-2",
        "epic": {
          "id": "uuid-2",
          "key": "EP-2",
          "title": "Dashboard UI"
        },
        "count": 15
      }
    ]
  }
  ```
- PM sees which epics have most stories (scope risk)

### 4c. Complexity Distribution
- PM wants to understand story complexity distribution
- PM/Agent calls: `get_story_summary({ projectId: 'uuid', groupBy: 'complexity' })`
- System returns:
  ```json
  {
    "groupBy": "complexity",
    "summary": [
      { "complexity": 1, "count": 2 },
      { "complexity": 3, "count": 8 },
      { "complexity": 5, "count": 15 },
      { "complexity": 7, "count": 10 },
      { "complexity": 9, "count": 6 }
    ]
  }
  ```
- PM identifies that most stories are medium complexity (5)
- Can adjust sprint planning accordingly

### 4d. Large Dataset - Pagination Required
- PM has project with 500+ stories
- PM calls: `list_stories({ projectId: 'uuid', status: 'impl', page: 1, pageSize: 20 })`
- System returns paginated response:
  ```json
  {
    "data": [ /* 20 story objects */ ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 87,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
  ```
- PM browses through pages instead of overwhelming single response
- **Token savings:** 20 stories (~5KB) vs. 87 stories (~20KB+)

### 4e. Real-Time Dashboard Auto-Refresh
- At step 7, PM leaves dashboard open
- System polls API every 30 seconds for updates
- When new story created or status changed:
  - Dashboard re-fetches summary
  - Charts update with smooth animations
  - PM sees live project progress

## Business Rules
- **Aggregation Performance:** Summary calculations must complete in <500ms
- **Pagination Defaults:**
  - Default page: 1
  - Default pageSize: 20
  - Maximum pageSize: 100 (to prevent abuse)
- **Caching:** Summary data cached for 1 minute to reduce database load
- **Access Control:** Only PM, Admin, and assigned team members can view project statistics
- **Data Freshness:** Statistics reflect current database state (no stale data)
- **Large Projects:** Auto-enable pagination for projects with >100 stories

## Technical Implementation

### Backend: Aggregation Logic

```typescript
// backend/src/mcp/servers/projects/get_project_summary.ts

export async function handler(prisma: PrismaClient, params: { projectId: string }) {
  const [project, storiesByStatus, storiesByType, epicStats] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),

    prisma.story.groupBy({
      by: ['status'],
      where: { projectId: params.projectId },
      _count: true,
    }),

    prisma.story.groupBy({
      by: ['type'],
      where: { projectId: params.projectId },
      _count: true,
    }),

    prisma.epic.findMany({
      where: { projectId: params.projectId },
      include: { _count: { select: { stories: true } } },
    }),
  ]);

  return {
    project: { id: project.id, name: project.name, status: project.status },
    statistics: {
      storiesByStatus: Object.fromEntries(storiesByStatus.map(s => [s.status, s._count])),
      storiesByType: Object.fromEntries(storiesByType.map(t => [t.type, t._count])),
      totalEpics: epicStats.length,
      epicsWithStories: epicStats.filter(e => e._count.stories > 0).length,
      totalStories: storiesByStatus.reduce((sum, s) => sum + s._count, 0),
    },
  };
}
```

### Frontend: Dashboard Visualization

```typescript
// frontend/src/pages/ProjectDashboard.tsx

function ProjectDashboard() {
  const { projectId } = useParams();
  const { data, isLoading } = useQuery(
    ['projectSummary', projectId],
    () => api.get(`/projects/${projectId}/summary`),
    { refetchInterval: 30000 } // Auto-refresh every 30s
  );

  return (
    <div className="dashboard">
      <SummaryCards stats={data.statistics} />
      <StatusFunnel data={data.statistics.storiesByStatus} />
      <TypePieChart data={data.statistics.storiesByType} />
      <EpicProgress epics={data.epics} />
    </div>
  );
}
```

### Pagination Implementation

```typescript
// backend/src/mcp/servers/stories/list_stories.ts

export async function handler(prisma: PrismaClient, params: ListStoriesParams) {
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100); // Cap at 100
  const skip = (page - 1) * pageSize;

  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where: buildWhereClause(params),
      skip,
      take: pageSize,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.story.count({ where: buildWhereClause(params) }),
  ]);

  return {
    data: stories.map(formatStory),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page < Math.ceil(total / pageSize),
      hasPrev: page > 1,
    },
  };
}
```

## Performance Considerations

### Database Optimization
- **Indexes Required:**
  - `(projectId, status)` for fast groupBy queries
  - `(projectId, type)` for story type aggregation
  - `(projectId, createdAt)` for pagination ordering
- **Query Optimization:**
  - Use `groupBy` instead of loading all records
  - Parallel queries with `Promise.all()`
  - Avoid N+1 queries with includes

### Caching Strategy
- **Redis Cache:** Store summary results for 1 minute
  ```typescript
  const cacheKey = `project:${projectId}:summary`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const summary = await calculateSummary(projectId);
  await redis.setex(cacheKey, 60, JSON.stringify(summary)); // 1 min TTL
  return summary;
  ```

### Token Efficiency (MCP)
- **Aggregation vs. Full List:**
  - Full list (100 stories): ~30KB
  - Aggregated summary: ~1KB
  - **Savings:** 97% token reduction
- **Progressive Detail:**
  1. Start with summary (1KB)
  2. If details needed, paginate (5KB per page)
  3. Drill down to specific stories only when necessary

## Related Use Cases
- UC-PM-005: View Project Dashboard (parent use case)
- UC-PM-007: JIRA-like Planning View (uses list_stories with pagination)
- UC-METRICS-001: View Framework Effectiveness (advanced metrics)
- UC-DEV-001: Pull Assigned Stories (uses list_stories with filters)
- UC-DEV-004: Discover MCP Tools (progressive disclosure pattern)

## Acceptance Criteria
- [ ] PM can view project summary with accurate counts
- [ ] Statistics update in real-time (within 30 seconds)
- [ ] Dashboard renders in <1 second (cached)
- [ ] Aggregation queries complete in <500ms
- [ ] Pagination works correctly for large projects (100+ stories)
- [ ] Page size capped at 100 to prevent abuse
- [ ] Charts visualize data clearly and accurately
- [ ] MCP tools return same data as Web UI
- [ ] Error handling for non-existent projects
- [ ] Access control enforced (PM/Admin only)
- [ ] Token usage optimized (aggregation vs. full list)
- [ ] No performance degradation with 1000+ stories

## Success Metrics
- **Performance:** Dashboard loads in <1s (p95)
- **Accuracy:** 100% match between aggregated and raw counts
- **Adoption:** 80%+ of PMs use dashboard weekly
- **Satisfaction:** "Much faster than counting manually" (qualitative)
- **Token Efficiency:** 95%+ reduction vs. loading all stories

## Sprint 4.5 Implementation Notes
- Added as part of pagination and aggregation enhancement
- Implements Anthropic's "filter before context" pattern
- Reduces token costs for large datasets
- Sets pattern for other role dashboards (BA, Architect, QA)

---

**Version:** 1.0
**Created:** 2025-11-10 (Sprint 4.5)
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
**Priority:** High (Core PM functionality)
