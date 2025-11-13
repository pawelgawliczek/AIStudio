# File-to-UseCase Mapping & Impact Analysis

## Overview

This document describes how files are mapped to use cases and how to perform impact analysis to answer:
- **"Which use cases are affected if I modify this file?"**
- **"Which files implement this use case?"**

## Architecture

### Data Model

```
┌─────────────┐         ┌──────────────────┐         ┌──────────┐
│   File      │────────▶│ FileUseCaseLink  │◀────────│ UseCase  │
│  (path)     │         │                  │         │          │
└─────────────┘         │ - confidence     │         └──────────┘
                        │ - source         │
                        │ - lastUpdated    │
                        └──────────────────┘
                                 ▲
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌──────────┐            ┌──────────────┐
              │ Commits  │            │ AI Inference │
              └──────────┘            └──────────────┘
```

### Database Schema

```prisma
model FileUseCaseLink {
  id           String   @id @default(uuid())
  projectId    String   @db.Uuid
  filePath     String   // Relative path from repo root
  useCaseId    String   @db.Uuid

  // Confidence and provenance
  confidence   Float    @default(1.0)  // 0.0-1.0
  source       MappingSource  // How was this link created?

  // Metadata
  firstSeenAt  DateTime @default(now())
  lastSeenAt   DateTime @updatedAt
  occurrences  Int      @default(1)  // How many times confirmed

  // Relations
  project      Project  @relation(fields: [projectId], references: [id])
  useCase      UseCase  @relation(fields: [useCaseId], references: [id])

  @@unique([projectId, filePath, useCaseId])
  @@index([projectId, filePath])
  @@index([projectId, useCaseId])
  @@map("file_use_case_links")
}

enum MappingSource {
  COMMIT_DERIVED    // Created from commit history
  AI_INFERRED       // AI analyzed code and inferred
  MANUAL           // Developer manually mapped
  PATTERN_MATCHED  // File path pattern matched
  IMPORT_ANALYSIS  // Code dependency analysis
}
```

## How Mapping is Created

### 1. Automatic from Commits (Primary Source)

**When:** After a commit is linked to a story

**Trigger:** `link_commit` MCP tool or commit webhook

**Flow:**
```
1. Commit linked to Story (storyId set)
2. CommitFiles contain file paths changed
3. Story has StoryUseCaseLinks (many-to-many with UseCases)
4. System creates/updates FileUseCaseLink for each:
   - CommitFile.filePath
   - Story.useCaseLinks.useCaseId
   - source: COMMIT_DERIVED
   - confidence: 0.8 (high, based on actual work)
   - occurrences: increment if already exists
```

**Code Location:** Hook in `link_commit` handler or background job

**Example:**
```
Commit abc123:
  - files: ["backend/src/auth/login.service.ts", "backend/src/auth/login.controller.ts"]
  - storyId: "story-456"

Story story-456:
  - useCaseLinks: [UC-AUTH-001, UC-AUTH-002]

Creates:
  - FileUseCaseLink(backend/src/auth/login.service.ts → UC-AUTH-001)
  - FileUseCaseLink(backend/src/auth/login.service.ts → UC-AUTH-002)
  - FileUseCaseLink(backend/src/auth/login.controller.ts → UC-AUTH-001)
  - FileUseCaseLink(backend/src/auth/login.controller.ts → UC-AUTH-002)
```

### 2. AI Inference (Supplementary)

**When:**
- During code analysis job
- On-demand via API call
- When new use case is created

**Trigger:** Background job or explicit API call

**Flow:**
```
1. Get use case description/content
2. Get file content and metadata
3. Calculate similarity:
   - Keyword matching (fast, lower confidence)
   - Semantic embedding similarity (slow, higher confidence)
   - Import/dependency analysis
4. If similarity > threshold, create FileUseCaseLink
   - source: AI_INFERRED
   - confidence: similarity score (0.4-0.7 range)
```

**Code Location:** `backend/src/code-analysis/mapping.service.ts`

### 3. Pattern Matching

**When:** Project setup or configuration change

**Configuration Example:**
```json
{
  "patterns": [
    {
      "pattern": "backend/src/auth/**/*.ts",
      "useCases": ["UC-AUTH-*"],
      "confidence": 0.6
    },
    {
      "pattern": "backend/src/payments/**/*.ts",
      "useCases": ["UC-PAY-*"],
      "confidence": 0.6
    }
  ]
}
```

### 4. Manual Mapping

**When:** Developer/architect explicitly maps via UI or API

