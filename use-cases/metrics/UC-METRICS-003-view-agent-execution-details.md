# UC-METRICS-003: View Per-Agent Execution Details and Analytics

## Overview
This use case addresses the requirement for **automatic statistics gathering** where each agent execution is logged separately, and users can view detailed metrics per story, per epic, and in aggregate analytics to evaluate agentic setup effectiveness.

## Actor
PM, Architect, Developer, Stakeholder

## Preconditions
- Project has completed stories
- Agents have executed work (BA, Architect, Developer, QA)
- All agent executions logged via `log_run` MCP tool automatically
- LOC data captured from commits automatically

## Main Flow

### View 1: Per-Story Agent Execution Details

1. User navigates to Story detail view (Web UI or CLI)
2. User selects story: ST-42 "Implement password reset flow"
3. System displays **Agent Execution Timeline** panel showing all agent runs:

```
Story ST-42: Implement password reset flow
Status: Done | Epic: EP-3 User Authentication

═══════════════════════════════════════════════════════════════
AGENT EXECUTION TIMELINE (7 total executions)
═══════════════════════════════════════════════════════════════

[1] Business Analyst - Requirements Analysis
    Run ID: run-001
    Started:  2025-11-10 09:00:00
    Finished: 2025-11-10 09:25:00
    Duration: 25 minutes
    Tokens In:  5,200
    Tokens Out: 3,800
    Total Tokens: 9,000
    Iterations: 6 prompts
    LOC Generated: 0 (analysis phase)
    Success: ✓

    Metrics:
    • tokens/LOC: N/A (no code)
    • runtime/token: 0.17 sec/token
    • LOC/prompt: N/A

---

[2] Architect - Technical Assessment #1
    Run ID: run-002
    Started:  2025-11-10 09:30:00
    Finished: 2025-11-10 09:45:00
    Duration: 15 minutes
    Tokens In:  4,500
    Tokens Out: 2,100
    Total Tokens: 6,600
    Iterations: 4 prompts
    LOC Generated: 0 (design phase)
    Success: ✓

    Metrics:
    • tokens/LOC: N/A (no code)
    • runtime/token: 0.14 sec/token
    • LOC/prompt: N/A

---

[3] Architect - Code Review & Refinement #2
    Run ID: run-003
    Started:  2025-11-10 11:30:00
    Finished: 2025-11-10 11:42:00
    Duration: 12 minutes
    Tokens In:  3,200
    Tokens Out: 1,800
    Total Tokens: 5,000
    Iterations: 3 prompts
    LOC Generated: 0 (review phase)
    Success: ✓

    Metrics:
    • tokens/LOC: N/A (no code)
    • runtime/token: 0.14 sec/token
    • LOC/prompt: N/A

---

[4] Architect - Final Architecture Validation #3
    Run ID: run-004
    Started:  2025-11-10 14:15:00
    Finished: 2025-11-10 14:28:00
    Duration: 13 minutes
    Tokens In:  2,800
    Tokens Out: 1,500
    Total Tokens: 4,300
    Iterations: 2 prompts
    LOC Generated: 0 (validation phase)
    Success: ✓

    Metrics:
    • tokens/LOC: N/A (no code)
    • runtime/token: 0.18 sec/token
    • LOC/prompt: N/A

---

[5] Developer - Backend Implementation
    Run ID: run-005
    Started:  2025-11-10 10:00:00
    Finished: 2025-11-10 10:45:00
    Duration: 45 minutes
    Tokens In:  15,000
    Tokens Out: 8,500
    Total Tokens: 23,500
    Iterations: 12 prompts
    LOC Generated: 285 lines
    Commits: abc123, def456
    Files: src/auth/reset-password.ts, src/email/templates.ts
    Success: ✓

    Metrics:
    • tokens/LOC: 82.5 tokens/line
    • LOC/prompt: 23.8 lines/prompt
    • runtime/LOC: 9.5 sec/line
    • runtime/token: 0.11 sec/token

---

[6] Developer - Frontend Implementation
    Run ID: run-006
    Started:  2025-11-10 13:00:00
    Finished: 2025-11-10 13:38:00
    Duration: 38 minutes
    Tokens In:  12,000
    Tokens Out: 7,200
    Total Tokens: 19,200
    Iterations: 10 prompts
    LOC Generated: 198 lines
    Commits: ghi789
    Files: src/components/PasswordResetForm.tsx
    Success: ✓

    Metrics:
    • tokens/LOC: 97.0 tokens/line
    • LOC/prompt: 19.8 lines/prompt
    • runtime/LOC: 11.5 sec/line
    • runtime/token: 0.12 sec/token

---

[7] QA Tester - Validation
    Run ID: run-007
    Started:  2025-11-10 15:00:00
    Finished: 2025-11-10 15:20:00
    Duration: 20 minutes
    Tokens In:  4,000
    Tokens Out: 2,500
    Total Tokens: 6,500
    Iterations: 5 prompts
    LOC Generated: 87 lines (tests)
    Commits: jkl012
    Files: tests/auth/reset-password.test.ts
    Success: ✓

    Metrics:
    • tokens/LOC: 74.7 tokens/line
    • LOC/prompt: 17.4 lines/prompt
    • runtime/LOC: 13.8 sec/line
    • runtime/token: 0.18 sec/token

═══════════════════════════════════════════════════════════════
STORY-LEVEL SUMMARY
═══════════════════════════════════════════════════════════════

Total Executions: 7
  • BA: 1 run
  • Architect: 3 runs
  • Developer: 2 runs
  • QA: 1 run

Total Time: 2 hours 48 minutes
Total Tokens: 74,100
  • Input: 46,700
  • Output: 27,400
Total LOC: 570 lines
Total Iterations: 42 prompts

Aggregate Metrics:
  • tokens/LOC: 130.0 tokens/line (all agents)
  • LOC/prompt: 13.6 lines/prompt (code agents only)
  • runtime/LOC: 17.7 sec/line
  • runtime/token: 0.14 sec/token

Cost Estimate: $7.41 (based on token rates)

═══════════════════════════════════════════════════════════════
```

