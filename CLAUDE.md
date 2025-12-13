## 🚨 Test Mode vs Production Mode (CRITICAL)

**ALWAYS check if you're working in a test environment before making ANY changes!**

### How to Detect Test Mode

**Indicators you're in TEST mode:**
1. Working in a worktree path: `/opt/stack/worktrees/st-XX-*`
2. User mentions "test environment" or testing a story
3. User provides test URL: `http://127.0.0.1:5174` or `http://127.0.0.1:3001` or `https://test.vibestudio.example.com`
4. File `TEST_MODE_ACTIVE.md` exists in current worktree

**IMPORTANT: Test Environment URLs (Same Environment)**
- `http://127.0.0.1:5174` = `https://test.vibestudio.example.com` (frontend)
- `http://127.0.0.1:3001` = Backend API
- These are **the same test environment** accessed via different URLs (local vs domain)
- Both point to the same test containers and test database (port 5434)

**Indicators you're in PRODUCTION mode:**
1. Working in main worktree: `/opt/stack/AIStudio`
2. User asks to deploy to production
3. User provides production URL: `https://vibestudio.example.com` (NO "test." prefix!)

### Test Mode Rules (When in Worktree)

**⛔ FORBIDDEN in Test Mode:**
- ❌ **NEVER use MCP tools that MODIFY data** (create_*, update_*, delete_*, deploy_to_production)
- ❌ **NEVER modify files in main worktree** (`/opt/stack/AIStudio`)
- ❌ **NEVER run production deployments**
- ❌ **NEVER modify production database** (port 5433)

**✅ ALLOWED in Test Mode:**
- ✅ **Read-only MCP tools** (list_*, get_*, search_*, mcp__vibestudio__list_*)
- ✅ **Modify code in CURRENT worktree** (e.g., `/opt/stack/worktrees/st-64-*`)
- ✅ **Query test database** (SELECT on port 5434)
- ✅ **Insert test data into test DB** (port 5434 only, via SQL)
- ✅ **Deploy to test environment** (deploy_to_test_env MCP tool)
- ✅ **Docker operations on test containers** (test-backend, test-frontend, test-postgres)

### Production Mode Rules (When in Main Worktree)

**Follow all standard production deployment rules below.**

---

## Claude Code Permission System (ST-96)

**Philosophy:** Code changes are safe (protected by git/PR workflow). Only gate actual production operations, critical infrastructure changes, and code distribution.

### Security Goals

1. ✅ **Zero prompts during normal development** - Edit, test, commit without interruption
2. ✅ **PROD protected** - Cannot accidentally deploy or migrate production
3. ✅ **Infrastructure protected** - Critical files require approval
4. ✅ **Code distribution controlled** - Git push requires approval
5. ✅ **Developer freedom** - Edit app code, run tests, use MCP tools without friction

### What's Protected (Requires Approval)

#### Production Operations
- ⚠️ **Production Deployments** - `deploy_to_production` MCP tool
- ⚠️ **Git Push** - Prevents wrong branch/remote (industry standard)