**API:** `POST /api/file-mappings`

**Confidence:** 1.0 (highest, human verified)

## Mapping Update Strategy

### Confidence Scoring

```typescript
function calculateConfidence(link: FileUseCaseLink): number {
  const baseConfidence = {
    COMMIT_DERIVED: 0.8,
    AI_INFERRED: 0.5,
    MANUAL: 1.0,
    PATTERN_MATCHED: 0.6,
    IMPORT_ANALYSIS: 0.7,
  }[link.source];

  // Boost confidence based on occurrences
  const occurrenceBoost = Math.min(0.2, link.occurrences * 0.05);

  // Decay confidence based on time since last seen
  const daysSinceLastSeen =
    (Date.now() - link.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  const timeDecay = Math.max(0, 1 - (daysSinceLastSeen / 180)); // 6 months decay

  return Math.min(1.0, (baseConfidence + occurrenceBoost) * timeDecay);
}
```

### Cleanup Strategy

**Remove stale mappings:**
- No activity for 6+ months AND confidence < 0.5
- File no longer exists in repository
- Use case deleted

**Run:** Nightly background job

## Impact Analysis APIs

### 1. Get Use Cases Affected by File(s)

**Endpoint:** `GET /api/impact-analysis/files-to-usecases`

**Query Params:**
- `projectId`: Project UUID (required)
- `filePaths`: Comma-separated file paths (required)
- `minConfidence`: Minimum confidence threshold (optional, default 0.5)
- `includeIndirect`: Include indirectly related use cases (optional, default false)

**Request:**
```http
GET /api/impact-analysis/files-to-usecases?projectId=proj-123&filePaths=backend/src/auth/login.service.ts,backend/src/auth/auth.guard.ts&minConfidence=0.6
```

**Response:**
```json
{
  "projectId": "proj-123",
  "filesAnalyzed": [
    "backend/src/auth/login.service.ts",
    "backend/src/auth/auth.guard.ts"
  ],
  "affectedUseCases": [
    {
      "useCaseId": "uc-123",
      "useCaseKey": "UC-AUTH-001",
      "title": "User Login",
      "confidence": 0.85,
      "affectedByFiles": [
        {
          "filePath": "backend/src/auth/login.service.ts",
          "source": "COMMIT_DERIVED",
          "confidence": 0.85,
          "lastSeen": "2025-11-10T10:30:00Z",
          "occurrences": 12
        },
        {
          "filePath": "backend/src/auth/auth.guard.ts",
          "source": "COMMIT_DERIVED",
          "confidence": 0.80,
          "lastSeen": "2025-11-08T14:20:00Z",
          "occurrences": 8
        }
      ],
      "riskLevel": "high",
      "relatedStories": [
        { "key": "ST-45", "title": "Implement SSO", "status": "in_progress" }
      ],
      "testCoverage": 78.5
    },
    {
      "useCaseId": "uc-124",
      "useCaseKey": "UC-AUTH-002",
      "title": "Session Management",
      "confidence": 0.72,
      "affectedByFiles": [
        {
          "filePath": "backend/src/auth/auth.guard.ts",
          "source": "COMMIT_DERIVED",
          "confidence": 0.72,
          "lastSeen": "2025-11-08T14:20:00Z",
          "occurrences": 5
        }
      ],
      "riskLevel": "medium",
      "relatedStories": [],
      "testCoverage": 92.0
    }
  ],
  "indirectUseCases": [
    {
      "useCaseId": "uc-125",
      "useCaseKey": "UC-USER-003",
      "title": "User Profile Access",
      "confidence": 0.45,
      "reason": "Depends on authentication",
      "riskLevel": "low"
    }
  ],
  "summary": {
    "totalUseCases": 2,
    "highRisk": 1,
    "mediumRisk": 1,
    "lowRisk": 0,
    "avgConfidence": 0.785,
    "recommendation": "High impact change. Consider reviewing UC-AUTH-001 test coverage."
  }
}
```

### 2. Get Files Implementing Use Case

**Endpoint:** `GET /api/impact-analysis/usecase-to-files`

**Query Params:**
- `projectId`: Project UUID (required)
- `useCaseId` or `useCaseKey`: Use case identifier (required)
- `minConfidence`: Minimum confidence threshold (optional, default 0.5)
- `includeMetrics`: Include code metrics for each file (optional, default true)

**Request:**
```http
GET /api/impact-analysis/usecase-to-files?projectId=proj-123&useCaseKey=UC-AUTH-001&minConfidence=0.6
```

