Execute story {{arg1}} using the Standard Development Team (production deployment).

## Team Details

**Team ID:** `f2279312-e340-409a-b317-0d4886a868ea`
**PM:** Software Development PM
**Target:** Production deployment (https://vibestudio.example.com)

## Execution

```typescript
mcp__vibestudio__execute_story_with_team({
  storyId: "{{arg1}}",
  teamId: "f2279312-e340-409a-b317-0d4886a868ea",
  triggeredBy: "claude-orchestrator",
  cwd: "/opt/stack/AIStudio"
})
```

## Team Flow

1. **Context Explorer Agent** - Discovers files ONCE (150K tokens)
2. **Business Analyst Agent** - Creates use cases, maps files (5K tokens)
3. **Software Architect Agent** - Health assessment + architecture plan (10K tokens)
4. **Full-Stack Developer Agent** - TDD implementation, all tests pass (20K tokens)
5. **QA Automation Agent** - Validates coverage ≥80%, readiness assessment (20K tokens)
6. **DevOps Production Deploy Agent** - Deploys to production with locking (5K tokens)
7. **PM Review** - Checks outstanding items, initiates re-run if needed (10K tokens)

**Total:** ~220K tokens (vs 795K = 72% reduction)

## Iterative Refinement

- **Max 5 runs** - Team automatically re-runs if issues found
- **Outstanding items tracked** - TypeScript errors, test failures, coverage gaps
- **Lock management** - Deployment lock prevents concurrent deployments

## Production Safeguards

- Pre-deployment backup
- 3 consecutive health checks
- Auto-rollback on failure
- PR approval required (or manual approval for direct commit mode)
