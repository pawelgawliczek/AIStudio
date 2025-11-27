Execute story {{arg1}} using the Worktree-Aware Development Team (test environment deployment).

## Team Details

**Team ID:** `5159f6c8-0979-458b-bb1e-d67adfb48269`
**PM:** Worktree-Aware PM
**Target:** Test environment deployment (http://127.0.0.1:3001 / http://127.0.0.1:5174)

## Execution

```typescript
mcp__vibestudio__execute_story_with_team({
  storyId: "{{arg1}}",
  teamId: "5159f6c8-0979-458b-bb1e-d67adfb48269",
  triggeredBy: "claude-orchestrator",
  cwd: "/opt/stack/AIStudio"
})
```

## Team Flow

1. **Worktree Setup** - PM creates/validates git worktree for isolated development
2. **Conflict Detection** - Checks for merge conflicts with main
3. **Context Explorer Agent** - Discovers files in worktree ONCE (150K tokens)
4. **Business Analyst Agent** - Creates use cases, maps files (5K tokens)
5. **Software Architect Agent** - Health assessment + architecture plan (10K tokens)
6. **Full-Stack Developer Agent** - TDD implementation in worktree, all tests pass (20K tokens)
7. **QA Automation Agent** - Validates coverage ≥80%, readiness assessment (20K tokens)
8. **DevOps Build & Deploy Agent** - Acquires test queue lock, deploys to test environment (5K tokens)
9. **PM Review** - Checks outstanding items, manages lock, initiates re-run if needed (10K tokens)

**Total:** ~230K tokens (vs 795K = 71% reduction)

## Worktree Isolation

- **Parallel Development** - Multiple stories can work in separate worktrees simultaneously
- **Production Untouched** - All work happens in isolated worktree, main branch safe
- **Test Environment** - Deploys to isolated test containers (ports 3001/5174, DB 5434, Redis 6381)

## Test Queue Locking

- **Lock acquired** during test environment deployment
- **Lock kept** until PM Review confirms readiness
- **Lock released** if re-run needed (allows other worktrees to test)
- **Re-acquired** when feature ready for testing again

## Iterative Refinement

- **Max 5 runs** - Team automatically re-runs if issues found
- **Same worktree** - All refinement runs work in same worktree
- **Outstanding items tracked** - TypeScript errors, test failures, coverage gaps

## Production Safeguards

- **Test environment only** - Never touches production
- **Health checks** - Validates test containers are healthy
- **Full test suite** - Unit, integration, E2E, frontend tests
