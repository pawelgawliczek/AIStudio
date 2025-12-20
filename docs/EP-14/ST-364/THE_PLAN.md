# Standardize Agent Artifact Instructions

## Overview

Update all 10 agent components with standardized artifact handling:
- **THE_PLAN**: Read from local files, not MCP (network reliability)
- **AGENT_PROGRESS.md**: New artifact - all agents append their progress
- **Epic-level THE_PLAN**: Check if story is part of epic

---

## Agent Classification

| Agent | THE_PLAN Access | Notes |
|-------|-----------------|-------|
| Native Explorer | **MUST UPDATE** | Adds exploration findings |
| Architect | **MUST UPDATE** | Consolidates and refines |
| Native Planner | **MUST UPDATE** | Helps create the plan |
| Security Expert | UPDATE IF NEEDED | May update with security findings |
| Tester | UPDATE IF NEEDED | May update with test coverage notes |
| Developer | UPDATE IF NEEDED | May update if reqs changed during impl |
| Reviewer | UPDATE IF NEEDED | May update with review findings |
| Playwright Verifier | UPDATE IF NEEDED | May update with verification results |
| Document Writer | UPDATE IF NEEDED | May update with doc references |
| Workflow Router | N/A | Routes stories only |

**All agents have WRITE access** to THE_PLAN but only Explorer/Architect/Planner are required to update it.

---

## Implementation Steps

### Step 1: Create AGENT_PROGRESS Definitions

| Workflow | ID |
|----------|-----|
| Simplified Dev | df9bf06d-38c5-4fa8-9c7d-b60d0bdfc122 |
| Standard Dev | 947507c7-2abc-4a10-a0b9-8255d074ebae |
| With Approved Plan | afeee150-c813-4854-a7ab-8c6224d73db4 |

### Step 2: Update Agent Instructions

| Agent ID | Name | Changes |
|----------|------|---------|
| 644e1475-5c40-4bad-bbee-87a42a87450a | Native Explorer | MUST UPDATE THE_PLAN |
| d3d4de04-b568-4a32-9c69-d596e7d1dafe | Architect | MUST UPDATE THE_PLAN |
| 58bdc835-0aa1-47d6-a3a7-a13432e19dec | Native Planner | MUST UPDATE THE_PLAN |
| c32e19ca-7167-48fd-80aa-6295415d07e2 | Security Expert | UPDATE IF NEEDED |
| 2c15ec29-86c8-4329-b286-0c86106f2a56 | Tester | UPDATE IF NEEDED |
| ed696f41-7a5c-44c0-8bbb-d9b899d8862c | Developer | UPDATE IF NEEDED |
| 0e10589c-1a97-4986-ba6e-408457cd844c | Reviewer | UPDATE IF NEEDED |
| 3eac353d-933b-476f-b1a2-347dbc8a20cf | Playwright Verifier | UPDATE IF NEEDED |
| 67bf1d40-c4d0-46e6-af63-74e20f5365e9 | Document Writer | UPDATE IF NEEDED |

### Step 3: Update task-prompt-builder.ts

Add epic context to agent prompts:

```typescript
if (story.epicId) {
  prompt += `\n## Epic Context\n`;
  prompt += `This story belongs to Epic: EP-${epic.key}\n`;
  prompt += `Check docs/EP-${epic.key}/THE_PLAN.md for overarching context.\n`;
}
```

File: `backend/src/mcp/shared/task-prompt-builder.ts`

---

## Instruction Templates

### Input (all agents)
```
## Context Sources
1. **THE_PLAN**: Read `docs/EP-{EPIC}/ST-{KEY}/THE_PLAN.md` (local file)
2. **Epic Plan**: If epic exists, also read `docs/EP-{EPIC}/THE_PLAN.md`
3. **Previous Progress**: Read `docs/EP-{EPIC}/ST-{KEY}/AGENT_PROGRESS.md`
```

### Output (all agents)
```
## Progress Report
Append to `docs/EP-{EPIC}/ST-{KEY}/AGENT_PROGRESS.md`:
- Agent name + timestamp
- What was completed
- What wasn't done
- Notes for next agent
```

### THE_PLAN Update

**Explorer, Architect, Planner:** MUST update with findings.
**All others:** Update ONLY if implementation required changes.

---

## Files Modified

- `backend/src/mcp/shared/task-prompt-builder.ts` - Add epic context
- MCP: `create_artifact_definition` x3, `update_agent` x9