#### Critical Infrastructure Files
- ⚠️ **Build Files** - Dockerfile, docker-compose.yml, .dockerignore
- ⚠️ **Dependencies** - package.json, package-lock.json
- ⚠️ **Database Schema** - schema.prisma, migration files
- ⚠️ **Build Config** - tsconfig.json, vite.config.ts, webpack.config.js
- ⚠️ **Environment Config** - backend/src/config/*, .env files
- ⚠️ **CI/CD** - .github/workflows/*
- ⚠️ **CODEOWNERS** - Protects the protection system itself

**Why?** These files affect builds, deployments, and all developers. Changes must be intentional.

### What's Free (No Prompts)

- ✅ **Application Code** - All .ts, .tsx, .js, .jsx, .css, .html, .md files (except infrastructure)
- ✅ **Git Operations** - status, diff, log, commit, add, branch, checkout (NOT push)
- ✅ **All MCP Tools** - vibestudio, playwright, figma, context7 (except deploy_to_production)
- ✅ **Test Environment** - Test containers, test DB (port 5434), test commands
- ✅ **Safe Scripts** - migrate:safe, db:backup (have built-in confirmations)

### What's Blocked (Denied)

- ❌ **Docker builds** - `docker compose build`, `docker build` (use MCP tools)
- ❌ **Package management** - `npm install`, `npm run build` (Docker handles it)
- ❌ **Dangerous DB ops** - `prisma db push --accept-data-loss`

### Typical Workflow (2 Prompts)

```
1. create_story           ✅ No prompt
2. git_create_worktree    ✅ No prompt
3. Edit application code  ✅ No prompt
4. git commit             ✅ No prompt
5. npm test               ✅ No prompt
6. deploy_to_test_env     ✅ No prompt
7. git push               ⚠️ PROMPT #1 (verify branch/remote)
8. create_pull_request    ✅ No prompt
9. merge_pull_request     ✅ No prompt
10. deploy_to_production  ⚠️ PROMPT #2 (production gate)
```

**Result:** 2 prompts total for normal feature development!

### Industry Alignment (2025 Best Practices)

This system is based on research from:
- **Claude Code Official** - "Allowlist routine low-risk actions, gate sensitive operations"
- **GitHub Copilot** - Cannot push to main without approval, blocks workflows until review
- **CODEOWNERS Pattern** - Industry standard for protecting critical files
- **AI Agent Guardrails** - "Humans must monitor and approve AI-driven changes"

**Configuration:** `.claude/settings.local.json` - See ST-96 for complete rationale and research citations.

---

## Build and Deployment (CRITICAL)

**NEVER use npm/node commands for building. ALWAYS use Docker:**

### Production Deployment (ST-77, ST-84)

**⚠️ CRITICAL: Production deployments MUST use the MCP tool ONLY**

#### Deployment Modes

**Two deployment workflows are supported:**

1. **PR Mode (Team Collaboration)** - Traditional workflow with GitHub PR approval
2. **Direct Commit Mode (Solo Development)** - Simplified workflow for solo developers with manual approval

#### Required Commands for Production

- ✅ **CORRECT**: Use `deploy_to_production` MCP tool ONLY
- ✅ **CORRECT**: Requires confirmDeploy: true parameter
- ✅ **CORRECT**: Automatic pre-deployment backup
- ✅ **CORRECT**: 3 consecutive health checks required

#### Forbidden Commands for Production

- ❌ **NEVER USE**: `docker compose build` for production - Use MCP tool
- ❌ **NEVER USE**: `docker compose up -d` for production - Use MCP tool
- ❌ **NEVER USE**: Direct Docker commands for production - Use MCP tool
- ❌ **NEVER USE**: Manual container builds/restarts - Use MCP tool

#### Production Deployment Example (PR Mode)

```typescript
// ✅ CORRECT - PR-based deployment (team collaboration)
deploy_to_production({
  storyId: "uuid-here",
  prNumber: 42,
  triggeredBy: "claude-agent",
  confirmDeploy: true  // REQUIRED
})
```

**PR Mode Requirements:**
1. Story in 'qa' or 'done' status
2. PR approved by at least 1 reviewer
3. PR merged to main branch
4. No merge conflicts

#### Production Deployment Example (Direct Commit Mode - ST-84)

```typescript
// Step 1: Approve deployment manually
approve_deployment({
  storyId: "uuid-here",
  approvedBy: "pawel",
  approvalReason: "Hotfix for critical bug - solo development",
  expiresInMinutes: 60  // Optional, default: 60
})

// Step 2: Deploy with direct commit flag
deploy_to_production({
  storyId: "uuid-here",
  directCommit: true,
  triggeredBy: "claude-agent",
  confirmDeploy: true  // REQUIRED
})
```

**Direct Commit Mode Requirements:**
1. Story in 'qa' or 'done' status
2. Manual approval via `approve_deployment` tool (valid for 60 minutes by default)
3. Commit exists on main branch
4. No PR required (bypasses GitHub approval workflow)

**Direct Commit Mode Notes:**
- Designed for solo development workflows
- Approval is single-use (cleared after deployment)
- Time-limited approval (default 60 minutes, max 8 hours)
- Full audit trail maintained (approver, timestamp, reason)
- Developer acts as both implementer and reviewer

#### Production Deployment Safeguards

The `deploy_to_production` MCP tool enforces:
1. Story in 'qa' or 'done' status
2. **EITHER**: PR approved & merged (PR mode) **OR** Manual approval (direct commit mode)
3. Deployment lock (only 1 deployment at a time)
4. Pre-deployment backup created automatically
5. Sequential builds (backend → frontend)
6. Health checks (3 consecutive successes)
7. Complete audit trail (7-year retention)
8. Auto-rollback on failure
9. Mutual exclusivity (cannot use both prNumber and directCommit)
10. Approval validation (PR or manual, never both)

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

## Build and Deployment Permissions (ENFORCED)

**⚠️ CRITICAL: Permission system enforces these rules automatically**

### Blocked Commands (Auto-Denied)

The following commands are **BLOCKED** via `.claude/settings.local.json` permissions:

**Docker Build/Deploy Commands:**
- ❌ `docker compose build` - BLOCKED (use MCP tools)
- ❌ `docker-compose build` - BLOCKED (use MCP tools)
- ❌ `docker build` - BLOCKED (use MCP tools)
- ❌ `docker compose up` - BLOCKED (use MCP tools)
- ❌ `docker compose restart` - BLOCKED (use MCP tools)
- ❌ `docker compose start/stop/down` - BLOCKED (use MCP tools)

**Package Manager Commands:**
- ❌ `npm run build` - BLOCKED (Docker handles builds)
- ❌ `npm install` - BLOCKED (Docker handles dependencies)
- ❌ `npm ci` - BLOCKED (Docker handles dependencies)
- ❌ `yarn build/install` - BLOCKED
- ❌ `pnpm build/install` - BLOCKED

### Build File Modifications (Require Approval)

Modifications to build files **REQUIRE APPROVAL** and will be **AUTO-DENIED** without explicit user permission:

**Protected Files:**
- 📄 `**/Dockerfile` - Requires approval
- 📄 `**/Dockerfile.*` (e.g., Dockerfile.test) - Requires approval
- 📄 `**/docker-compose*.yml` - Requires approval
- 📄 `**/docker-compose*.yaml` - Requires approval
- 📄 `**/.dockerignore` - Requires approval

**Actions Requiring Approval:**
- `Edit()` - Modifying existing build files
- `Write()` - Creating new build files

**⚠️ Important:**
- User must explicitly approve each build file modification
- Changes should go through proper story/PR workflow
- Build file changes should be part of story implementation
- Never bypass approval prompts for build files

### Allowed Commands

**Read-Only Docker Commands:**
- ✅ `docker compose logs` - View logs (allowed)
- ✅ `docker compose ps` - List containers (allowed)
- ✅ `docker compose config` - View config (allowed)
- ✅ `docker ps` - List containers (allowed)
- ✅ `docker inspect` - Inspect containers (allowed)

**MCP Deployment Tools (ONLY approved method):**
- ✅ `mcp__vibestudio__deploy_to_production` - Production deployment
- ✅ `mcp__vibestudio__deploy_to_test_env` - Test deployment
- ✅ `mcp__vibestudio__approve_deployment` - Manual approval

**Test Commands:**
- ✅ Test database commands (port 5434)
- ✅ `npm test` with test DATABASE_URL
- ✅ Jest/Playwright test execution

### Workflow for Build Changes

**Correct Workflow:**
1. Create story for build changes
2. Modify build files in worktree (user approves changes)
3. Test changes via `deploy_to_test_env`
4. Create PR and get approval
5. Deploy via `deploy_to_production` MCP tool

**Incorrect Workflow:**
- ❌ Direct `docker compose build` commands
- ❌ Manual container restarts
- ❌ Bypassing approval prompts
- ❌ Modifying production build files without story/PR

### Configuration

Permission enforcement is configured in `.claude/settings.local.json`:
- `deny[]` - Blocked commands (hard block)
- `ask[]` - Require approval (auto-deny if no approval)
- `allow[]` - Explicitly allowed commands

**Note:** These restrictions are enforced at the Claude Code permission layer and cannot be bypassed without modifying settings.

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

### Story Development Workflow Modes (EP-8/ST-190)

**Two modes exist for developing stories with VibeStudio:**

#### Mode 1: MasterSession Orchestration (Recommended for Interactive Development)

**Use `get_current_step` MCP tool** - You (Claude) act as the orchestrator in a single session.

**When to use:**
- Interactive development with user present
- Small to medium stories
- When you need flexibility to ask questions mid-execution
- When human oversight at each step is desired

**Workflow:**
```typescript
// 1. Start a workflow run (if not already started)
start_team_run({ teamId, triggeredBy, cwd, sessionId, transcriptPath })

