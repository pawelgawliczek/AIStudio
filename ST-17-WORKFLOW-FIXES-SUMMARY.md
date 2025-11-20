# ST-17 Workflow Execution - Fixes and Configuration Summary

## Issue Analysis

When testing workflow execution for ST-17, we identified a critical configuration issue with transcript tracking. The workflow was using **Docker container paths** (`/app`) instead of **HOST paths** (`/opt/stack/AIStudio`) for Claude Code transcript tracking.

## Root Cause

The problem was a conflict between two different use cases for the `localPath` field:

1. **Backend Code Analysis Workers** (running in Docker) need `/app` to access the mounted repository
2. **Transcript Tracking** (Claude Code on host) needs `/opt/stack/AIStudio` to access `~/.claude/projects/`

## Fixes Implemented

### 1. Added PROJECT_HOST_PATH Environment Variable

**File:** `docker-compose.prod.yml`

```yaml
environment:
  NODE_ENV: production
  DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-CHANGE_THIS_PASSWORD}@postgres:5432/vibestudio?schema=public
  REDIS_URL: redis://:${REDIS_PASSWORD:-}@redis:6379
  PORT: 3000
  # HOST path for transcript tracking (where Claude Code runs, not Docker path)
  PROJECT_HOST_PATH: /opt/stack/AIStudio
```

**Purpose:** Provides the backend with the HOST filesystem path for transcript tracking, separate from the Docker container path.

### 2. Updated execute_story_with_workflow.ts

**File:** `backend/src/mcp/servers/execution/execute_story_with_workflow.ts`

**Changes:**
- Added `cwd` parameter to tool schema
- Updated path resolution logic with proper priority order:
  1. `params.cwd` (explicit path from caller)
  2. `process.env.PROJECT_HOST_PATH` (environment variable - NEW)
  3. `story.project.localPath` (fallback)

```typescript
// Priority order:
// 1. params.cwd (explicit path from caller)
// 2. PROJECT_HOST_PATH env var (set in docker-compose for host path)
// 3. story.project.localPath (fallback, may be Docker path /app)
const hostPath = params.cwd || process.env.PROJECT_HOST_PATH || story.project.localPath;
```

### 3. Database Configuration

**Kept project.local_path = `/app`** (Docker path for code analysis workers)

This is correct because:
- Code analysis workers run **inside Docker** at `/app`
- The repository is mounted at `/app` via docker-compose volumes
- Workers need to execute `git` commands and analyze files at this path

## Architecture Decision

We maintain **TWO separate paths**:

| Use Case | Path Type | Value | Where It's Used |
|----------|-----------|-------|-----------------|
| **Code Analysis Workers** | Docker Container Path | `/app` | `project.local_path` in database |
| **Transcript Tracking** | Host Filesystem Path | `/opt/stack/AIStudio` | `PROJECT_HOST_PATH` env var |

This separation ensures:
- ✅ Workers can analyze code in Docker
- ✅ Transcript tracking works on host
- ✅ No path conflicts
- ✅ Both systems work independently

## Current Status

### ✅ Completed
1. Environment variable added to docker-compose.prod.yml
2. Code updated in execute_story_with_workflow.ts
3. Backend rebuilt with changes
4. Database `local_path` kept at `/app` (correct for workers)

### ⚠️ Known Issue - Node.js Module Caching

The backend container has source mounts for hot-reloading, but compiled JavaScript is cached by Node.js. The fix requires:

**Option A: Full Container Rebuild (Recommended)**
```bash
docker compose -f docker-compose.prod.yml down backend
docker compose -f docker-compose.prod.yml up -d --build --force-recreate backend
```

**Option B: Manual Cache Clear**
```bash
docker exec vibe-studio-backend rm -rf /app/backend/dist
docker restart vibe-studio-backend
```

## Validation Checklist

To verify the fix is working:

1. **Check environment variable:**
   ```bash
   docker exec vibe-studio-backend env | grep PROJECT_HOST_PATH
   # Should output: PROJECT_HOST_PATH=/opt/stack/AIStudio
   ```

2. **Start a new workflow:**
   ```javascript
   execute_story_with_workflow({
     storyId: "...",
     workflowId: "...",
     triggeredBy: "test"
   })
   ```

3. **Verify transcript path in context:**
   ```javascript
   get_workflow_run_results({ runId: "..." })
   ```

   Look for `context._transcriptTracking.projectPath` - should be `/opt/stack/AIStudio`

