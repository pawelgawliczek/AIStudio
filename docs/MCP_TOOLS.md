# MCP Tools

**Version:** 1.0
**Last Updated:** 2025-12-17
**Epic:** ST-279

## Overview

The MCP (Model Context Protocol) Tools system provides a structured way to organize and expose backend functionality to AI agents. Tools are organized into 11 server categories, with a core profile of 25 essential tools pre-loaded for every agent. Additional tools can be discovered via `search_tools` and invoked dynamically via `invoke_tool`.

## Architecture

### Tool Organization

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tool Registry                         │
│                                                              │
│  11 Server Categories:                                       │
│  ├─ projects        (Project management)                     │
│  ├─ epics           (Epic management)                        │
│  ├─ stories         (Story management)                       │
│  ├─ use-cases       (Use case management)                    │
│  ├─ artifacts       (Artifact management)                    │
│  ├─ execution       (Workflow execution)                     │
│  ├─ runner          (Story runner control)                   │
│  ├─ orchestration   (Agent coordination)                     │
│  ├─ meta            (Tool discovery)                         │
│  ├─ remote          (Remote agent tasks)                     │
│  └─ approval        (Approval gates)                         │
└─────────────────────────────────────────────────────────────┘
```

### Core Profile (25 Tools)

These tools are pre-loaded for every agent and do not require `invoke_tool`:

**Workflow Execution (7 tools):**
- `start_team_run` - Start workflow execution for a story
- `update_team_status` - Update workflow status
- `get_current_step` - Get current state instructions
- `advance_step` - Move to next state (automatic agent tracking)
- `repeat_step` - Retry current state with feedback
- `get_runner_status` - Get workflow execution status
- `get_team_context` - Get team/workflow state

**Story Management (6 tools):**
- `create_story` - Create new story
- `get_story` - Get story details
- `update_story` - Update story fields
- `list_stories` - Search stories
- `get_component_context` - Get component instructions and artifacts
- `set_context` - Set session context (projectId, storyId, etc.)

**Artifact Management (4 tools):**
- `upload_artifact` - Create/update artifact
- `get_artifact` - Get artifact by ID or key
- `list_artifacts` - List artifacts for story/workflow

**Orchestration (4 tools):**
- `get_context` - Get session context
- `search_tools` - Discover available tools
- `invoke_tool` - Call non-core tool by name
- `list_teams` - List available workflows

**Projects (4 tools):**
- `get_project` - Get project details
- `list_projects` - List all projects

## Data Structures

### Tool Definition

```typescript
{
  name: string;                    // Tool identifier (e.g., "create_story")
  category: string;                // Server category (e.g., "stories")
  description: string;             // Human-readable description
  tags: string[];                  // Searchable tags

  inputSchema: {                   // JSON Schema for parameters
    type: "object",
    properties: {
      storyId: { type: "string" },
      title: { type: "string" },
      // ...
    },
    required: ["storyId", "title"]
  },

  handler: (params: object) => Promise<ToolResponse>;
}
```

### Tool Response

```typescript
{
  success: boolean;
  data?: object;                   // Response data
  error?: string;                  // Error message if failed
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
  };
}
```

## Flows

### Using Core Tools

Core tools are directly accessible without discovery:

```typescript
// Example: Start workflow
const result = await start_team_run({
  teamId: "df9bf06d-38c5-4fa8-9c7d-b60d0bdfc122",
  triggeredBy: "orchestrator",
  cwd: "/Users/pawelgawliczek/projects/AIStudio",
  sessionId: "abc123",
  transcriptPath: "/Users/pawelgawliczek/.claude/sessions/session-abc123.jsonl",
  context: {
    storyId: "story-uuid",
  }
});

// Example: Upload artifact
await upload_artifact({
  storyId: "story-uuid",
  definitionKey: "ARCH_DOC",
  content: "# Architecture Document\n\n...",
  contentType: "text/markdown"
});

// Example: Advance to next state
await advance_step({
  story: "ST-123",
  output: { summary: "Implementation completed" }
});
```

### Discovering Non-Core Tools

Use `search_tools` to find tools not in core profile:

```typescript
// Search by category
const deploymentTools = await search_tools({
  category: "deployment",
  detail_level: "with_descriptions"
});

// Search by keyword
const approvalTools = await search_tools({
  query: "approval",
  detail_level: "full_schema"
});

// Get all tools in a category
const remoteTools = await search_tools({
  category: "remote",
  detail_level: "names_only"
});
```

**Detail Levels:**
- `names_only`: Just tool names (minimal)
- `with_descriptions`: Names + descriptions
- `full_schema`: Complete schema including input/output

### Invoking Non-Core Tools

Use `invoke_tool` to call tools not in core profile:

```typescript
const result = await invoke_tool({
  toolName: "deploy_to_production",
  params: {
    service: "backend",
    version: "v1.2.3"
  }
});