// 2. Get current step with complete instructions
get_current_step({ story: "ST-123" })
// Returns: workflowSequence with exact MCP tool calls for each phase

// 3. Execute the phase (pre → agent → post)
// For agent phase: Use Task tool to spawn component agents
// For pre/post: Execute instructions yourself

// 4. Advance to next step
advance_step({ story: "ST-123" })

// 5. Repeat until workflow_complete
```

**Key Tools:**
- `get_current_step` - Returns complete orchestration instructions
- `advance_step` - Move to next phase/state
- `repeat_step` - Retry with feedback
- `respond_to_approval` - Handle approval gates
- `get_orchestration_context` - Restore context after compaction

#### Mode 2: Dedicated Docker Runner (For Autonomous Execution)

**Use `start_runner` MCP tool** - Spawns a Docker container that runs autonomously.

**When to use:**
- Long-running multi-state workflows
- Background/unattended execution
- When crash recovery is critical
- Production-grade execution with checkpointing

**Workflow:**
```typescript
// 1. Start the runner (spawns Docker container)
start_runner({ runId, workflowId, story: "ST-123" })

// 2. Monitor status
get_runner_status({ story: "ST-123" })

// 3. Control execution
pause_runner({ story: "ST-123" })
resume_runner({ runId })
cancel_runner({ story: "ST-123" })