4. User can drill down into any execution:
   - Click run → see full conversation log (if enabled)
   - View files modified in that run
   - See prompt iterations breakdown
   - Export execution data

### View 2: Epic-Level Accumulated Metrics

5. User clicks "View Epic Summary"
6. System aggregates all stories in epic and displays:

```
═══════════════════════════════════════════════════════════════
EPIC EP-3: User Authentication System
═══════════════════════════════════════════════════════════════

Stories: 8 completed, 2 in progress, 3 planned

Accumulated Agent Usage Across All Stories:
┌─────────────┬───────┬────────┬──────────┬──────────┬─────────┐
│ Agent       │ Runs  │ Tokens │ Runtime  │ LOC Gen  │ Prompts │
├─────────────┼───────┼────────┼──────────┼──────────┼─────────┤
│ BA          │   8   │ 72,000 │  3.2 hrs │    0     │   48    │
│ Architect   │  24   │148,000 │  5.8 hrs │    0     │   96    │
│ Developer   │  16   │385,000 │ 12.5 hrs │  4,280   │  192    │
│ QA          │   8   │ 52,000 │  2.7 hrs │   680    │   40    │
├─────────────┼───────┼────────┼──────────┼──────────┼─────────┤
│ TOTAL       │  56   │657,000 │ 24.2 hrs │  4,960   │  376    │
└─────────────┴───────┴────────┴──────────┴──────────┴─────────┘

Epic-Level Metrics:
  • tokens/LOC: 132.5 tokens/line
  • LOC/prompt: 13.2 lines/prompt (code agents)
  • runtime/LOC: 17.5 sec/line
  • runtime/token: 0.13 sec/token

Epic Cost: $65.70
```

### View 3: Analytics - Framework Effectiveness Comparison