// Example: Create approval request
await invoke_tool({
  toolName: "create_approval_request",
  params: {
    workflowRunId: "run-uuid",
    stateId: "state-uuid",
    contextSummary: "Agent completed implementation"
  }
});
```

## Tool Categories

### 1. Projects Server

Tools for project management.

**Tools:**
- `create_project` - Create new project
- `get_project` - Get project details
- `list_projects` - List all projects
- `update_project` - Update project metadata

### 2. Stories Server

Tools for story management (core tools).

**Tools:**
- `create_story` - Create new story
- `get_story` - Get story details
- `update_story` - Update story fields
- `list_stories` - Search and filter stories

### 3. Execution Server

Tools for workflow execution (core tools).

**Tools:**
- `start_team_run` - Start workflow for story
- `update_team_status` - Update workflow status
- `list_teams` - List available workflows

### 4. Runner Server

Tools for story runner control (core tools).

**Tools:**
- `get_current_step` - Get current state instructions
- `advance_step` - Move to next state (automatic agent tracking)
- `repeat_step` - Retry current state with feedback
- `get_runner_status` - Get workflow status and checkpoint

### 5. Orchestration Server

Tools for agent coordination (core tools).

**Tools:**
- `get_component_context` - Get component instructions and artifacts
- `get_team_context` - Get team/workflow state
- `set_context` - Set session context
- `get_context` - Get session context

### 6. Artifacts Server

Tools for artifact management (core tools).

**Tools:**
- `upload_artifact` - Create/update artifact
- `get_artifact` - Get artifact by ID or key
- `list_artifacts` - List artifacts for story/workflow

### 7. Meta Server

Tools for tool discovery (core tools).

**Tools:**
- `search_tools` - Discover available tools
- `invoke_tool` - Call non-core tool by name

### 8. Approval Server

Tools for approval gate management.

**Tools:**
- `create_approval_request` - Create approval request
- `resolve_approval_request` - Approve/reject/rerun
- `list_approval_requests` - List pending approvals

### 9. Remote Server

Tools for remote agent execution.

**Tools:**
- `execute_remote_script` - Run script on laptop
- `list_remote_agents` - List connected agents
- `get_remote_agent_status` - Check agent connectivity

### 10. Epics Server

Tools for epic management.

**Tools:**
- `create_epic` - Create new epic
- `get_epic` - Get epic details
- `update_epic` - Update epic metadata
- `list_epics` - List epics for project

### 11. Use Cases Server

Tools for use case management.

**Tools:**
- `create_use_case` - Create new use case
- `get_use_case` - Get use case details
- `update_use_case` - Update use case
- `link_story_to_use_case` - Link story to use case
- `list_use_cases` - List use cases for project

## Adding New Tools

### 1. Define Tool in Server Module

```typescript
// backend/src/mcp/servers/my-category/my-tool.ts
import { z } from 'zod';

export const myToolSchema = {
  name: 'my_tool',
  description: 'Description of what this tool does',
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  tags: ['category', 'keyword'],
};

export async function myToolHandler(params: z.infer<typeof myToolSchema.inputSchema>) {
  // Implementation
  return {
    success: true,
    data: { result: 'value' }
  };
}
```

### 2. Register Tool in Server

```typescript
// backend/src/mcp/servers/my-category/index.ts
import { myToolSchema, myToolHandler } from './my-tool';

export function registerMyCategoryTools(server: McpServer) {
  server.tool(myToolSchema.name, myToolSchema.description, myToolSchema.inputSchema, myToolHandler);
}
```

### 3. Add to Registry

```typescript
// backend/src/mcp/tool-registry.ts
import { registerMyCategoryTools } from './servers/my-category';

export function initializeToolRegistry() {
  const servers = [
    { name: 'my-category', register: registerMyCategoryTools },
    // ...
  ];

  for (const server of servers) {
    server.register(mcpServer);
  }
}
```

### 4. Add to Core Profile (Optional)

If tool should be pre-loaded:

```typescript
// backend/src/mcp/tool-registry.ts
const CORE_PROFILE = [
  // ... existing core tools
  'my_tool',
];
```

## Troubleshooting

### Tool not found

**Symptom:** `invoke_tool` returns "Tool not found" error.

**Diagnosis:**
```typescript
// Check if tool exists
const tools = await search_tools({
  query: "my_tool",
  detail_level: "names_only"
});
```

**Solution:**
- Verify tool is registered in server module
- Check tool name matches exactly (case-sensitive)
- Ensure server is initialized in tool registry

### Tool in core profile but not available

**Symptom:** Direct call to core tool fails with "not defined".

**Diagnosis:**
```typescript
// List core tools
const coreTools = await search_tools({
  category: "all",
  detail_level: "names_only"
});
console.log('Core tools:', coreTools.filter(t => t.isCore));
```

**Solution:**
- Verify tool is listed in CORE_PROFILE array
- Check MCP server initialization logs
- Restart backend to reload tool registry

### Invalid parameters error

**Symptom:** Tool call fails with "Invalid parameters" error.

**Diagnosis:**
```typescript
// Get full schema
const schema = await search_tools({
  query: "my_tool",
  detail_level: "full_schema"
});
console.log('Required params:', schema[0].inputSchema.required);
```

**Solution:**
- Check required vs optional parameters in schema
- Verify parameter types match schema (string vs number vs object)
- Review tool documentation for parameter format

## References

- ST-163: MCP HTTP API Keys
- ST-242: Tool Simplification (removed obsolete tools)
- ST-279: Living Documentation System

## Changelog

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented 11 server categories and core profile (25 tools)
- Added tool discovery and invocation patterns
- Documented how to add new tools to registry
