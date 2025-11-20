## Build and Deployment (CRITICAL)

**NEVER use npm/node commands for building. ALWAYS use Docker:**

### Required Commands

- ✅ **CORRECT**: `docker compose build backend --no-cache` - Rebuild backend
- ✅ **CORRECT**: `docker compose build frontend --no-cache` - Rebuild frontend
- ✅ **CORRECT**: `docker compose up -d <service>` - Start/restart service after build
- ✅ **CORRECT**: Use prod Dockerfile for all builds

### Forbidden Commands

- ❌ **NEVER USE**: `npm run build` - Won't be picked up by containers
- ❌ **NEVER USE**: `npm install` - Dependencies managed by Docker
- ❌ **NEVER USE**: Direct TypeScript compilation - Use Docker build

### Build Rules

- Backend: Always use `--no-cache` when rebuilding
- Frontend: Always use `--no-cache` when rebuilding
- Use `docker compose` (without hyphen)
- TypeScript changes require Docker rebuild, not just container restart

## Database Migration Safety (CRITICAL)

**ALWAYS use the safe migration system for ANY database schema changes:**

### Required Commands

- ✅ **CORRECT**: `npm run migrate:safe` - Safe migration with all safeguards
- ✅ **CORRECT**: `npm run migrate:safe:dry-run` - Preview migrations
- ✅ **CORRECT**: `npm run db:backup` - Manual backup
- ✅ **CORRECT**: `npm run db:restore` - Restore from backup

### Forbidden Commands

- ❌ **NEVER USE**: `prisma db push --accept-data-loss` - Destroys production data
- ❌ **NEVER USE**: `prisma db push` without safeguards
- ❌ **NEVER USE**: Direct SQL without backup
- ❌ **NEVER USE**: `prisma migrate deploy` without the safe migration wrapper

### Migration Workflow

1. Create migration: `npx prisma migrate dev --create-only --name <description>`
2. Preview changes: `npm run migrate:safe:dry-run`
3. Execute safely: `npm run migrate:safe --story-id=ST-XX`
4. The system automatically:
   - Creates pre-migration backup
   - Verifies backup integrity
   - Acquires queue lock (prevents concurrent migrations)
   - Applies migrations via `prisma migrate deploy`
   - Validates schema, data integrity, health
   - Runs smoke tests
   - Releases queue lock
   - Auto-rolls back on any failure

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