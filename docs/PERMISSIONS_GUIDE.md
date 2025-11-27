# Claude Code Permissions Guide

## Overview

This guide documents the permission structure for AI Studio development, ensuring safe production operations while enabling fast iteration in test environments.

## Infrastructure Overview

### Production Environment
- **Path**: `/opt/stack/AIStudio` (main worktree)
- **Database**: postgres:5432 (exposed as 127.0.0.1:5433)
- **Containers**: `vibe-studio-backend`, `vibe-studio-frontend`
- **Redis**: redis:6379
- **Migrations**: MUST use `npm run migrate:safe` from ROOT

### Test Environment (Worktrees)
- **Path**: `/opt/stack/worktrees/*`
- **Database**: test-postgres:5434 (isolated, ephemeral)
- **Containers**: `test-backend`, `test-frontend`
- **Redis**: test-redis:6381 (isolated)
- **Migrations**: Can use any method (including `prisma db push`)

## Permission Categories

### 1. Database Migrations

#### ALWAYS DENIED (Unsafe Operations)
```json
"deny": [
  "Bash(prisma db push --accept-data-loss:*)",
  "Bash(npx prisma db push --accept-data-loss:*)"
]
```

**Rationale**: These commands can destroy production data. There is NO safe use case.

#### MUST ASK (Production Migrations)
```json
"ask": [
  "Bash(npm run migrate:safe:*)",
  "Bash(cd /opt/stack/AIStudio && npm run migrate:safe:*)",
  "Bash(prisma migrate deploy:*)",
  "Bash(npx prisma migrate deploy:*)",
  "Bash(DATABASE_URL='postgresql://postgres:*@127.0.0.1:5432/*' npx prisma migrate:*)",
  "Bash(DATABASE_URL='postgresql://postgres:*@127.0.0.1:5433/*' npx prisma migrate:*)"
]
```

**Rationale**:
- Port 5432/5433 = production database
- Requires human approval for production schema changes
- Safe migration script (`migrate:safe`) enforces backups and validation

#### AUTO-ALLOWED (Test Migrations)
```json
"allow": [
  "Bash(DATABASE_URL='postgresql://postgres:*@127.0.0.1:5434/*' npx prisma db push:*)",
  "Bash(DATABASE_URL='postgresql://postgres:test@127.0.0.1:5434/*' npx prisma migrate:*)"
]
```

**Rationale**:
- Port 5434 = isolated test database (ephemeral)
- Fast iteration without breaking production
- Database recreated for each test run

### 2. Docker Operations

#### MUST ASK (Production)
```json
"ask": [
  "Bash(docker compose build backend:*)",
  "Bash(docker compose build frontend:*)",
  "Bash(docker compose up -d:*)",
  "Bash(docker compose restart:*)",
  "Bash(docker restart vibe-studio-backend:*)",
  "Bash(docker restart vibe-studio-frontend:*)"
]
```

**Rationale**: Production containers serve live application

#### AUTO-ALLOWED (Test)
```json
"allow": [
  "Bash(docker compose -f docker-compose.test.yml:*)",
  "Bash(docker build -t test-backend:*)",
  "Bash(docker build -t test-frontend:*)",
  "Bash(docker compose up -d test-backend:*)",
  "Bash(docker compose up -d test-frontend:*)"
]
```

**Rationale**: Test infrastructure is isolated

### 3. Standard Development

#### AUTO-ALLOWED (Safe Operations)
```json
"allow": [
  "Read(**)",
  "Grep(**)",
  "Glob(**)",
  "Edit(**/*.ts)",
  "Edit(**/*.tsx)",
  "Edit(**/*.js)",
  "Edit(**/*.jsx)",
  "Edit(**/*.css)",
  "Edit(**/*.html)",
  "Edit(**/*.md)",
  "Edit(**/*.json)",
  "Write(**/*.ts)",
  "Write(**/*.tsx)",
  "Write(**/*.js)",
  "Write(**/*.jsx)",
  "Write(**/*.css)",
  "Write(**/*.html)",
  "Write(**/*.md)",
  "Write(**/*.json)",
  "Bash(npm test:*)",
  "Bash(npm run test:*)",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "mcp__vibestudio__*"
]
```

