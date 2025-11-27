Execute story {{arg1}} using the Standard Development Team with **ANALYSIS ALREADY COMPLETED**.

## Purpose

Use this command when you have already completed planning/analysis in Claude Code (e.g., using plan mode) and want the team agents to:
- **Store and format** the existing analysis into proper fields
- **Skip redundant research** - agents should NOT re-explore or re-analyze
- **Extend if needed** - agents may add to existing analysis but not replace it

## Pre-requisites

Before running this command, ensure you have:
1. Completed planning/analysis in the current conversation
2. The story description contains your plan/analysis OR
3. You're ready to provide the analysis when agents prompt for it

## Team Details

**Team ID:** `81ed11d4-26a0-420e-8f47-54ea5e019668`
**PM:** Post-Analysis Execution Coordinator
**Target:** Production deployment (https://vibestudio.example.com)
**Mode:** ANALYSIS_DONE - Skip research, format and store existing work

## Execution

```typescript
mcp__vibestudio__execute_story_with_team({
  storyId: "{{arg1}}",
  teamId: "81ed11d4-26a0-420e-8f47-54ea5e019668",
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

| Agent | Purpose | ANALYSIS_DONE Mode |
|-------|---------|-------------------|
| **DB Updater Agent** | Update story fields | Format and store existing analysis to baAnalysis, architectAnalysis, designerAnalysis, contextExploration fields |
| **Architect Reviewer Agent** | Architecture review | Use architect MCP tools to suggest refactors only if touching complex code |
| **Implementer Agent** | Code implementation | Write code based on completed analysis (Read, Write, Edit, Bash, Grep, Glob) |
| **Test Runner Agent** | Validation | Run tests and validate implementation (npm test, vitest) |

## When to Use

- ✅ After completing detailed planning in Claude Code plan mode
- ✅ When you have a comprehensive plan in the conversation history
- ✅ When you want to capture planning work into story fields
- ✅ When agents should implement from existing plan, not create new one

## When NOT to Use

- ❌ For new stories without prior analysis
- ❌ When you want fresh research perspective
- ❌ When existing analysis may be outdated