**Response:**
```json
{
  "projectId": "proj-123",
  "useCase": {
    "id": "uc-123",
    "key": "UC-AUTH-001",
    "title": "User Login",
    "area": "Authentication"
  },
  "implementingFiles": [
    {
      "filePath": "backend/src/auth/login.service.ts",
      "confidence": 0.85,
      "source": "COMMIT_DERIVED",
      "lastSeen": "2025-11-10T10:30:00Z",
      "occurrences": 12,
      "metrics": {
        "linesOfCode": 245,
        "cyclomaticComplexity": 8.5,
        "maintainabilityIndex": 72,
        "testCoverage": 85.0,
        "churnRate": 3,
        "riskScore": 24.5
      },
      "recentCommits": [
        {
          "hash": "abc123",
          "message": "Fix login validation",
          "author": "john@example.com",
          "timestamp": "2025-11-10T10:30:00Z"
        }
      ],
      "relatedFiles": [
        "backend/src/auth/login.controller.ts",
        "backend/src/auth/auth.guard.ts"
      ]
    },
    {
      "filePath": "backend/src/auth/login.controller.ts",
      "confidence": 0.80,
      "source": "COMMIT_DERIVED",
      "lastSeen": "2025-11-09T16:15:00Z",
      "occurrences": 10,
      "metrics": {
        "linesOfCode": 156,
        "cyclomaticComplexity": 5.2,
        "maintainabilityIndex": 78,
        "testCoverage": 90.0,
        "churnRate": 2,
        "riskScore": 12.8
      }
    },
    {
      "filePath": "frontend/src/pages/LoginPage.tsx",
      "confidence": 0.65,
      "source": "AI_INFERRED",
      "lastSeen": "2025-11-05T09:00:00Z",
      "occurrences": 4,
      "metrics": {
        "linesOfCode": 189,
        "cyclomaticComplexity": 4.8,
        "maintainabilityIndex": 81,
        "testCoverage": 65.0,
        "churnRate": 1,
        "riskScore": 8.2
      }
    }
  ],
  "relatedUseCases": [
    {
      "key": "UC-AUTH-002",
      "title": "Session Management",
      "sharedFiles": 2,
      "relation": "depends_on"
    }
  ],
  "stories": [
    {
      "key": "ST-45",
      "title": "Implement SSO",
      "status": "in_progress"
    },
    {
      "key": "ST-23",
      "title": "Add OAuth2 support",
      "status": "completed"
    }
  ],
  "summary": {
    "totalFiles": 3,
    "totalLOC": 590,
    "avgComplexity": 6.17,
    "avgMaintainability": 77.0,
    "avgTestCoverage": 80.0,
    "avgConfidence": 0.767,
    "highRiskFiles": 0,
    "mediumRiskFiles": 1,
    "recommendation": "Well-tested use case with good maintainability."
  }
}
```

### 3. Bulk Impact Analysis

**Endpoint:** `POST /api/impact-analysis/batch`

**Use Case:** Analyze impact of a branch or PR with multiple file changes

**Request:**
```http
POST /api/impact-analysis/batch
Content-Type: application/json

{
  "projectId": "proj-123",
  "filePaths": [
    "backend/src/auth/login.service.ts",
    "backend/src/auth/auth.guard.ts",
    "backend/src/users/users.service.ts",
    "frontend/src/pages/LoginPage.tsx"
  ],
  "minConfidence": 0.5,
  "includeIndirect": true,
  "context": {
    "prNumber": 123,
    "branch": "feature/sso-implementation",
    "author": "john@example.com"
  }
}
```

**Response:**
```json
{
  "analysisId": "analysis-789",
  "projectId": "proj-123",
  "filesAnalyzed": 4,
  "affectedUseCases": 5,
  "riskAssessment": {
    "overallRisk": "high",
    "criticalUseCases": 2,
    "highRiskUseCases": 1,
    "mediumRiskUseCases": 2,
    "factors": [
      "Multiple authentication use cases affected",
      "Low test coverage on UC-AUTH-003",
      "High complexity files modified"
    ]
  },
  "useCases": [/* detailed use case impacts */],
  "recommendations": [
    "Review and update test cases for UC-AUTH-001",
    "Consider refactoring auth.guard.ts (high complexity)",
    "Notify stakeholders of UC-AUTH-001 and UC-AUTH-002",
    "Run full regression suite before deployment"
  ],
  "requiredReviewers": [
    { "email": "security-team@example.com", "reason": "Authentication changes" },
    { "email": "qa-lead@example.com", "reason": "High risk changes" }
  ]
}
```

