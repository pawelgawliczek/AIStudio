# Use Case: Trigger Code Analysis and Refresh Analytics

## UC-CODE-001: Trigger Full Project Code Analysis

### Overview
Allow users to trigger a complete code analysis scan for a project, which will:
- Scan all source files in the repository
- Calculate complexity metrics (cyclomatic, cognitive)
- Detect code smells and quality issues
- Map files to components and layers
- Update code quality dashboard with fresh data

### Actors
- **Primary**: Project Manager, Tech Lead, Architect
- **Secondary**: Developer, QA Engineer, System Administrator

### Preconditions
1. Project exists with valid local repository path configured
2. Repository is accessible and contains source files
3. User has permission to trigger analysis (role-based)
4. Background worker system (Bull/Redis) is operational

### Postconditions
- All source files have been analyzed
- Code metrics database is updated with latest data
- Code quality dashboard shows refreshed metrics
- Component and layer mappings are current
- Analysis job history is recorded

---

## Main Flow

### 1. User Initiates Analysis

**Trigger Options:**
- **A. Via UI**: Click "Refresh Analysis" button on Code Quality Dashboard
- **B. Via API**: POST request to `/api/code-analysis/projects/:projectId/analyze`
- **C. Via MCP Tool**: `analyze_project_code` tool from CLI/agent
- **D. Via Webhook**: Git post-commit hook triggers analysis
- **E. Scheduled**: Cron job runs nightly analysis

### 2. System Validates Request

```typescript
Validation Checks:
✓ Project exists
✓ Project has localPath configured
✓ User has permission (admin, project owner, or architect role)
✓ No analysis currently running for this project
✓ Repository path is accessible
```

### 3. System Enqueues Background Job

```typescript
Job Details:
- Queue: 'code-analysis'
- Job Type: 'analyze-project'
- Priority: 1 (high) or 3 (low for scheduled)
- Data: { projectId, triggeredBy userId }
- Options: {
    attempts: 3, // Retry on failure
    backoff: exponential,
    removeOnComplete: 100, // Keep last 100
    removeOnFail: false, // Keep failed for debugging
  }
```

### 4. System Returns Job ID

```json
{
  "success": true,
  "jobId": "abc-123",
  "status": "queued",
  "message": "Code analysis started",
  "estimatedDuration": "2-5 minutes"
}
```

### 5. Background Worker Processes Job

**Steps:**
1. Fetch project and repository details
2. Get all source files via `git ls-files`
3. Filter to relevant files (exclude node_modules, dist, tests)
4. Process in batches of 10 files
   - Read file content
   - Calculate LOC (lines of code)
   - Calculate complexity metrics
   - Detect code smells
   - Map to component/layer using database patterns
   - Calculate churn rate (git log)
   - Calculate maintainability index
5. Save/update file metrics in database
6. Aggregate to component level
7. Aggregate to layer level
8. Update project health score
9. Broadcast WebSocket event: `code-analysis:completed`

### 6. User Monitors Progress

**Progress Indicators:**
- **UI**: Progress bar showing percentage complete
- **API**: GET `/api/code-analysis/jobs/:jobId/status`
- **WebSocket**: Real-time progress events

```json
{
  "jobId": "abc-123",
  "status": "active",
  "progress": 45,
  "processedFiles": 45,
  "totalFiles": 100,
  "currentFile": "backend/src/auth/auth.service.ts"
}
```

### 7. Analysis Completes

**Success Response:**
```json
{
  "jobId": "abc-123",
  "status": "completed",
  "progress": 100,
  "result": {
    "filesAnalyzed": 150,
    "duration": "3m 24s",
    "metrics": {
      "totalLOC": 45000,
      "avgComplexity": 4.2,
      "codeSmells": 23,
      "healthScore": 78
    }
  }
}
```

### 8. Dashboard Auto-Refreshes

- WebSocket event triggers UI update
- Metrics displayed with "Last updated: Just now"
- New components/layers appear automatically
- Charts and graphs reflect latest data

---

## Alternative Flows

### A1: Analysis Already Running

**At Step 2:**
- System checks for active job for this project
- Returns 409 Conflict:
```json
{
  "error": "Analysis already running",
  "existingJobId": "xyz-789",
  "status": "active",
  "progress": 67,
  "message": "Please wait for current analysis to complete"
}
```
- **Option 1**: User waits for current job
- **Option 2**: Admin can cancel current job and restart

### A2: Repository Not Found

**At Step 5:**
- Worker cannot access repository path
- Job fails with clear error
- Error logged and returned to user
```json
{
  "status": "failed",
  "error": "Repository not accessible",
  "details": "Path /opt/stack/MyProject does not exist",
  "suggestion": "Check project localPath configuration"
}
```

### A3: No Source Files Found

**At Step 5:**
- Repository exists but contains no analyzable files
- Job completes with warning
```json
{
  "status": "completed",
  "filesAnalyzed": 0,
  "warning": "No source files found in repository",
  "suggestion": "Check repository contains .ts, .js, .py, etc. files"
}
```

### A4: Partial Failure

