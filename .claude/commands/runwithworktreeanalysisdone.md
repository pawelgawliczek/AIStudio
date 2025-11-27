Execute story {{arg1}} using the Worktree-Aware Development Team with **ANALYSIS ALREADY COMPLETED**.

## Purpose

Use this command when you have already completed planning/analysis in Claude Code (e.g., using plan mode) and want the team agents to:
- **Store and format** the existing analysis into proper fields
- **Skip redundant research** - agents should NOT re-explore or re-analyze
- **Extend if needed** - agents may add to existing analysis but not replace it
- **Deploy to test environment** - isolated worktree-based testing

## Pre-requisites

Before running this command, ensure you have:
1. Completed planning/analysis in the current conversation
2. The story description contains your plan/analysis OR
3. You're ready to provide the analysis when agents prompt for it

## Team Details

**Team ID:** `5159f6c8-0979-458b-bb1e-d67adfb48269`
**PM:** Worktree-Aware PM
**Target:** Test environment deployment (http://127.0.0.1:3001 / http://127.0.0.1:5174)
**Mode:** ANALYSIS_DONE - Skip research, format and store existing work

## Execution

```typescript
mcp__vibestudio__execute_story_with_team({
  storyId: "{{arg1}}",
  teamId: "5159f6c8-0979-458b-bb1e-d67adfb48269",
  triggeredBy: "claude-orchestrator",
  cwd: "/opt/stack/AIStudio",
  context: {
    analysisMode: "ANALYSIS_DONE",
    skipResearch: true,
    instructions: "Analysis has been completed in planning mode. Agents should: 1) Read existing story description/analysis, 2) Format and store to appropriate fields (baAnalysis, architectAnalysis, designerAnalysis, contextExploration), 3) Extend with implementation details if needed, 4) Do NOT re-research or replace existing analysis."
  }
})
```

## Agent Behavior in ANALYSIS_DONE Mode

| Agent | Normal Mode | ANALYSIS_DONE Mode |
|-------|-------------|-------------------|
| **Worktree Setup** | Create/validate worktree | Normal - still creates worktree |
| **Conflict Detection** | Check merge conflicts | Normal - still checks conflicts |
| **Context Explorer Agent** | Full codebase exploration | Extract file references from existing analysis |
| **Business Analyst Agent** | Research and create use cases | Format existing requirements into baAnalysis |
| **Software Architect Agent** | Full architecture analysis | Store existing architecture decisions to architectAnalysis |
| **Designer Agent** | UI/UX research | Store existing design decisions to designerAnalysis |
| **Developer Agent** | TDD implementation | Proceed directly with implementation using existing plan |
| **QA Automation Agent** | Full test planning | Use existing test strategy from analysis |
| **DevOps Agent** | Test deployment | Normal test deployment |

## Worktree Isolation

- **Parallel Development** - Multiple stories can work in separate worktrees simultaneously
- **Production Untouched** - All work happens in isolated worktree, main branch safe
- **Test Environment** - Deploys to isolated test containers (ports 3001/5174, DB 5434, Redis 6381)

## Test Queue Locking

- **Lock acquired** during test environment deployment
- **Lock kept** until PM Review confirms readiness
- **Lock released** if re-run needed (allows other worktrees to test)
- **Re-acquired** when feature ready for testing again

## When to Use

- ✅ After completing detailed planning in Claude Code plan mode
- ✅ When you have a comprehensive plan in the conversation history
- ✅ When you want to capture planning work into story fields
- ✅ When agents should implement from existing plan, not create new one
- ✅ When you want to test in isolated environment before production

## When NOT to Use

- ❌ For new stories without prior analysis
- ❌ When you want fresh research perspective
- ❌ When existing analysis may be outdated
- ❌ When you want to deploy directly to production (use `/runanalysisdone` instead)