## MCP Tools

### 1. `analyze_file_impact`

**Description:** Analyze which use cases are affected by file changes

**Usage:**
```bash
mcp-tool analyze_file_impact \
  --projectId proj-123 \
  --filePaths backend/src/auth/login.service.ts,backend/src/auth/auth.guard.ts
```

### 2. `find_usecase_files`

**Description:** Find all files implementing a use case

**Usage:**
```bash
mcp-tool find_usecase_files \
  --projectId proj-123 \
  --useCaseKey UC-AUTH-001
```

### 3. `update_file_mappings`

**Description:** Manually update or create file-to-usecase mappings

**Usage:**
```bash
mcp-tool update_file_mappings \
  --projectId proj-123 \
  --filePath backend/src/auth/login.service.ts \
  --useCaseKeys UC-AUTH-001,UC-AUTH-002 \
  --source MANUAL
```

## Implementation Plan

### Phase 1: Database Schema (Week 1)
- [ ] Add `FileUseCaseLink` model to Prisma schema
- [ ] Create migration
- [ ] Add indexes for performance
- [ ] Update existing models with relations

### Phase 2: Automatic Mapping from Commits (Week 1-2)
- [ ] Create service: `FileMappingService`
- [ ] Hook into `link_commit` to auto-create mappings
- [ ] Implement confidence calculation
- [ ] Add background job for historical commits

### Phase 3: Impact Analysis APIs (Week 2)
- [ ] Create controller: `ImpactAnalysisController`
- [ ] Implement `GET /files-to-usecases`
- [ ] Implement `GET /usecase-to-files`
- [ ] Implement `POST /batch`
- [ ] Add authorization guards

### Phase 4: MCP Tools (Week 2-3)
- [ ] Create `analyze_file_impact.ts`
- [ ] Create `find_usecase_files.ts`
- [ ] Create `update_file_mappings.ts`
- [ ] Add tests

### Phase 5: AI Inference (Week 3-4)
- [ ] Implement keyword-based inference
- [ ] Add to code-analysis background job
- [ ] Implement semantic search (using embeddings)
- [ ] Add confidence tuning

### Phase 6: UI Integration (Week 4)
- [ ] Add impact analysis to code quality dashboard
- [ ] Show affected use cases when viewing file metrics
- [ ] Show implementing files when viewing use case
- [ ] Add manual mapping UI

## Performance Considerations

### Caching
- Cache file-to-usecase lookups (5 minute TTL)
- Cache usecase-to-files lookups (10 minute TTL)
- Invalidate on new commits or manual updates

### Indexes
```sql
CREATE INDEX idx_file_use_case_links_file ON file_use_case_links(project_id, file_path);
CREATE INDEX idx_file_use_case_links_uc ON file_use_case_links(project_id, use_case_id);
CREATE INDEX idx_file_use_case_links_confidence ON file_use_case_links(confidence DESC);
```

### Query Optimization
- Use JOIN instead of N+1 queries
- Paginate large result sets
- Pre-compute impact for common files

## Testing Strategy

### Unit Tests
- FileMappingService methods
- Confidence calculation algorithm
- Mapping creation/update logic

### Integration Tests
- End-to-end API tests
- MCP tool execution
- Background job processing

### Load Tests
- 1000+ files, 100+ use cases
- Bulk analysis performance
- Concurrent API requests

## Monitoring

### Metrics to Track
- Mapping creation rate
- Average confidence scores by source
- API response times
- Cache hit rates
- Stale mapping cleanup stats

### Alerts
- Low confidence warnings (<0.5 average)
- High API latency (>2s)
- Failed background jobs

## Future Enhancements

1. **Dependency Graph Analysis**
   - Trace imports to find indirect impacts
   - "This file imports X which affects Y use case"

2. **Machine Learning**
   - Train model on historical commit data
   - Predict likely use cases for new files
   - Improve confidence scoring

3. **Visual Impact Map**
   - Interactive graph showing file-usecase relationships
   - Highlight high-risk areas
   - Show dependency chains

4. **PR Integration**
   - GitHub/GitLab webhooks
   - Automatic impact comments on PRs
   - Block PRs with high-risk, low-test-coverage changes

5. **Smart Notifications**
   - Notify use case owners when their files change
   - Alert on high-impact commits
   - Daily/weekly impact reports