// 4. Debug with breakpoints
manage_breakpoints({ story: "ST-123", action: "set", stateName: "impl" })
step_runner({ story: "ST-123" })  // Execute one state at a time
```

**Key Tools:**
- `start_runner` / `resume_runner` - Start/resume Docker runner
- `pause_runner` / `cancel_runner` - Control execution
- `get_runner_status` / `get_runner_checkpoint` - Monitor progress
- `manage_breakpoints` / `step_runner` - Debug step-by-step

#### Comparison Table

| Aspect | MasterSession (get_current_step) | Docker Runner (start_runner) |
|--------|----------------------------------|------------------------------|
| Execution | In your session | Separate Docker container |
| Crash Recovery | Via `get_orchestration_context` | Built-in checkpointing |
| User Interaction | Can ask questions mid-flow | Queues questions via AgentQuestion |
| Best For | Interactive development | Autonomous/background execution |
| Complexity | Simpler | More infrastructure |

### Claude Code Hooks (VibeStudio Integration)

Hooks in `.claude/settings.local.json` integrate Claude Code with VibeStudio:

#### SessionStart Hook
**File:** `.claude/hooks/vibestudio-session-start.sh`
**Triggers:** On session start, resume, or context compaction

**Purpose:**
1. Track transcript paths in `running-workflows.json`
2. Handle context compaction recovery (provides runId for `get_orchestration_context`)
3. Prime context with VibeStudio workflow awareness

**After Compaction:** The hook outputs instructions to call:
```typescript
get_orchestration_context({
  story: '<story-key>',  // or runId if no story key
  sessionId: '<new-session>',
  transcriptPath: '<new-transcript>'
})
```

#### PreCompact Hook
**Inline command** - Saves session-to-workflow mapping before compaction (format: `sessionId:runId:storyKey`)

#### SessionEnd Hook
**File:** `.claude/hooks/vibestudio-session-end.sh`
**Triggers:** On session end

**Purpose:** Mark session ended, record final transcript path

#### PostToolUse Hooks

| Matcher | Hook File | Purpose |
|---------|-----------|---------|
| `ExitPlanMode` | `vibestudio-implementation.sh` | Guide to story/team workflow after planning |
| `Task` | `vibestudio-track-agents.sh` | Track spawned agent transcripts |
| `AskUserQuestion` | `vibestudio-track-questions.sh` | Track pending questions |

#### Local Tracking File
**File:** `.claude/running-workflows.json`

Tracks:
- `sessions[sessionId].runId` - Active workflow run
- `sessions[sessionId].storyKey` - Story key for easy reference
- `sessions[sessionId].masterTranscripts[]` - Transcript paths
- `sessions[sessionId].spawnedAgentTranscripts[]` - Agent transcripts

### Frontend API Configuration (CRITICAL - Prevent Double /api/api)

**⚠️ COMMON MISTAKE: Double `/api/api/` paths causing 404 errors**

**🚨 NEVER MODIFY api.client.ts BASE URL LOGIC!**

The `api.client.ts` uses a SIMPLE pattern - DO NOT CHANGE IT:
```typescript
// api.client.ts - Uses VITE_API_URL directly, or /api as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

