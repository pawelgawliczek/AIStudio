# ST-44 Critical Bug: Cannot Deploy Stories with Worktrees

## Bug Description

**Severity:** 🔴 Critical - Blocks entire EP-7 workflow
**Discovered During:** ST-71 manual EP-7 workflow execution
**Status:** ST-44 marked "done" but has critical design flaw

## Problem

The `deploy_to_test_env` tool tries to checkout feature branches in the main worktree, but **fails when the branch is already checked out in a dev worktree**.

Git forbids the same branch being checked out in multiple worktrees simultaneously.

### Error Message
```
Deployment failed during git_checkout:
Failed to checkout branch feature/ST-71-test-coverage-display:
Git command failed: fatal: 'feature/ST-71-test-coverage-display' is already used by worktree at '/opt/stack/worktrees/feature/ST-71-test-coverage-display'
```

## Root Cause

**Current Implementation (ST-44):**
```typescript
// deploy-to-test-env.service.ts
async deploy(storyId: string) {
  // ❌ BROKEN: Tries to checkout in main worktree
  await this.gitCheckout(branch);
  await this.buildContainers();
}
```

**The flaw:** ST-44 was designed to checkout branches in main worktree, but EP-7 stories use dedicated dev worktrees. These two approaches conflict.

## Impact

- ❌ Cannot test any story that uses a worktree (entire EP-7 flow broken)
- ❌ ST-39 (Create Worktree) and ST-44 (Deploy) are incompatible
- ❌ Manual workaround required for every story
- ❌ Blocks automated workflow (ST-51)

## Architecture Misunderstanding

ST-44 was implemented assuming:
> "Checkout story branch in main worktree (`/opt/stack/AIStudio`)"

But EP-7 workflow creates **dedicated dev worktrees** for isolation:
- Dev worktree: `/opt/stack/worktrees/ST-71/` (has feature branch)
- Main worktree: `/opt/stack/AIStudio/` (stays on main)

**Cannot checkout same branch in both places!**

## Correct Solution

### Architecture: Volume Mount Switching

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST MACHINE                              │
│                                                               │
│  Main Worktree          Dev Worktree (ST-71)                │
│  /opt/stack/AIStudio/   /opt/stack/worktrees/ST-71/         │
│  (main branch)          (feature/ST-71 branch)              │
│         │                        │                           │
│         └────────┬───────────────┘                           │
│                  │ Switch via volume mount                   │
│                  ▼                                           │
│         ┌────────────────────┐                               │
│         │  Docker Containers │                               │
│         │  (shared instance) │                               │
│         └────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Fix

```typescript
// deploy-to-test-env.service.ts (FIXED)
async deploy(storyId: string) {
  const story = await this.getStory(storyId);

  // ✅ Check if story has a worktree
  const worktree = await this.prisma.worktree.findFirst({
    where: {
      storyId,
      status: 'active'
    }
  });

  let codePath: string;

  if (worktree) {
    // ✅ Use existing dev worktree (EP-7 workflow)
    codePath = worktree.path;
    this.logger.log(`Using dev worktree: ${codePath}`);
  } else {
    // ✅ Fallback: checkout in main worktree (non-EP-7 stories)
    codePath = '/opt/stack/AIStudio';
    await this.gitCheckout(story.branch);
    this.logger.log(`Using main worktree: ${codePath}`);
  }

  // ✅ Set volume mount path for Docker
  process.env.CODE_PATH = codePath;

  // ✅ Rebuild containers with new volume mount
  await this.buildContainers();

  // ✅ Restart services
  await this.restartServices();

  // ✅ Wait for health checks
  await this.waitForHealthChecks();
}
```

### Docker Compose Update

```yaml
# docker-compose.yml
services:
  backend:
    build:
      context: ${CODE_PATH:-.}  # ← Use env var, default to current dir
    volumes:
      - ${CODE_PATH:-.}/backend:/app  # ← Switch mount path

  frontend:
    build:
      context: ${CODE_PATH:-.}
    volumes:
      - ${CODE_PATH:-.}/frontend:/app  # ← Switch mount path
```

## Changes Required

### Files to Modify

1. **backend/src/mcp/servers/deployment/deploy-to-test-env.service.ts**
   - Add worktree detection logic
   - Set `CODE_PATH` environment variable
   - Skip git checkout if using worktree

2. **docker-compose.yml**
   - Add `${CODE_PATH}` variable to volume mounts
   - Default to `.` (current directory)

3. **backend/prisma/schema.prisma**
   - Verify `Worktree` model has `path` field (already exists)

### Testing Requirements

- [ ] Test with worktree story (EP-7 flow)
- [ ] Test without worktree (legacy flow)
- [ ] Test volume mount switching works
- [ ] Test container rebuild picks up correct code
- [ ] Test health checks pass after deployment
- [ ] Test concurrent worktree isolation

## Acceptance Criteria (Updated)

- [x] Create `mcp__vibestudio__deploy_to_test_env` tool
- [x] Input: storyId
- [x] Fetch latest from origin
- [ ] **NEW:** Check if story has active worktree
- [ ] **NEW:** If worktree exists, use worktree path (don't checkout)
- [ ] **MODIFIED:** If no worktree, checkout story branch in main worktree
- [ ] **NEW:** Set CODE_PATH environment variable
- [x] If schema changes detected: lock queue, apply migrations
- [x] If dependency changes detected: run npm install
- [x] If .env changes detected: validate and merge
- [ ] **MODIFIED:** If Docker changes OR worktree deployment: rebuild containers with correct CODE_PATH
- [x] Restart containers
- [x] Wait for health checks to pass (max 2 minutes)
- [x] Update test queue status to 'running'
- [x] Return deployment status

## Priority

**P0 - Critical:** Blocks entire EP-7 workflow. ST-44 should be reopened and marked as "blocked" or "in review" until this fix is implemented.

## Workaround (Temporary)

For ST-71, manually deploy from dev worktree:
```bash
cd /opt/stack/worktrees/feature/ST-71-test-coverage-display
docker compose build backend frontend --no-cache
docker compose up -d backend frontend
npm test
```

But this defeats the purpose of automated EP-7 workflow.

## Related Stories

- ST-39: Create Worktree (works correctly)
- ST-44: Deploy to Test Environment (❌ broken for worktree stories)
- ST-45: Run Tests (blocked by ST-44)
- ST-51: End-to-End Workflow (blocked by ST-44)

## Timeline Impact

- ST-71 manual testing: Blocked until manual workaround
- EP-7 automation: Cannot proceed until ST-44 fixed
- All future worktree-based stories: Will hit this bug

---

**Recommendation:** Reopen ST-44 immediately, implement fix, then continue ST-71 testing.