**At Step 5:**
- Some files fail to analyze (parse errors, encoding issues)
- Job continues with other files
- Failed files logged separately
```json
{
  "status": "completed",
  "filesAnalyzed": 145,
  "filesFailed": 5,
  "failedFiles": [
    { "path": "file1.ts", "error": "Parse error" },
    ...
  ]
}
```

### A5: User Cancels Analysis

**At any time during processing:**
- User clicks "Cancel Analysis"
- System sends cancel signal to job
- Worker gracefully stops
- Partial results are saved
```json
{
  "status": "cancelled",
  "progress": 42,
  "filesAnalyzed": 42,
  "message": "Analysis cancelled by user"
}
```

---

## Implementation Plan

### Phase 1: Backend API & Service

**Files to Create/Modify:**

1. **`backend/src/code-analysis/code-analysis.controller.ts`**
   - POST `/api/code-analysis/projects/:projectId/analyze`
   - GET `/api/code-analysis/jobs/:jobId/status`
   - DELETE `/api/code-analysis/jobs/:jobId` (cancel)
   - GET `/api/code-analysis/projects/:projectId/history`

2. **`backend/src/code-analysis/code-analysis.service.ts`**
   - `triggerAnalysis(projectId, userId): Promise<JobInfo>`
   - `getJobStatus(jobId): Promise<JobStatus>`
   - `cancelJob(jobId): Promise<void>`
   - `getAnalysisHistory(projectId): Promise<AnalysisRun[]>`

3. **`backend/src/workers/processors/code-analysis.processor.ts`**
   - Already exists, needs minor updates:
   - Add progress reporting
   - Add cancellation handling
   - Improve error handling and logging

### Phase 2: MCP Tool

**File: `backend/src/mcp/tools/code-analysis.tools.ts`**

```typescript
export async function analyzeProjectCode(
  prisma: PrismaClient,
  params: { projectId: string }
): Promise<AnalysisJobResponse>

export async function getAnalysisStatus(
  prisma: PrismaClient,
  params: { jobId: string }
): Promise<JobStatus>

export async function cancelAnalysis(
  prisma: PrismaClient,
  params: { jobId: string }
): Promise<void>
```

### Phase 3: Frontend UI

**Files to Modify:**

1. **`frontend/src/pages/CodeQualityDashboard.tsx`**
   - Add "Refresh Analysis" button in header
   - Show analysis status banner when running
   - Display progress bar
   - Auto-refresh on completion
   - Show last analysis timestamp

2. **`frontend/src/components/AnalysisProgressBar.tsx`** (new)
   - Visual progress indicator
   - Current file being processed
   - Estimated time remaining
   - Cancel button

3. **`frontend/src/hooks/useCodeAnalysis.ts`** (new)
   - `triggerAnalysis(projectId)`
   - `useAnalysisStatus(jobId)` - WebSocket subscription
   - `cancelAnalysis(jobId)`

### Phase 4: Database Schema

**No new tables needed**, but track analysis runs:

```sql
-- Use existing AgentRun table or create similar:
CREATE TABLE code_analysis_runs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  triggered_by UUID REFERENCES users(id),
  status VARCHAR(20), -- queued, active, completed, failed, cancelled
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  files_analyzed INTEGER,
  files_failed INTEGER,
  error_message TEXT,
  metadata JSONB
);
```

Or reuse existing structures if appropriate.

---

## User Interface Design

### Code Quality Dashboard Header

```
┌─────────────────────────────────────────────────────────────┐
│ Code Quality Dashboard - AI Studio                          │
│                                                              │
│ Last Updated: 2 hours ago                     [🔄 Refresh] │
└─────────────────────────────────────────────────────────────┘

// When analysis running:
┌─────────────────────────────────────────────────────────────┐
│ 🔄 Analyzing codebase... 45% (45/100 files)                 │
│ Current: backend/src/auth/auth.service.ts        [Cancel]   │
│ ████████████░░░░░░░░░░░░░░                                 │
└─────────────────────────────────────────────────────────────┘
```

### Button States

1. **Idle**: `🔄 Refresh Analysis` (enabled)
2. **Running**: `⏸ Analyzing... 45%` (shows progress)
3. **Cancelling**: `⏹ Cancelling...` (disabled)
4. **Error**: `⚠️ Analysis Failed - Retry` (enabled)
5. **Success**: `✅ Updated just now` (briefly, then back to idle)

---

## API Specification

### Trigger Analysis

**Request:**
```http
POST /api/code-analysis/projects/:projectId/analyze
Authorization: Bearer <token>

{}
```

**Response (202 Accepted):**
```json
{
  "jobId": "abc-123-def-456",
  "status": "queued",
  "message": "Code analysis started",
  "estimatedDuration": "2-5 minutes",
  "_links": {
    "status": "/api/code-analysis/jobs/abc-123-def-456/status",
    "cancel": "/api/code-analysis/jobs/abc-123-def-456"
  }
}
```

### Get Job Status