**✅ CORRECT Pattern:**

```typescript
// .env.docker on production - VITE_API_URL is empty (uses fallback /api)
VITE_API_URL=  // Empty! Uses /api fallback for relative paths

// frontend/src/services/*.service.ts - paths WITHOUT /api prefix
const response = await apiClient.get('/projects');           // ✅ CORRECT
const response = await apiClient.get(`/stories/${id}`);      // ✅ CORRECT
const response = await apiClient.post('/stories', data);     // ✅ CORRECT
```

**How it works:**
1. `VITE_API_URL` is empty on production → `API_BASE_URL = '/api'`
2. Service calls `/projects` → Final URL: `/api/projects`
3. Nginx proxies `/api/*` to backend

**❌ WRONG - DO NOT modify api.client.ts to add /api:**

```typescript
// ❌ WRONG - This causes double /api/api/
const API_BASE_URL = rawApiUrl ? `${rawApiUrl}/api` : '/api';  // ❌ NEVER DO THIS!
```

**Why this pattern:**
- Production uses relative paths (empty `VITE_API_URL`, fallback to `/api`)
- NestJS backend uses global prefix: `app.setGlobalPrefix('api')`
- Nginx/Caddy proxies `/api/*` to backend
- Service paths are relative to `/api` base URL

**Files to check when debugging API calls:**
1. `frontend/src/services/api.client.ts` - MUST use simple `VITE_API_URL || '/api'`
2. `frontend/src/services/*.service.ts` - Paths should NOT have `/api` prefix
3. Browser Network tab - Verify final URLs are `/api/...` NOT `/api/api/...`

**Test commands:**
```bash
# Verify backend endpoint works
curl http://127.0.0.1:3001/api/projects/{projectId}/components

# Check for double /api in browser network requests
# Should be: /api/projects/...
# NOT: /api/api/projects/...
```

---

## MCP Debug Logging (ST-171)

The MCP server and HTTP bridge support configurable debug logging for troubleshooting connection issues.

### MCP Server Debug Mode

Enable verbose logging by setting the `MCP_DEBUG` environment variable:

```bash
# Enable debug logging for MCP server
MCP_DEBUG=1

# Or
MCP_DEBUG=true
```

**Log Levels:**
- `info` - Always enabled: server start, client connect/disconnect, errors
- `debug` - Enabled with `MCP_DEBUG=1`: tool calls, timing, response sizes
- `warn` - Always enabled: non-fatal issues (e.g., DATABASE_URL override)
- `error` - Always enabled: failures with stack traces

**Log Format:**
```
[2025-01-15T10:30:00.000Z] [MCP] [INFO ] Server started {"toolCount":150,"categories":["stories","epics"]}
[2025-01-15T10:30:01.000Z] [MCP] [DEBUG] Executing tool {"name":"list_stories","args":{}}
```

All logs go to stderr (stdout is reserved for MCP protocol).

### MCP HTTP Bridge Debug Mode

For the laptop HTTP bridge (`mcp-stdio-bridge.ts`):

```bash
# Enable debug logging
VIBESTUDIO_DEBUG=1

# Or via command line
npx ts-node mcp-stdio-bridge.ts --api-key=<key> --debug
```

### HTTP Retry Configuration

The HTTP client implements a two-tier retry strategy for maximum resilience:

**Tier 1 - Initial Retries (fast, exponential backoff):**
- 3 attempts with delays: 1s → 2s → 4s
- Handles brief network glitches

