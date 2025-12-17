## Project Context

**Project ID:** `345a29ee-d6ab-477d-8079-c5dda0844d77` (AI Studio)

---

## Environment Detection

| Indicator | Mode | Permissions |
|-----------|------|-------------|
| Path `/opt/stack/worktrees/st-*` | TEST | Read-only MCP, test DB (5434) only |
| Path `/opt/stack/AIStudio` | PROD | Full access |
| URL with `test.` prefix | TEST | Read-only MCP |
| URL without `test.` prefix | PROD | Full access |

**Test mode:** Use only read-only MCP tools (list_*, get_*, search_*). Modify only current worktree, never main worktree.

**Production mode:** Full access. Follow deployment rules below.

---

## Permissions (Enforced by .claude/settings.local.json)

| Category | Items |
|----------|-------|
| **Protected** (approval required) | `deploy_to_production`, `git push`, Dockerfile, docker-compose.yml, package.json, schema.prisma |
| **Blocked** (denied) | `docker compose build/up`, `npm install/build`, `prisma db push --accept-data-loss` |
| **Free** (no prompts) | All code edits, git commit/add/branch, all MCP tools (except deploy_to_production), tests |

Typical workflow has 2 prompts: git push + deploy_to_production.

---

## Build & Deployment

| Action | Method | Notes |
|--------|--------|-------|
| Deploy production | `deploy_to_production` MCP | `confirmDeploy: true` required |
| Deploy test | `deploy_to_test_env` MCP | - |
| Local rebuild | `docker compose build --no-cache` | Local dev only, not for prod |

**Deployment modes:**
- **PR mode:** Story in qa/done status + PR approved & merged
- **Direct commit mode:** Story in qa/done status + `approve_deployment` tool first (valid 60 min)

**Never use:** `npm run build`, `npm install`, direct Docker commands for production.

---

## Database Migrations

**Run from ROOT directory only:**

```bash
cd /opt/stack/AIStudio && npm run migrate:safe -- --story-id=ST-XX
```

**Create migration:**

```bash
cd /opt/stack/AIStudio/backend && npx prisma migrate dev --create-only --name <description>
```

**Never use:** `prisma db push`, `prisma migrate deploy` without the safe wrapper.

---

## Architecture Quick Reference

### Workflow System

Uses **components** (not coordinators). Orchestrator spawns component agents (PM, Explorer, Architect, Designer, Implementer).

### Execution Modes

| Mode | Tool | Use Case |
|------|------|----------|
| MasterSession | `get_current_step` → `advance_step` loop | Interactive development |
| Docker Runner | `start_runner` | Autonomous/background execution |

### API Paths

Services call `/endpoint`, api.client prepends `/api`. Never add `/api` prefix to service paths (causes double `/api/api/`).

### SSH Access

Use `ssh hostinger` (not `ssh kvm`).

### Loki Log Queries

Use the helper script for Loki queries (auto-approved):
```bash
.claude/scripts/loki-query.sh '{compose_service="backend"}' 20
.claude/scripts/loki-query.sh '{compose_service="backend"} |~ "error"' 50
```
The script handles authentication and time range automatically.

---

## Claude Code Hooks

| Hook | File | Purpose |
|------|------|---------|
| SessionStart | `vibestudio-session-start.sh` | Track transcripts, handle compaction recovery |
| SessionEnd | `vibestudio-session-end.sh` | Mark session ended |
| PostToolUse: ExitPlanMode | `vibestudio-implementation.sh` | Guide to story/team workflow |
| PostToolUse: Task | `vibestudio-track-agents.sh` | Track spawned agent transcripts |

After compaction, call `get_orchestration_context` with new sessionId and transcriptPath.

---

## Reference Documentation

| Topic | Location |
|-------|----------|
| MCP Debug & HTTP Retry | [docs/MCP_DEBUG_GUIDE.md](docs/MCP_DEBUG_GUIDE.md) |
| Remote Agent Setup | [docs/REMOTE_AGENT_GUIDE.md](docs/REMOTE_AGENT_GUIDE.md) |
| Migration Runbook | [docs/migrations/MIGRATION_RUNBOOK.md](docs/migrations/MIGRATION_RUNBOOK.md) |
| Production Deployment | [docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md](docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md) |