4. **Check transcript directory exists:**
   ```bash
   ls ~/.claude/projects/-opt-stack-AIStudio/
   ```

## Impact on Other Systems

### ✅ No Breaking Changes
- **Code analysis workers**: Still use `/app` from database
- **Workflow orchestration**: Uses new `PROJECT_HOST_PATH`
- **MCP tools**: Continue working as before
- **Database schema**: No changes required

### Future Recommendations

1. **Make cwd parameter required** for workflow execution when possible
2. **Add validation** to ensure transcript paths are accessible
3. **Document** the dual-path architecture in system documentation
4. **Consider** adding health checks for transcript directory access

## Related Files

- `backend/src/mcp/servers/execution/execute_story_with_workflow.ts`
- `backend/src/mcp/servers/execution/start_workflow_run.ts`
- `backend/src/workers/processors/code-analysis.processor.ts`
- `docker-compose.prod.yml`

## Testing Results (2025-11-18 20:13)

### ✅ Configuration Verified
- `PROJECT_HOST_PATH` environment variable set: `/opt/stack/AIStudio` ✓
- Backend container rebuilt with all code changes ✓
- Compiled JavaScript contains correct logic ✓
- Environment variable accessible via `docker exec` ✓

### ⚠️ Issue Identified - Runtime Environment Variable Access

**Problem:** Despite correct configuration, workflow execution still writes `/app` to database instead of `/opt/stack/AIStudio`.

**Evidence:**
```bash
# Env var IS set in container:
$ docker exec vibe-studio-backend env | grep PROJECT_HOST_PATH
PROJECT_HOST_PATH=/opt/stack/AIStudio  ✓

# Node CAN access it:
$ docker exec vibe-studio-backend node -e "console.log(process.env.PROJECT_HOST_PATH)"
/opt/stack/AIStudio  ✓

# But database shows /app:
$ psql ... "SELECT metadata->'_transcriptTracking'->>'projectPath' FROM workflow_runs"
/app  ✗
```

**Root Cause:** The MCP server may not access `process.env` correctly at runtime, OR there's a context/timing issue where the variable evaluates to `undefined` during handler execution.

## Solutions

### ✅ Solution 1: Explicit CWD Parameter (IMMEDIATE WORKAROUND)

Pass `cwd` explicitly when calling the workflow:

```typescript
execute_story_with_workflow({
  storyId: "f4791b6b-2e06-4b42-ad97-70cf886fe022",
  workflowId: "f2279312-e340-409a-b317-0d4886a868ea",
  triggeredBy: "orchestrator",
  cwd: "/opt/stack/AIStudio"  // ← Explicit host path
})
```

### 🔧 Solution 2: NestJS ConfigService (RECOMMENDED FIX)

Replace `process.env` with NestJS's `ConfigService`:

```typescript
// execute_story_with_workflow.ts
import { ConfigService } from '@nestjs/config';

export async function handler(
  prisma: PrismaClient,
  params: any,
  configService: ConfigService  // Add this
) {
  const hostPath = params.cwd ||
                   configService.get('PROJECT_HOST_PATH') ||
                   story.project.localPath;
  // ...
}
```

### 🔍 Solution 3: Add Debug Logging

Temporarily add logging to diagnose:

```typescript
console.log('[DEBUG] process.env.PROJECT_HOST_PATH:', process.env.PROJECT_HOST_PATH);
console.log('[DEBUG] params.cwd:', params.cwd);
console.log('[DEBUG] story.project.localPath:', story.project.localPath);
console.log('[DEBUG] final hostPath:', hostPath);
```

## Current Workaround

**For immediate use**, always pass `cwd` explicitly:

```typescript
const result = await mcp__vibestudio__execute_story_with_workflow({
  storyId: "...",
  workflowId: "...",
  triggeredBy: "orchestrator",
  cwd: "/opt/stack/AIStudio"  // Must provide this
});
```

## Next Steps

1. ✅ Configuration complete
2. ✅ Backend rebuilt
3. ⚠️ Runtime env var access needs investigation
4. 🔧 Implement Solution 2 (ConfigService) **OR** use Solution 1 (explicit cwd)
5. ✅ Document findings

---

**Date:** 2025-11-18
**Fixed By:** Claude (orchestrator-claude)
**Story:** ST-17 - Workflow Execution Testing
**Status:** Configuration complete, awaiting runtime env var fix or explicit cwd usage