**Tier 2 - Extended Retries (long delay between rounds):**
- 10 rounds with 30s delay between each
- Each round retries the initial 3 attempts
- Handles prolonged outages (up to ~5 minutes)

**Retryable errors**: 429 (rate limit), 502, 503, 504 (server errors), network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)

**Auto re-init**: On 401/410 (session expired), automatically re-initializes session and retries

Configure via `McpHttpClientOptions`:

```typescript
const client = new McpHttpClient({
  baseUrl: 'https://vibestudio.example.com',
  apiKey: 'your-api-key',
  debug: true,
  // Initial retry config
  maxHttpRetries: 3,           // Max attempts per round (default: 3)
  initialHttpRetryDelay: 1000, // Initial delay (ms, default: 1000)
  maxHttpRetryDelay: 10000,    // Max delay (ms, default: 10000)
  // Extended retry config
  extendedRetryAttempts: 10,   // Retry rounds after initial fails (default: 10)
  extendedRetryDelay: 30000,   // Delay between rounds (ms, default: 30000)
});
```

---

## Remote Agent (Laptop ↔ KVM Communication) - ST-133

The remote agent enables the KVM server to execute scripts on the developer's laptop (where Claude Code runs) via WebSocket.

### Architecture

```
┌─────────────────┐     WebSocket (outbound)     ┌─────────────────┐
│  Laptop Agent   │ ──────────────────────────▶  │   KVM Server    │
│  (your machine) │                              │  (vibestudio)   │
└─────────────────┘                              └─────────────────┘
     Executes:                                        Sends:
     - parse-transcript.ts                           - Job requests
     - analyze-story-transcripts.ts                  - JWT tokens
     - list-transcripts.ts
```

**Key Points:**
- Laptop initiates outbound WebSocket connection (NAT-friendly, no public IP needed)
- Pre-shared secret authentication with JWT token issuance
- Whitelisted script execution only (security)
- Auto-reconnect with exponential backoff

### Laptop Setup (macOS)

**1. Configuration file:** `~/.vibestudio/config.json`

```json
{
  "serverUrl": "https://vibestudio.example.com",
  "agentSecret": "<secret-from-kvm-.env>",
  "hostname": "pawels-macbook",
  "capabilities": ["parse-transcript", "analyze-story-transcripts", "list-transcripts"],
  "projectPath": "/Users/pawelgawliczek/projects/AIStudio"
}
```

**2. Build the agent:**

```bash
cd /Users/pawelgawliczek/projects/AIStudio/laptop-agent
npm install && npm run build
```

**3. launchd auto-start:** `~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist`

The agent is configured to auto-start on login via macOS launchd.

**Useful commands:**

```bash
# Check status
launchctl list | grep vibestudio

# View logs
tail -f ~/.vibestudio/agent.log
tail -f ~/.vibestudio/agent.error.log

# Stop agent
launchctl unload ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist

# Start agent
launchctl load ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist

# Restart agent
launchctl unload ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist && \
launchctl load ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist
```

### KVM Server Setup

**⚠️ SSH Hostname:** The production server SSH alias is `hostinger` (NOT "kvm"):

```bash
ssh hostinger       # ✅ Correct - connects to production KVM server
ssh kvm             # ❌ Wrong - hostname doesn't exist
```

The alias is configured in `~/.ssh/config` on the laptop.

**1. Environment variable:** Add to `/opt/stack/AIStudio/.env`:

```bash
AGENT_SECRET=<same-secret-as-laptop-config>
```

**2. Restart backend** after adding the secret:

```bash
docker compose up -d --force-recreate backend
```

### Database Tables (ST-133)

- `remote_agents` - Tracks connected agents (hostname, status, capabilities)
- `remote_jobs` - Tracks job execution (script, params, status, result)

### Security Model

- **Pre-shared secret** for initial registration
- **JWT tokens** for authenticated communication
- **Whitelisted scripts** - Only approved scripts can execute (see `backend/src/remote-agent/approved-scripts.ts`)
- **Whitelisted parameters** - Only approved parameters allowed
- **WSS encryption** - All communication encrypted in production