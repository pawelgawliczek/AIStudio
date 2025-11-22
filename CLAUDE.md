## Build and Deployment (CRITICAL)

**NEVER use npm/node commands for building. ALWAYS use Docker:**

### Production Deployment (ST-77)

**⚠️ CRITICAL: Production deployments MUST use the MCP tool ONLY**

#### Required Commands for Production

- ✅ **CORRECT**: Use `deploy_to_production` MCP tool ONLY
- ✅ **CORRECT**: Requires PR approval AND merge to main
- ✅ **CORRECT**: Requires confirmDeploy: true parameter
- ✅ **CORRECT**: Automatic pre-deployment backup
- ✅ **CORRECT**: 3 consecutive health checks required

#### Forbidden Commands for Production

- ❌ **NEVER USE**: `docker compose build` for production - Use MCP tool
- ❌ **NEVER USE**: `docker compose up -d` for production - Use MCP tool
- ❌ **NEVER USE**: Direct Docker commands for production - Use MCP tool
- ❌ **NEVER USE**: Manual container builds/restarts - Use MCP tool

#### Production Deployment Example

```typescript
// ✅ CORRECT - Only way to deploy to production
deploy_to_production({
  storyId: "uuid-here",
  prNumber: 42,
  triggeredBy: "claude-agent",
  confirmDeploy: true  // REQUIRED
})
```

#### Production Deployment Safeguards

The `deploy_to_production` MCP tool enforces:
1. Story in 'qa' or 'done' status
2. PR approved by at least 1 reviewer
3. PR merged to main branch
4. No merge conflicts
5. Deployment lock (only 1 deployment at a time)
6. Pre-deployment backup created automatically
7. Sequential builds (backend → frontend)
8. Health checks (3 consecutive successes)
9. Complete audit trail (7-year retention)
10. Auto-rollback on failure

### Test/Development Deployment

For test environment deployments, use `deploy_to_test_env` MCP tool.

### Local Development (Docker)

- ✅ **CORRECT**: `docker compose build backend --no-cache` - Rebuild backend (local only)
- ✅ **CORRECT**: `docker compose build frontend --no-cache` - Rebuild frontend (local only)
- ✅ **CORRECT**: `docker compose up -d <service>` - Start/restart service (local only)
- ✅ **CORRECT**: Use prod Dockerfile for all builds

### Forbidden Commands (All Environments)

- ❌ **NEVER USE**: `npm run build` - Won't be picked up by containers
- ❌ **NEVER USE**: `npm install` - Dependencies managed by Docker
- ❌ **NEVER USE**: Direct TypeScript compilation - Use Docker build

### Build Rules

- Backend: Always use `--no-cache` when rebuilding
- Frontend: Always use `--no-cache` when rebuilding
- Use `docker compose` (without hyphen)
- TypeScript changes require Docker rebuild, not just container restart
- **Production: ONLY use deploy_to_production MCP tool**

## Database Migration Safety (CRITICAL)

**ALWAYS use the safe migration system for ANY database schema changes:**

### ⚠️ CRITICAL: Directory Requirements

**Safe migration scripts are ONLY in the ROOT package.json, NOT in backend/package.json**

**YOU MUST run migration commands from the ROOT directory:**

```bash
# ✅ CORRECT - Run from ROOT
cd /opt/stack/AIStudio              # ← Always change to ROOT first!
npm run migrate:safe -- --story-id=ST-XX

# ❌ WRONG - Will fail with "Missing script" error
cd /opt/stack/AIStudio/backend      # ← Wrong directory!
npm run migrate:safe                # ← Script doesn't exist here!
```

**If you get "Missing script: migrate:safe" error:**
- You are in the WRONG directory (probably backend/)
- Change to ROOT directory: `cd /opt/stack/AIStudio`
- DO NOT use `prisma migrate deploy` as a fallback
- DO NOT proceed without the safe migration wrapper
- Report that ST-70 safe migration system needs verification

### Required Commands (Run from ROOT)

- ✅ **CORRECT**: `cd /opt/stack/AIStudio && npm run migrate:safe -- --story-id=ST-XX` - Safe migration with all safeguards
- ✅ **CORRECT**: `cd /opt/stack/AIStudio && npm run migrate:safe:dry-run` - Preview migrations
- ✅ **CORRECT**: `cd /opt/stack/AIStudio && npm run db:backup` - Manual backup
- ✅ **CORRECT**: `cd /opt/stack/AIStudio && npm run db:restore` - Restore from backup

### Forbidden Commands

- ❌ **NEVER USE**: `prisma db push --accept-data-loss` - Destroys production data
- ❌ **NEVER USE**: `prisma db push` without safeguards
- ❌ **NEVER USE**: Direct SQL without backup
- ❌ **NEVER USE**: `prisma migrate deploy` without the safe migration wrapper
- ❌ **NEVER USE**: `npx prisma migrate resolve --applied` without creating a backup first

### Migration Workflow (MANDATORY STEPS)

1. **Create migration in backend/**:
   ```bash
   cd /opt/stack/AIStudio/backend
   npx prisma migrate dev --create-only --name <description>
   ```

2. **Preview changes from ROOT**:
   ```bash
   cd /opt/stack/AIStudio
   npm run migrate:safe:dry-run
   ```

3. **Execute safely from ROOT**:
   ```bash
   cd /opt/stack/AIStudio
   npm run migrate:safe -- --story-id=ST-XX
   ```

4. The system automatically:
   - Creates pre-migration backup
   - Verifies backup integrity
   - Acquires queue lock (prevents concurrent migrations)
   - Applies migrations via `prisma migrate deploy`
   - Validates schema, data integrity, health
   - Runs smoke tests
   - Releases queue lock
   - Auto-rolls back on any failure

### Pre-Flight Validation

**Before ANY migration, verify the safe migration system exists:**

```bash
cd /opt/stack/AIStudio
if ! grep -q "migrate:safe" package.json; then
    echo "❌ ERROR: Safe migration system not found!"
    echo "ST-70 must be implemented first"
    exit 1
fi
```

**If validation fails:**
- STOP immediately
- DO NOT create or apply migrations
- DO NOT use unsafe migration commands as fallback
- Report dependency on ST-70 (Database Schema Migration Strategy & Safeguards)

### Enforcement

Any PR containing `prisma db push --accept-data-loss` will be **REJECTED**.

All schema changes MUST go through the safe migration system.

Documentation: `/docs/migrations/MIGRATION_RUNBOOK.md`

## Architecture Notes

### Workflow Execution System (IMPORTANT)
**We use COMPONENTS, not coordinators!**
- The workflow execution system is based on **workflow_components** (not coordinator_agents)
- Old references to `coordinator_agents` table should be removed
- Workflows link directly to components via the `workflows` table
- Component-based architecture: Orchestrator spawns component agents (PM, Explorer, Architect, Designer, Implementer, etc.)
- Do NOT reference or query coordinator_agents table - it doesn't exist in current schema