**Request:**
```http
GET /api/code-analysis/jobs/:jobId/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "jobId": "abc-123-def-456",
  "status": "active",
  "progress": 45,
  "processedFiles": 45,
  "totalFiles": 100,
  "currentFile": "backend/src/auth/auth.service.ts",
  "startedAt": "2025-01-15T10:30:00Z",
  "estimatedCompletion": "2025-01-15T10:33:00Z"
}
```

### Cancel Analysis

**Request:**
```http
DELETE /api/code-analysis/jobs/:jobId
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "jobId": "abc-123-def-456",
  "status": "cancelling",
  "message": "Cancellation requested"
}
```

---

## WebSocket Events

### Subscribe to Analysis Progress

```typescript
socket.on('code-analysis:progress', (data) => {
  // data.projectId, data.jobId, data.progress, data.currentFile
});

socket.on('code-analysis:completed', (data) => {
  // data.projectId, data.jobId, data.result
});

socket.on('code-analysis:failed', (data) => {
  // data.projectId, data.jobId, data.error
});
```

---

## Security Considerations

1. **Authorization**:
   - Only project owners, admins, and architects can trigger analysis
   - Implement role-based access control

2. **Rate Limiting**:
   - Max 1 analysis per project per 5 minutes
   - Prevent abuse

3. **Resource Management**:
   - Limit concurrent analyses (max 3 system-wide)
   - Queue additional requests

4. **Input Validation**:
   - Validate project IDs
   - Sanitize repository paths
   - Prevent path traversal attacks

---

## Performance Considerations

### Optimization Strategies

1. **Incremental Analysis** (Future):
   - Only analyze files changed since last run
   - Use git diff to identify changed files
   - Much faster for large projects

2. **Caching**:
   - Cache file metrics if file hasn't changed (check git hash)
   - Only recalculate when file modified

3. **Parallel Processing**:
   - Process files in parallel batches
   - Balance speed vs. system load

4. **Smart Scheduling**:
   - Run full analysis during off-peak hours
   - Incremental during business hours

### Expected Performance

| Project Size | Files | Expected Duration |
|--------------|-------|-------------------|
| Small | <100 | 30 seconds |
| Medium | 100-500 | 1-3 minutes |
| Large | 500-2000 | 3-10 minutes |
| Very Large | 2000+ | 10-30 minutes |

---

## Testing Strategy

### Unit Tests

```typescript
describe('CodeAnalysisService', () => {
  it('should trigger analysis for valid project');
  it('should reject if analysis already running');
  it('should validate user permissions');
  it('should handle missing repository');
});

describe('CodeAnalysisProcessor', () => {
  it('should analyze all source files');
  it('should skip excluded files');
  it('should handle file parse errors gracefully');
  it('should map files to correct components');
});
```

### Integration Tests

```typescript
describe('Code Analysis API', () => {
  it('should trigger and complete analysis end-to-end');
  it('should report progress via WebSocket');
  it('should allow cancellation');
  it('should handle concurrent requests');
});
```

### Manual Testing Checklist

- [ ] Trigger analysis from UI
- [ ] Monitor progress in real-time
- [ ] Cancel analysis mid-way
- [ ] Trigger analysis from MCP tool
- [ ] Verify metrics update correctly
- [ ] Test with empty repository
- [ ] Test with very large repository
- [ ] Test permission denied scenarios
- [ ] Test concurrent analysis requests

---

## Monitoring & Observability

### Metrics to Track

1. **Analysis Runs**:
   - Total runs per day/week
   - Success rate
   - Average duration
   - Failure reasons

2. **Performance**:
   - Files processed per second
   - Memory usage
   - CPU usage during analysis

3. **Queue Health**:
   - Queue length
   - Average wait time
   - Worker utilization

### Logging

```typescript
logger.info('Analysis started', {
  projectId,
  triggeredBy: userId,
  totalFiles,
});

logger.info('Analysis progress', {
  projectId,
  progress: 45,
  filesProcessed: 45,
});

logger.info('Analysis completed', {
  projectId,
  duration: '3m24s',
  filesAnalyzed: 150,
  healthScore: 78,
});

logger.error('Analysis failed', {
  projectId,
  error: error.message,
  failedFile: filePath,
});
```

---

## Future Enhancements

1. **Incremental Analysis**: Only analyze changed files
2. **Scheduled Analysis**: Automatic nightly runs
3. **Comparison View**: Compare metrics over time
4. **Custom Rules**: User-defined code quality rules
5. **Integration**: Trigger from CI/CD pipelines
6. **Notifications**: Email/Slack when analysis completes
7. **Export**: Download analysis reports as PDF/CSV

---

## Summary

This use case provides a comprehensive solution for triggering code analysis with:

✅ **Multiple Trigger Options**: UI, API, MCP, webhook, scheduled
✅ **Real-time Progress**: WebSocket updates during processing
✅ **Robust Error Handling**: Graceful failures and retry logic
✅ **Performance Optimized**: Batch processing and caching
✅ **User-Friendly**: Clear UI feedback and status indicators
✅ **Scalable**: Background job queue architecture

**Next Steps**: Implement Phase 1 (Backend API & Service)