## Complete Settings Example

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(chmod -R:*)",
      "Bash(chown -R:*)",
      "Bash(prisma db push --accept-data-loss:*)",
      "Bash(npx prisma db push --accept-data-loss:*)"
    ],
    "ask": [
      "Bash(npm run migrate:safe:*)",
      "Bash(prisma migrate deploy:*)",
      "Bash(DATABASE_URL='*@127.0.0.1:5432/*' npx prisma:*)",
      "Bash(DATABASE_URL='*@127.0.0.1:5433/*' npx prisma:*)",
      "Bash(docker compose build:*)",
      "Bash(docker compose up -d:*)",
      "Bash(docker compose restart:*)",
      "Bash(docker restart vibe-studio-*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Edit(**/package.json)",
      "Edit(**/tsconfig.json)",
      "Edit(**/docker-compose.yml)",
      "Edit(**/Dockerfile)",
      "Edit(**/.env*)",
      "Edit(**/prisma/schema.prisma)"
    ],
    "allow": [
      "Read(**)",
      "Grep(**)",
      "Glob(**)",
      "Task",
      "TodoWrite",
      "Edit(**/*.ts)",
      "Edit(**/*.tsx)",
      "Edit(**/*.js)",
      "Edit(**/*.jsx)",
      "Edit(**/*.css)",
      "Edit(**/*.html)",
      "Edit(**/*.md)",
      "Edit(**/*.json)",
      "Write(**/*.ts)",
      "Write(**/*.tsx)",
      "Write(**/*.js)",
      "Write(**/*.jsx)",
      "Write(**/*.css)",
      "Write(**/*.html)",
      "Write(**/*.md)",
      "Write(**/*.json)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(npm test:*)",
      "Bash(npm run test:*)",
      "Bash(docker ps:*)",
      "Bash(docker logs:*)",
      "Bash(DATABASE_URL='*@127.0.0.1:5434/*' npx prisma db push:*)",
      "Bash(DATABASE_URL='*@127.0.0.1:5434/*' npx prisma migrate:*)",
      "mcp__vibestudio__*"
    ],
    "defaultMode": "acceptEdits"
  }
}
```

## Migration Workflows

### Production Migration (REQUIRES APPROVAL)

1. Create migration in worktree:
   ```bash
   cd /opt/stack/worktrees/st-XX-feature
   cd backend
   npx prisma migrate dev --create-only --name add_feature
   ```

2. Preview changes:
   ```bash
   cd /opt/stack/AIStudio  # ROOT directory!
   npm run migrate:safe:dry-run
   ```

3. Execute (WILL ASK FOR APPROVAL):
   ```bash
   cd /opt/stack/AIStudio  # ROOT directory!
   npm run migrate:safe -- --story-id=ST-XX
   ```

### Test Migration (AUTO-APPROVED)

In worktree development, fast iteration allowed:
```bash
cd /opt/stack/worktrees/st-XX-feature/backend
npx prisma migrate dev --name add_feature
# OR for quick prototyping:
DATABASE_URL='postgresql://postgres:test@127.0.0.1:5434/vibestudio_test' npx prisma db push
```

## Port-Based Detection

| Port | Environment | Requires Approval? |
|------|-------------|-------------------|
| 5432 | Production (internal) | ✅ YES |
| 5433 | Production (host) | ✅ YES |
| 5434 | Test (isolated) | ❌ NO |
| 6379 | Production Redis | ✅ YES |
| 6381 | Test Redis | ❌ NO |

## Troubleshooting

### "Permission denied" for test operations
**Problem**: Test migrations being blocked
**Solution**: Check DATABASE_URL uses port 5434, not 5432/5433

### Safe migration asking for approval even though allowed
**Problem**: Rule not matching command
**Solution**: Ensure running from ROOT directory: `cd /opt/stack/AIStudio`

### Can't push to test database
**Problem**: Test postgres not running
**Solution**: Start test infrastructure first:
```bash
docker compose up -d test-postgres test-redis
```

## References

- [Migration Runbook](./migrations/MIGRATION_RUNBOOK.md)
- [CLAUDE.md Build Rules](../CLAUDE.md)
- [Docker Compose](../docker-compose.yml)
