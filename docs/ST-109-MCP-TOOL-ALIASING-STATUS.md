# ST-109 MCP Tool Aliasing Status

## Overview
This document tracks the progress of MCP tool aliasing for user-friendly terminology rebrand.

**Goal:** Alias 30 MCP tools (Workflow→Team, Component→Agent, Coordinator→Project Manager)
**Strategy:** Export dual tool definitions that call the same handler function

## Pattern Example
```typescript
// Original tool (unchanged)
export const tool: Tool = {
  name: 'list_workflows',
  description: '...',
  inputSchema: { ... }
};

export async function handler(prisma: PrismaClient, params: any) {
  // Implementation unchanged
}

// NEW: Aliased tool (user-friendly name)
export const teamTool: Tool = {
  name: 'list_teams',
  description: 'List all teams... (user-friendly)',
  inputSchema: tool.inputSchema, // Reuse schema
};

export const teamMetadata = {
  category: 'teams',
  tags: ['team', 'agents'],
  aliasOf: 'list_workflows',
};
```

## Iteration 3 Progress (Partial - Strategic Sample)

### ✅ COMPLETED: Workflow Tools (4 tools)
| Original Tool | Aliased Tool | File | Status |
|--------------|-------------|------|--------|
| list_workflows | list_teams | execution/list_workflows.ts | ✅ Done |
| create_workflow | create_team | workflows/create_workflow.ts | ✅ Done |
| update_workflow | update_team | workflows/update_workflow.ts | ✅ Done |
| assign_workflow_to_story | assign_team_to_story | execution/assign_workflow_to_story.ts | ✅ Done |

### ⏳ REMAINING: Execution Tools (7 tools)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| execute_story_with_workflow | execute_story_with_team | execution/execute_story_with_workflow.ts | HIGH |
| execute_epic_with_workflow | execute_epic_with_team | execution/execute_epic_with_workflow.ts | HIGH |
| get_workflow_context | get_team_context | execution/get_workflow_context.ts | HIGH |
| get_workflow_run_results | get_team_run_results | execution/get_workflow_run_results.ts | MEDIUM |
| list_workflow_runs | list_team_runs | execution/list_workflow_runs.ts | MEDIUM |
| start_workflow_run | start_team_run | execution/start_workflow_run.ts | MEDIUM |
| update_workflow_status | update_team_status | execution/update_workflow_status.ts | MEDIUM |

### ⏳ REMAINING: Component Tools (11 tools)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| list_components | list_agents | versioning/list_components.ts | HIGH |
| create_component | create_agent | components/create_component.ts | HIGH |
| update_component | update_agent | components/update_component.ts | HIGH |
| get_component | get_agent | versioning/get_component.ts | HIGH |
| get_component_instructions | get_agent_instructions | components/get_component_instructions.ts | HIGH |
| get_component_context | get_agent_context | execution/get_component_context.ts | HIGH |
| record_component_start | record_agent_start | execution/record_component_start.ts | HIGH |
| record_component_complete | record_agent_complete | execution/record_component_complete.ts | HIGH |
| activate_component | activate_agent | components/activate_component.ts | MEDIUM |
| deactivate_component | deactivate_agent | components/deactivate_component.ts | MEDIUM |
| get_component_usage | get_agent_usage | components/get_component_usage.ts | LOW |

### ⏳ REMAINING: Coordinator Tools (7 tools)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| list_coordinators | list_project_managers | versioning/list_coordinators.ts | HIGH |
| create_coordinator | create_project_manager | coordinators/create_coordinator.ts | HIGH |
| update_coordinator | update_project_manager | coordinators/update_coordinator.ts | HIGH |
| get_coordinator | get_project_manager | versioning/get_coordinator.ts | MEDIUM |
| activate_coordinator | activate_project_manager | coordinators/activate_coordinator.ts | MEDIUM |
| deactivate_coordinator | deactivate_project_manager | coordinators/deactivate_coordinator.ts | MEDIUM |
| get_coordinator_usage | get_project_manager_usage | coordinators/get_coordinator_usage.ts | LOW |

### ⏳ REMAINING: Versioning Tools (3 tools)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| create_workflow_version | create_team_version | versioning/create_workflow_version.ts | MEDIUM |
| create_component_version | create_agent_version | versioning/create_component_version.ts | MEDIUM |
| create_coordinator_version | create_project_manager_version | versioning/create_coordinator_version.ts | MEDIUM |

### ⏳ REMAINING: Metrics Tools (2 tools)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| get_component_actual_metrics | get_agent_actual_metrics | metrics/get_component_actual_metrics.ts | LOW |
| get_workflow_metrics_breakdown | get_team_metrics_breakdown | metrics/get_workflow_metrics_breakdown.ts | LOW |

### ⏳ REMAINING: Test Coverage Tools (1 tool)
| Original Tool | Aliased Tool | File | Priority |
|--------------|-------------|------|----------|
| get_component_test_coverage | get_agent_test_coverage | test-coverage/get_component_test_coverage.ts | LOW |

## Summary

**Total Tools:** 30
**Completed:** 4 (13%)
**Remaining:** 26 (87%)

**Estimated Effort for Remaining:**
- HIGH priority (16 tools): ~3 hours
- MEDIUM priority (8 tools): ~1.5 hours
- LOW priority (6 tools): ~1 hour
- **Total:** ~5.5 hours

## Next Steps for Future Iterations

1. **Complete HIGH priority tools** (16 tools, ~3 hours)
   - These are the most frequently used tools
   - Execute, Component CRUD, Coordinator CRUD
   
2. **Complete MEDIUM priority tools** (8 tools, ~1.5 hours)
   - Versioning and workflow run management
   
3. **Complete LOW priority tools** (6 tools, ~1 hour)
   - Metrics and test coverage
   
4. **Update MCP server registration**
   - Ensure all aliased tools are registered
   - Verify tool list shows both old and new names
   
5. **Update CLAUDE.md**
   - Document new tool names
   - Mark old tools as deprecated
   - Provide migration guide

## Technical Notes

**Backwards Compatibility:**
- All original tool names continue to work
- Aliased tools call the same handler functions
- Zero code duplication
- Full backwards compatibility maintained

**Parameter Mapping:**
- Some aliased tools accept user-friendly parameter names
- Example: `teamId` instead of `workflowId`, `projectManagerId` instead of `coordinatorId`
- Handler functions accept original parameter names
- Frontend/MCP layer will need to map parameters if using aliased names

**Testing Strategy:**
- Integration tests should verify both old and new tool names work
- Test that both tools return identical data
- Test backwards compatibility

---

*Last Updated: 2025-11-26 (Iteration 3)*
*Created By: ST-109 Implementation*