7. User navigates to "Agent Effectiveness" analytics view
8. User selects comparison: "BA+Arch+Dev+QA" vs "Dev-only"
9. System displays detailed per-agent metrics:

```
═══════════════════════════════════════════════════════════════
FRAMEWORK EFFECTIVENESS ANALYTICS
Comparing: BA+Arch+Dev+QA vs Dev-only
Complexity Band: Medium (3)
Stories: 42 vs 38
═══════════════════════════════════════════════════════════════

PER-AGENT EFFICIENCY METRICS
┌─────────────┬──────────────────────┬──────────────────────┐
│ Metric      │ BA+Arch+Dev+QA       │ Dev-only             │
├─────────────┼──────────────────────┼──────────────────────┤
│ BUSINESS ANALYST                                           │
│ tokens/LOC  │ N/A (no code)        │ N/A                  │
│ runtime/token│ 0.16 sec/token      │ N/A                  │
│ Avg tokens  │ 9,000/run            │ N/A                  │
│ Avg runtime │ 24 min/run           │ N/A                  │
├─────────────┼──────────────────────┼──────────────────────┤
│ ARCHITECT                                                  │
│ tokens/LOC  │ N/A (no code)        │ N/A                  │
│ runtime/token│ 0.15 sec/token      │ N/A                  │
│ Avg tokens  │ 6,200/run            │ N/A                  │
│ Avg runtime │ 15 min/run           │ N/A                  │
│ Runs/story  │ 3.0 runs             │ N/A                  │
├─────────────┼──────────────────────┼──────────────────────┤
│ DEVELOPER                                                  │
│ tokens/LOC  │ 89.5 tokens/line     │ 125.0 tokens/line    │
│ LOC/prompt  │ 20.5 lines/prompt    │ 15.2 lines/prompt    │
│ runtime/LOC │ 10.2 sec/line        │ 14.8 sec/line        │
│ runtime/token│ 0.11 sec/token      │ 0.12 sec/token       │
│ Avg tokens  │ 24,000/run           │ 42,000/run           │
│ Avg runtime │ 44 min/run           │ 88 min/run           │
│ Runs/story  │ 2.0 runs             │ 4.5 runs (rework!)   │
├─────────────┼──────────────────────┼──────────────────────┤
│ QA TESTER                                                  │
│ tokens/LOC  │ 75.0 tokens/line     │ N/A                  │
│ LOC/prompt  │ 17.5 lines/prompt    │ N/A                  │
│ runtime/LOC │ 13.5 sec/line        │ N/A                  │
│ runtime/token│ 0.18 sec/token      │ N/A                  │
│ Avg tokens  │ 6,500/run            │ N/A                  │
│ Avg runtime │ 20 min/run           │ N/A                  │
└─────────────┴──────────────────────┴──────────────────────┘

KEY INSIGHTS:
✓ BA+Arch+Dev+QA Developer is 28% more efficient (89.5 vs 125 tokens/LOC)
✓ BA+Arch+Dev+QA Developer generates 35% more LOC per prompt (20.5 vs 15.2)
✓ Dev-only requires 2.25× more developer runs (4.5 vs 2.0) due to rework
✓ BA reduces ambiguity → fewer developer iterations
✓ Architect reduces complexity → cleaner implementation
✓ QA catches defects early → less rework

TOTAL STORY COST COMPARISON:
  BA+Arch+Dev+QA: $6.20/story
    • BA: $0.90
    • Arch: $0.85 (3 runs)
    • Dev: $3.60 (2 runs)
    • QA: $0.85
    • Total runtime: 118 min
    • Defects: 0.8/story

  Dev-only: $4.50/story
    • Dev: $4.50 (4.5 runs)
    • Total runtime: 396 min
    • Defects: 2.3/story
    • Rework cost: $2.80/story

NET COST (including rework):
  BA+Arch+Dev+QA: $6.20
  Dev-only: $7.30 (higher due to rework!)

RECOMMENDATION: Use BA+Arch+Dev+QA for medium+ complexity stories
```

## Automatic Data Collection

