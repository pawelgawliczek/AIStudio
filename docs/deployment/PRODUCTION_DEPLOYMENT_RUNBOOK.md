# Production Deployment Runbook

**ST-77: Production Deployment Safety System**

This runbook describes the production deployment process with comprehensive safety safeguards.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Workflow](#deployment-workflow)
4. [Safety Safeguards](#safety-safeguards)
5. [Emergency Procedures](#emergency-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Audit Trail](#audit-trail)

---

## Overview

Production deployments are orchestrated by the `deploy_to_production` MCP tool, which enforces:
- **Single deployment at a time** (deployment lock)
- **PR approval workflow** (at least 1 approval required)
- **Merge validation** (PR must be merged to main)
- **Pre-deployment backup** (automatic)
- **Health checks** (3 consecutive successes)
- **Auto-rollback** (on failure)
- **Complete audit trail** (7-year retention)

**CRITICAL**: Production deployments can ONLY be executed via the `deploy_to_production` MCP tool. Direct Docker commands are **FORBIDDEN** for production.

---

## Prerequisites

### Story Readiness

- [ ] Story is in `qa` or `done` status
- [ ] All acceptance criteria validated
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Code reviewed and approved

### PR Requirements

- [ ] PR created and linked to story
- [ ] At least 1 approval from reviewer
- [ ] All CI checks passing
- [ ] No merge conflicts with main
- [ ] PR merged to main branch

### Environment Checks

- [ ] Production database healthy
- [ ] Backup system operational
- [ ] Disk space > 20GB available
- [ ] No active deployment in progress

---

## Deployment Workflow

### Step 1: Validate Prerequisites

```typescript
// Check story status
get_story({ storyId: "story-uuid" })

// Check PR status
get_pr_status({ prNumber: 42 })

// Check deployment lock status
// (This is done automatically by deploy_to_production)
```

### Step 2: Execute Deployment

```typescript
deploy_to_production({
  storyId: "905d1a9c-1337-4cf7-b7f6-72b55db9e336",
  prNumber: 42,
  triggeredBy: "your-identifier",
  confirmDeploy: true  // REQUIRED
})
```

### Step 3: Monitor Deployment

The deployment executes the following phases automatically:

1. **Validation** (30s)
   - Story status check
   - PR approval validation
   - Worktree validation

2. **Lock Acquisition** (5s)
   - Acquire deployment lock
   - Block concurrent deployments

3. **Pre-Deployment Backup** (60-120s)
   - Create database backup
   - Verify backup integrity

4. **Build Backend** (180-300s)
   - `docker compose build backend --no-cache`
   - Verify build success

5. **Build Frontend** (120-240s)
   - `docker compose build frontend --no-cache`
   - Verify build success

6. **Restart Backend** (30s)
   - `docker compose up -d backend`
   - Wait for container start

7. **Restart Frontend** (30s)
   - `docker compose up -d frontend`
   - Wait for container start

8. **Health Checks** (60-120s)
   - Backend: 3 consecutive successes
   - Frontend: 3 consecutive successes
   - 5-second delay between checks

9. **Lock Release** (5s)
   - Release deployment lock
   - Update deployment log

**Total Duration**: 8-12 minutes (typical)

### Step 4: Verify Deployment

```bash
# Check backend health
curl http://localhost:3000/health

# Check frontend
curl http://localhost:5173

# Check container status
docker compose ps

# Check recent logs
docker compose logs backend --tail 50
docker compose logs frontend --tail 50
```

---

## Safety Safeguards

### AC1: Deployment Lock Enforcement

- **Database-level singleton** prevents concurrent deployments
- Lock duration: 30 minutes (auto-expires)
- Lock renewal supported for long deployments

**Error**: "Production deployment locked by {user}"
**Resolution**: Wait for current deployment to complete or contact lock owner

### AC2: PR Approval Workflow

- At least 1 approval required
- Validated via GitHub API
- Approval must be current (not dismissed)

**Error**: "PR #42 has no approvals"
**Resolution**: Get PR approved by team member before deploying

### AC3: Merge Conflict Detection

- PR must be merged to main
- No conflicts allowed

**Error**: "PR #42 has merge conflicts"
**Resolution**: Resolve conflicts, update PR, merge, then deploy

### AC4: Pre-Deployment Backup

- Automatic backup creation
- Backup verification before proceeding
- Stored in `/backups` directory

**Skip Option**: `skipBackup: true` (EMERGENCY ONLY)

### AC5: Docker Build and Deployment

- Sequential builds (backend → frontend)
- Always uses `--no-cache` flag
- Full container rebuild for safety

### AC6: Health Check Validation

- 3 consecutive successes required
- 5-second delay between checks
- Checks both backend and frontend

**Skip Option**: `skipHealthChecks: true` (EMERGENCY ONLY)

### AC7: Deployment Audit Trail

- Complete deployment log created
- Status: pending → deploying → deployed/failed/rolled_back
- Metadata: phases, duration, errors, warnings
- Retention: 7 years (SOC2 compliance)

**Query Logs**:
```sql
SELECT * FROM deployment_logs
WHERE story_id = 'uuid'
ORDER BY created_at DESC;
```

### AC8: Rollback on Failure

- Automatic rollback if deployment fails
- Restores from pre-deployment backup
- Rollback duration: < 10 minutes

### AC9: CLAUDE.md Permission Enforcement

- Direct Docker commands forbidden for production
- Only `deploy_to_production` MCP tool allowed
- Documented in `/opt/stack/AIStudio/CLAUDE.md`

### AC10: Structured Error Handling

- Clear error messages
- Actionable guidance
- Phase-by-phase status

---

## Emergency Procedures

### Emergency Deployment (Skip Safeguards)

**⚠️ USE WITH EXTREME CAUTION**

```typescript
deploy_to_production({
  storyId: "uuid",
  prNumber: 42,
  triggeredBy: "emergency-user",
  confirmDeploy: true,
  skipBackup: true,        // Skip backup creation
  skipHealthChecks: true   // Skip health checks
})
```

**When to Use**:
- Critical security patch
- Production outage requiring immediate fix
- Backup system failure

**Warnings**:
- No automatic rollback if backup skipped
- Health check failures not detected
- Manual verification required

### Force Release Deployment Lock

If deployment lock is stuck:

```typescript
// Check lock status
const lockService = new DeploymentLockService();
const status = await lockService.checkLockStatus();

// Force release (if needed)
await lockService.forceReleaseLock(
  status.lockId,
  "Reason for force release"
);
```

---

## Rollback Procedures

### Automatic Rollback

- Triggered automatically on deployment failure
- Uses pre-deployment backup
- Restores database state
- Duration: < 10 minutes

### Manual Rollback

If automatic rollback fails:

```bash
# 1. List backups
ls -lh /backups/

# 2. Identify pre-deployment backup
# Format: vibestudio_pre_deployment_ST-XX-PR-XX_YYYYMMDD_HHMMSS.dump

# 3. Restore manually
cd /opt/stack/AIStudio
npm run db:restore

# 4. Select backup file when prompted

# 5. Verify restore
docker compose exec backend npm run prisma:validate
```

### Rollback Verification

```bash
# Check database schema
docker compose exec backend npx prisma db pull

# Check container health
docker compose ps

# Check application logs
docker compose logs backend --tail 100
docker compose logs frontend --tail 100

# Test critical endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/stories
```

---

## Troubleshooting

### Deployment Stuck at Lock Acquisition

**Symptom**: "Production deployment locked by {user}"

**Diagnosis**:
```typescript
const lockService = new DeploymentLockService();
const status = await lockService.checkLockStatus();
console.log(status);
```

**Resolution**:
1. Check if deployment is actually running
2. Contact lock owner if possible
3. Wait for auto-expiry (30 minutes)
4. Force release if emergency (see Emergency Procedures)

### Build Fails

**Symptom**: "Failed to build backend/frontend container"

**Diagnosis**:
```bash
# Check build logs
docker compose build backend --no-cache
docker compose build frontend --no-cache

# Check disk space
df -h

# Check Docker daemon
docker info
```

**Resolution**:
1. Fix build errors in code
2. Free up disk space if needed
3. Restart Docker daemon if necessary
4. Retry deployment

### Health Checks Fail

**Symptom**: "Health checks failed. Backend: 2/3, Frontend: 3/3"

**Diagnosis**:
```bash
# Check container status
docker compose ps

# Check logs
docker compose logs backend --tail 100

# Test health endpoint directly
curl http://localhost:3000/health
```

**Resolution**:
1. Check container startup logs for errors
2. Verify environment variables
3. Check database connectivity
4. Restart containers manually if needed
5. Retry deployment

### Rollback Fails

**Symptom**: "Rollback failed: {error message}"

**Critical Actions**:
1. **DO NOT PANIC** - Production state is known
2. Check backup file exists and is valid
3. Attempt manual restore (see Manual Rollback)
4. Escalate to senior engineer if needed
5. Document incident for post-mortem

---

## Audit Trail

### Deployment Logs

All deployments are logged in the `deployment_logs` table:

```sql
-- Recent deployments
SELECT
  id,
  story_id,
  pr_number,
  status,
  deployed_by,
  deployed_at,
  completed_at,
  environment
FROM deployment_logs
ORDER BY created_at DESC
LIMIT 10;

-- Failed deployments
SELECT * FROM deployment_logs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Deployment for specific story
SELECT * FROM deployment_logs
WHERE story_id = 'uuid'
ORDER BY created_at DESC;
```

### Deployment Locks

All lock acquisitions/releases logged in `deployment_locks` table:

```sql
-- Active locks
SELECT * FROM deployment_locks
WHERE active = true;

-- Recent lock history
SELECT
  id,
  story_id,
  pr_number,
  reason,
  locked_by,
  locked_at,
  released_at
FROM deployment_locks
ORDER BY created_at DESC
LIMIT 20;
```

### Metrics

**Success Rate**:
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM deployment_logs
WHERE environment = 'production'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY status;
```

**Average Duration**:
```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (completed_at - deployed_at))) as avg_duration_seconds
FROM deployment_logs
WHERE status = 'deployed'
  AND environment = 'production'
  AND created_at > NOW() - INTERVAL '30 days';
```

---

## Compliance

### SOC2 Requirements

- ✅ Complete audit trail (7-year retention)
- ✅ Approval workflow enforcement
- ✅ Access control (MCP tool only)
- ✅ Change documentation (deployment logs)
- ✅ Rollback capability (< 10 minutes)

### Best Practices

1. **Never deploy on Friday** (unless critical)
2. **Deploy during low-traffic hours** (when possible)
3. **Monitor for 30 minutes post-deployment**
4. **Document any manual interventions**
5. **Run post-deployment smoke tests**

---

## Support

### Escalation Path

1. **Level 1**: Check this runbook
2. **Level 2**: Review deployment logs
3. **Level 3**: Contact deployment engineer
4. **Level 4**: Escalate to senior engineer

### Key Contacts

- **Deployment Engineer**: [Contact Info]
- **Database Admin**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **On-Call**: [Contact Info]

---

## Changelog

- **2025-11-22**: Initial runbook (ST-77)
- Deployment lock enforcement
- PR approval workflow
- Health check validation
- Auto-rollback on failure

---

**Last Updated**: 2025-11-22
**Version**: 1.0
**Owner**: ST-77 (Production Deployment Safety System)
