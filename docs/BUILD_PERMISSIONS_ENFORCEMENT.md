# Build and Deployment Permissions Enforcement

## Overview

This document describes the permission enforcement system that prevents unauthorized builds and deployments, ensuring all production changes go through the approved MCP tool workflow (ST-77, ST-84, ST-87).

## Configuration Location

`.claude/settings.local.json` - Project-level permission configuration

## Three-Tier Permission System

### 1. DENY List - Auto-Denied Commands (No Prompts)

These commands are **BLOCKED IMMEDIATELY** with no approval prompt:

#### Docker Build/Deploy Commands
```
Bash(docker compose build:*)         ❌ BLOCKED
Bash(docker-compose build:*)         ❌ BLOCKED
Bash(docker build:*)                 ❌ BLOCKED
Bash(docker compose up:*)            ❌ BLOCKED
Bash(docker-compose up:*)            ❌ BLOCKED
Bash(docker compose restart:*)       ❌ BLOCKED
Bash(docker-compose restart:*)       ❌ BLOCKED
Bash(docker compose start:*)         ❌ BLOCKED
Bash(docker compose stop:*)          ❌ BLOCKED
Bash(docker compose down:*)          ❌ BLOCKED
```

#### Package Manager Commands
```
Bash(npm run build:*)                ❌ BLOCKED
Bash(npm install:*)                  ❌ BLOCKED
Bash(npm ci:*)                       ❌ BLOCKED
Bash(yarn build:*)                   ❌ BLOCKED
Bash(yarn install:*)                 ❌ BLOCKED
Bash(pnpm build:*)                   ❌ BLOCKED
Bash(pnpm install:*)                 ❌ BLOCKED
```

**Result:** Claude Code will reject these commands immediately without user interaction.

### 2. ASK List - Requires User Approval

These operations require **EXPLICIT USER APPROVAL** before execution:

#### Build File Modifications
```
Edit(**/Dockerfile)                  🔒 REQUIRES APPROVAL
Edit(**/Dockerfile.*)                🔒 REQUIRES APPROVAL
Edit(**/docker-compose*.yml)         🔒 REQUIRES APPROVAL
Edit(**/docker-compose*.yaml)        🔒 REQUIRES APPROVAL
Edit(**/.dockerignore)               🔒 REQUIRES APPROVAL

Write(**/Dockerfile)                 🔒 REQUIRES APPROVAL
Write(**/Dockerfile.*)               🔒 REQUIRES APPROVAL
Write(**/docker-compose*.yml)        🔒 REQUIRES APPROVAL
Write(**/docker-compose*.yaml)       🔒 REQUIRES APPROVAL
Write(**/.dockerignore)              🔒 REQUIRES APPROVAL
```

**Result:** User sees approval prompt and can choose to approve or deny.

### 3. ALLOW List - Explicitly Allowed Operations

These operations are **PRE-APPROVED** and execute without prompts:

#### Read-Only Docker Commands
```
Bash(docker compose logs:*)          ✅ ALLOWED
Bash(docker compose ps:*)            ✅ ALLOWED
Bash(docker compose config:*)        ✅ ALLOWED
Bash(docker ps:*)                    ✅ ALLOWED
Bash(docker inspect:*)               ✅ ALLOWED
```

#### MCP Deployment Tools (ONLY approved deployment method)
```
mcp__vibestudio__deploy_to_production      ✅ ALLOWED
mcp__vibestudio__deploy_to_test_env        ✅ ALLOWED
mcp__vibestudio__approve_deployment        ✅ ALLOWED
```

#### Test Commands
```
Bash(DATABASE_URL='...:5434/vibestudio_test' npm test:*)     ✅ ALLOWED
Bash(timeout 180 npx jest:*)                                 ✅ ALLOWED
Bash(npm run test:coverage:*)                                ✅ ALLOWED
```

## Deployment Workflow (Enforced)

### ✅ Correct Production Deployment

```typescript
// PR Mode
deploy_to_production({
  storyId: "uuid",
  prNumber: 42,
  triggeredBy: "claude-agent",
  confirmDeploy: true
})

// Direct Commit Mode
approve_deployment({
  storyId: "uuid",
  approvedBy: "pawel",
  approvalReason: "Hotfix for critical bug"
})

deploy_to_production({
  storyId: "uuid",
  directCommit: true,
  triggeredBy: "claude-agent",
  confirmDeploy: true
})
```

### ❌ Blocked Operations

```bash
# These will be AUTO-DENIED:
docker compose build backend           # ❌ BLOCKED
docker compose up -d backend           # ❌ BLOCKED
docker compose restart backend         # ❌ BLOCKED
npm run build                          # ❌ BLOCKED
npm install                            # ❌ BLOCKED
```

### 🔒 Operations Requiring Approval

```typescript
// These will prompt for approval:
Edit("backend/Dockerfile")             // 🔒 USER APPROVAL REQUIRED
Edit("docker-compose.yml")             // 🔒 USER APPROVAL REQUIRED
Write("backend/Dockerfile.test")       // 🔒 USER APPROVAL REQUIRED
```

## Benefits

1. **Prevents Accidental Production Changes**
   - No direct Docker commands can affect production
   - All deployments must go through MCP tool workflow

2. **Enforces Deployment Safeguards**
   - Deployment lock (singleton)
   - Pre-deployment backup
   - Health checks
   - Audit trail
   - PR approval or manual approval

3. **Build File Protection**
   - User explicitly approves all Dockerfile changes
   - Prevents unauthorized build configuration changes
   - Maintains infrastructure-as-code integrity

4. **Clear Audit Trail**
   - All deployments logged via DeploymentLog
   - Approval workflow tracked
   - No backdoor deployment methods

## Testing the Restrictions

### Test 1: Try Blocked Build Command

```bash
# This should be immediately denied:
docker compose build backend
# Expected: Permission denied, no prompt
```

### Test 2: Try Build File Modification

```typescript
// This should prompt for approval:
Edit("backend/Dockerfile")
// Expected: User sees approval prompt
```

### Test 3: Use Approved MCP Tool

```typescript
// This should work without prompts:
mcp__vibestudio__deploy_to_test_env({ storyId: "uuid" })
// Expected: Executes normally
```

## Updating Permissions

To modify permissions, edit `.claude/settings.local.json`:

```json
{
  "permissions": {
    "deny": [/* blocked commands */],
    "ask": [/* require approval */],
    "allow": [/* pre-approved */]
  }
}
```

**⚠️ Warning:** Modifying permissions bypasses safety guardrails. Only update with explicit approval and documentation.

## Related Documentation

- `CLAUDE.md` - Build and deployment instructions
- `ST-77` - Production Deployment Safety System
- `ST-84` - Direct Commit Support
- `ST-85` - Safe Migration MCP Tools
- `ST-87` - Deployment Performance Optimizations

## Support

If Claude Code attempts a blocked operation:
1. Check `CLAUDE.md` for correct workflow
2. Use MCP deployment tools instead of direct commands
3. For build file changes, approve when prompted
4. Never bypass permission prompts without explicit approval