All metrics are collected **automatically** via:

1. **Agent execution logging** (required for every agent):
   ```typescript
   // At start of agent execution
   const run_id = await mcp.log_run({
     project_id,
     story_id,
     agent_id,
     framework_id,
     started_at: now(),
     tokens_input: 0,
     tokens_output: 0,
     iterations: 0
   });

   // During execution - track tokens and iterations
   // (Claude Code SDK provides this automatically)

   // At end of execution
   await mcp.log_run({
     run_id,
     finished_at: now(),
     tokens_input: total_input_tokens,
     tokens_output: total_output_tokens,
     iterations: prompt_count,
     success: true,
     metadata: { agent_phase: "implementation" }
   });
   ```

2. **LOC calculation** (automatic from commits):
   ```typescript
   // Git hook on commit
   await mcp.link_commit({
     commit_hash,
     story_id
   });

   // Background worker analyzes commit
   const diff = git.show(commit_hash);
   const loc_added = countLines(diff, '+');
   const loc_deleted = countLines(diff, '-');

   // Links LOC to agent run based on timing
   const recent_run = findRunBeforeCommit(commit_hash);
   await db.update_run({
     run_id: recent_run.id,
     loc_generated: loc_added
   });
   ```

3. **Runtime tracking** (automatic from run timestamps):
   - Duration = finished_at - started_at
   - Calculated automatically when run completes

4. **No manual entry required**:
   - Agents call `log_run` as part of their standard workflow
   - Commits trigger automatic LOC analysis
   - Background workers aggregate metrics
   - Dashboards query aggregated data

## Technical Implementation

### Database Schema

**runs table** (captures each agent execution):
```sql
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  story_id UUID REFERENCES stories,
  epic_id UUID REFERENCES epics,
  agent_id UUID REFERENCES agents,
  framework_id UUID REFERENCES agent_frameworks,
  agent_role TEXT, -- 'ba', 'architect', 'developer', 'qa'

  -- Timing
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (finished_at - started_at))) STORED,

  -- Tokens
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER GENERATED ALWAYS AS
    (tokens_input + tokens_output) STORED,

  -- Work metrics
  iterations INTEGER, -- number of prompts
  loc_generated INTEGER, -- lines of code (from commits)

  -- Outcome
  success BOOLEAN,
  error_type TEXT,

  -- Calculated metrics (materialized for performance)
  tokens_per_loc NUMERIC GENERATED ALWAYS AS
    (CASE WHEN loc_generated > 0
     THEN tokens_total::NUMERIC / loc_generated
     ELSE NULL END) STORED,
  loc_per_prompt NUMERIC GENERATED ALWAYS AS
    (CASE WHEN iterations > 0 AND loc_generated > 0
     THEN loc_generated::NUMERIC / iterations
     ELSE NULL END) STORED,
  runtime_per_loc NUMERIC GENERATED ALWAYS AS
    (CASE WHEN loc_generated > 0
     THEN duration_seconds::NUMERIC / loc_generated
     ELSE NULL END) STORED,
  runtime_per_token NUMERIC GENERATED ALWAYS AS
    (CASE WHEN tokens_total > 0
     THEN duration_seconds::NUMERIC / tokens_total
     ELSE NULL END) STORED,

  metadata JSONB
);

CREATE INDEX idx_runs_story ON runs(story_id);
CREATE INDEX idx_runs_epic ON runs(epic_id);
CREATE INDEX idx_runs_agent_role ON runs(agent_role);
CREATE INDEX idx_runs_framework ON runs(framework_id);
```

### Queries

**Per-story agent executions**:
```sql
SELECT
  id,
  agent_role,
  started_at,
  finished_at,
  duration_seconds,
  tokens_input,
  tokens_output,
  tokens_total,
  iterations,
  loc_generated,
  tokens_per_loc,
  loc_per_prompt,
  runtime_per_loc,
  runtime_per_token,
  success
FROM runs
WHERE story_id = $1
ORDER BY started_at;
```

