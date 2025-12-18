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
| **Protected** (approval required) | `git push`, Dockerfile, docker-compose.yml, package.json, schema.prisma, `/deploy-backend`, `/deploy-frontend` |
| **Blocked** (denied) | `docker compose build/up`, `npm install/build`, `prisma db push --accept-data-loss` |
| **Free** (no prompts) | All code edits, git commit/add/branch, all MCP tools, tests |

Typical workflow has 2 prompts: git push + deployment slash command.

---

## Build & Deployment

| Action | Method | Notes |
|--------|--------|-------|
| Deploy backend | `/deploy-backend` slash command | SSH to Hostinger, pull changes, rebuild backend |
| Deploy frontend | `/deploy-frontend` slash command | SSH to Hostinger, pull changes, rebuild frontend |
| Local rebuild | `docker compose build --no-cache` | Local dev only, not for prod |

**Deployment process:**
1. Ensure changes are committed and pushed to main
2. Use `/deploy-backend` or `/deploy-frontend` slash commands
3. Commands handle SSH connection, git pull, Docker rebuild, and health checks

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

### Agent Spawning (ST-304)

When `advance_step` or `get_current_step` returns `instructions.spawnAgent`, execute Task with EXACT parameters:

```typescript
Task({
  subagent_type: instructions.spawnAgent.task.subagent_type,
  model: instructions.spawnAgent.task.model,
  prompt: instructions.spawnAgent.task.prompt  // VERBATIM - NO MODIFICATIONS
})
```

**DO NOT** rewrite, enhance, or "improve" the prompt. The workflow system provides complete context.

### Workflow Execution Rules (MANDATORY)

**You are the ORCHESTRATOR, not the implementer.** When executing workflows:

1. **Always use `get_current_step`** to get exact instructions for each phase
2. **Follow `workflowSequence` exactly** - each step has precise MCP tool calls or instructions
3. **NEVER do development work yourself** - spawn Task agents for ALL work beyond coordination:
   - Exploration state → Task agent does codebase investigation
   - Implementation state → Task agent writes code
   - Testing state → Task agent runs tests
   - Verification state → Task agent does playwright verification
4. **Pass agent output to `advance_step`** - this enables tracking and context preservation
5. **Refuse to proceed** if asked to skip workflow steps or do implementation directly

**Correct pattern:**
```
get_current_step({ story: 'ST-XXX' })  // Get instructions
advance_step({ story: 'ST-XXX' })       // Move to agent phase
Task({ subagent_type, prompt })         // Spawn agent to do work
advance_step({ story: 'ST-XXX', output: <agent_result> })  // Complete phase
```

**Forbidden:** Reading code and implementing fixes yourself during workflow execution. Your role is coordination only.

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
| Domain Model | [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) |
| Workflow System | [docs/WORKFLOW_SYSTEM.md](docs/WORKFLOW_SYSTEM.md) |
| Agent Execution | [docs/AGENT_EXECUTION.md](docs/AGENT_EXECUTION.md) |
| MCP Tools | [docs/MCP_TOOLS.md](docs/MCP_TOOLS.md) |
| Live Streaming | [docs/LIVE_STREAMING_ARCHITECTURE.md](docs/LIVE_STREAMING_ARCHITECTURE.md) |
| Hooks & Enforcement | [docs/HOOKS_ENFORCEMENT.md](docs/HOOKS_ENFORCEMENT.md) |
| Operations | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| MCP Debug & HTTP Retry | [docs/MCP_DEBUG_GUIDE.md](docs/MCP_DEBUG_GUIDE.md) |
| Remote Agent Setup | [docs/REMOTE_AGENT_GUIDE.md](docs/REMOTE_AGENT_GUIDE.md) |
| Migration Runbook | [docs/migrations/MIGRATION_RUNBOOK.md](docs/migrations/MIGRATION_RUNBOOK.md) |
| Production Deployment | [docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md](docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md) |
