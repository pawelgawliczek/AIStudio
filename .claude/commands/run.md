Execute story {{arg1}} using the Standard Development Workflow (production deployment).

## Workflow Details

**Workflow ID:** `f2279312-e340-409a-b317-0d4886a868ea`
**Coordinator:** Software Development PM
**Target:** Production deployment (https://vibestudio.example.com)

## Execution

```typescript
mcp__vibestudio__execute_story_with_workflow({
  storyId: "{{arg1}}",
  workflowId: "f2279312-e340-409a-b317-0d4886a868ea",
  triggeredBy: "claude-orchestrator",
  cwd: "/opt/stack/AIStudio"
})
```

## Workflow Flow

1. **Context Explore** - Discovers files ONCE (150K tokens)
2. **Business Analyst** - Creates use cases, maps files (5K tokens)
3. **Software Architect** - Health assessment + architecture plan (10K tokens)
4. **Full-Stack Developer** - TDD implementation, all tests pass (20K tokens)
5. **QA Automation** - Validates coverage ≥80%, readiness assessment (20K tokens)
6. **DevOps Production Deploy** - Deploys to production with locking (5K tokens)
7. **PM Review** - Checks outstanding items, initiates re-run if needed (10K tokens)

**Total:** ~220K tokens (vs 795K = 72% reduction)

## Iterative Refinement

- **Max 5 runs** - Workflow automatically re-runs if issues found
- **Outstanding items tracked** - TypeScript errors, test failures, coverage gaps
- **Lock management** - Deployment lock prevents concurrent deployments

## Production Safeguards

- Pre-deployment backup
- 3 consecutive health checks
- Auto-rollback on failure
- PR approval required (or manual approval for direct commit mode)