**Epic-level aggregation**:
```sql
SELECT
  agent_role,
  COUNT(*) as run_count,
  SUM(tokens_total) as total_tokens,
  SUM(duration_seconds) as total_runtime_seconds,
  SUM(loc_generated) as total_loc,
  SUM(iterations) as total_iterations,
  AVG(tokens_per_loc) as avg_tokens_per_loc,
  AVG(loc_per_prompt) as avg_loc_per_prompt,
  AVG(runtime_per_loc) as avg_runtime_per_loc,
  AVG(runtime_per_token) as avg_runtime_per_token
FROM runs
WHERE epic_id = $1
GROUP BY agent_role
ORDER BY agent_role;
```

**Framework comparison**:
```sql
WITH story_complexity AS (
  SELECT id, technical_complexity
  FROM stories
  WHERE technical_complexity = $complexity_band
)
SELECT
  r.framework_id,
  r.agent_role,
  COUNT(*) as run_count,
  AVG(r.tokens_per_loc) as avg_tokens_per_loc,
  AVG(r.loc_per_prompt) as avg_loc_per_prompt,
  AVG(r.runtime_per_loc) as avg_runtime_per_loc,
  AVG(r.runtime_per_token) as avg_runtime_per_token,
  AVG(r.duration_seconds) as avg_duration,
  AVG(r.tokens_total) as avg_tokens
FROM runs r
JOIN story_complexity sc ON r.story_id = sc.id
WHERE r.framework_id = ANY($framework_ids)
  AND r.success = true
GROUP BY r.framework_id, r.agent_role
ORDER BY r.framework_id, r.agent_role;
```

## MCP Tool Integration

**Tool: `log_run`** (used by all agents automatically):
```typescript
{
  name: "log_run",
  parameters: {
    project_id: string,
    story_id?: string,
    epic_id?: string,
    agent_id: string,
    framework_id?: string,
    agent_role: "ba" | "architect" | "developer" | "qa",
    started_at?: timestamp, // if starting new run
    run_id?: string,        // if updating existing run
    finished_at?: timestamp,
    tokens_input?: number,
    tokens_output?: number,
    iterations?: number,
    success?: boolean,
    error_type?: string,
    metadata?: object
  },
  handler: async (params) => {
    if (params.run_id) {
      // Update existing run
      await db.runs.update({
        id: params.run_id,
        finished_at: params.finished_at,
        tokens_input: params.tokens_input,
        tokens_output: params.tokens_output,
        iterations: params.iterations,
        success: params.success
      });

      // Link LOC from recent commits
      const commits = await db.commits.findByStoryAndTime(
        params.story_id,
        run_started_at,
        params.finished_at
      );
      const total_loc = commits.reduce((sum, c) => sum + c.loc_added, 0);
      await db.runs.update({
        id: params.run_id,
        loc_generated: total_loc
      });

    } else {
      // Create new run
      const run_id = await db.runs.create({
        ...params,
        started_at: params.started_at || now()
      });
      return { run_id };
    }
  }
}
```

## Related Use Cases
- UC-INT-001: End-to-End Story Workflow (shows automatic logging)
- UC-DEV-002: Implement Story (shows developer logging)
- UC-METRICS-001: View Framework Effectiveness
- UC-METRICS-002: View Project Tracker

## Acceptance Criteria
- ✓ Every agent execution is logged automatically (no manual entry)
- ✓ All 4 metrics visible: tokens/LOC, LOC/prompt, runtime/LOC, runtime/token
- ✓ Per-story view shows all agent runs (e.g., 3x architect, 1x ba, 1x dev)
- ✓ Epic-level view aggregates all stories
- ✓ Analytics view compares frameworks with per-agent breakdowns
- ✓ LOC calculation is automatic from commits
- ✓ Runtime calculation is automatic from timestamps
- ✓ Multiple runs by same agent type are tracked separately
- ✓ User can evaluate agentic setup effectiveness
- ✓ No developer interruption - all background processing
