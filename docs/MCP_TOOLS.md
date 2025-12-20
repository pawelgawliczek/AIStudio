# MCP Tools

**Version:** 1.1
**Last Updated:** 2025-12-18
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

**Artifact Management (5 tools):**
- `create_artifact` - Create/update artifact (renamed from `upload_artifact`)
- `upload_artifact_from_md_file` - Upload artifact from markdown file (renamed from `upload_artifact_from_file`)
- `upload_artifact_from_binary_file` - Upload artifact from binary file (NEW - supports images, PDFs, etc.)
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

// Example: Create artifact
await create_artifact({
  storyId: "story-uuid",
  definitionKey: "ARCH_DOC",
  content: "# Architecture Document\n\n...",
  contentType: "text/markdown"
});

// Example: Upload binary file (image, PDF, etc.)
await upload_artifact_from_binary_file({
  storyId: "story-uuid",
  definitionKey: "DESIGN_IMAGE",
  filePath: "/path/to/image.png"
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

#### get_current_step - Agent Phase Response Format

When `get_current_step` returns instructions for an agent phase, the `workflowSequence` includes an `agentConfig` object that provides everything needed to spawn the Task agent:

```typescript
{
  workflowSequence: [
    {
      step: 1,
      type: 'agent_spawn',
      description: 'Spawn {{ComponentName}} agent via Task tool',
      agentConfig: {
        subagentType: string,      // Derived from component executionType
        model: string,             // From component.config.modelId
        prompt: string,            // Full prompt assembled by buildTaskPrompt()
        componentId: string,       // Component UUID
        componentName: string,     // Component name (e.g., "Explorer", "Implementer")
        tools: string[]           // MCP tools available to agent
      },
      notes: '...'
    },
    // Additional steps...
  ]
}
```

**Subagent Type Mapping:**

The `deriveSubagentType()` function maps component `executionType` to Claude Code Task types:
- `native_explore` → `"Explore"`
- `native_plan` → `"Plan"`
- `native_general` → `"general-purpose"`
- Any custom type → `"general-purpose"` (default)

**Prompt Assembly:**

The `buildTaskPrompt()` function assembles the agent prompt from:

1. **Pre-execution Context** (if exists)
   - `state.preExecutionInstructions` - Workflow context for this state

2. **Component Instructions**
   - `component.inputInstructions` - What inputs the agent receives
   - `component.operationInstructions` - Task the agent should perform
   - `component.outputInstructions` - Expected output format

3. **Previous Component Outputs** (if any)
   - Completed ComponentRun records with `componentSummary`
   - Formatted with structured summary sections (status, keyOutputs, nextAgentHints, errors)

4. **Artifact Access Instructions** (if configured)
   - Required artifacts (MUST READ) - blocks if missing
   - Read artifacts - available for reference
   - Write artifacts - expected to create/update
   - Includes MCP tool examples for each artifact

**Example Usage:**

```typescript
// Get current step
const step = await get_current_step({ story: "ST-123" });

// Extract agentConfig from workflowSequence
const agentStep = step.workflowSequence.find(s => s.type === 'agent_spawn');
const config = agentStep.agentConfig;

// Spawn Task agent with exact configuration
await Task({
  subagent_type: config.subagentType,  // "Explore", "Plan", or "general-purpose"
  model: config.model,                  // e.g., "claude-sonnet-4-20250514"
  prompt: config.prompt                 // Complete multi-section prompt
});

// Advance after agent completes (auto-tracks agent metrics)
await advance_step({
  story: "ST-123",
  output: agentOutput  // Captured from Task agent
});
```

**Notes:**
- The orchestrator MUST use the Task tool - never do the work directly
- Agent tracking (record_agent_start/complete) is AUTOMATIC in advance_step
- The prompt includes all necessary context - agent doesn't need prior workflow knowledge
- For code-modifying components (Implementer, Developer), an additional commit step is included

### 5. Orchestration Server

Tools for agent coordination (core tools).

**Tools:**
- `get_component_context` - Get component instructions and artifacts
- `get_team_context` - Get team/workflow state
- `set_context` - Set session context
- `get_context` - Get session context

### 6. Artifacts Server

Tools for artifact management (core tools). Supports text and binary artifact uploads.

**Tools:**
- `create_artifact` - Create/update artifact with text content
- `upload_artifact_from_md_file` - Upload artifact from markdown file
- `upload_artifact_from_binary_file` - Upload artifact from binary file (images, PDFs, etc.)
- `get_artifact` - Get artifact by ID or key
- `list_artifacts` - List artifacts for story/workflow

**Backward Compatibility:**
- `upload_artifact` → `create_artifact` (deprecated alias)
- `upload_artifact_from_file` → `upload_artifact_from_md_file` (deprecated alias)

**EP-14 File-Based Pattern (Recommended):**
Instead of calling MCP artifact tools, agents should write artifacts to `docs/ST-XXX/ARTIFACT_KEY.md`. The ArtifactWatcher daemon automatically detects changes and uploads via UploadManager with guaranteed delivery. This pattern provides better reliability than direct MCP calls.

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

### Version 1.3 (2025-12-19)
- **EP-14**: Added file-based artifact pattern recommendation
- Documented ArtifactWatcher automatic upload with guaranteed delivery
- Note that direct MCP artifact calls are being superseded by file-based approach

### Version 1.2 (2025-12-18)
- ST-307: Updated artifact tool names and documentation
  - `upload_artifact` → `create_artifact` (primary tool name)
  - `upload_artifact_from_file` → `upload_artifact_from_md_file` (primary tool name)
  - NEW: `upload_artifact_from_binary_file` - supports binary files (images, PDFs, etc.)
- Added backward compatibility aliases for deprecated tool names
- Updated core profile from 4 to 5 artifact tools
- Updated examples to use new artifact tool naming

### Version 1.1 (2025-12-18)
- ST-289: Documented agentConfig format in get_current_step response
- Added deriveSubagentType mapping (executionType to Task subagent types)
- Documented buildTaskPrompt prompt assembly logic
- Added example usage for Task agent spawning with agentConfig

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented 11 server categories and core profile (25 tools)
- Added tool discovery and invocation patterns
- Documented how to add new tools to registry
