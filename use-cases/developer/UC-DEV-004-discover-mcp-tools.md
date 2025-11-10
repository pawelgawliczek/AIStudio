# UC-DEV-004: Discover and Use MCP Tools with Progressive Disclosure

## Actor
Developer Agent (via Claude Code, Aider, Cursor) or Human Developer using MCP client

## Preconditions
- AI Studio MCP Server is running and connected
- Agent/Developer has access to MCP tools via Claude Code or compatible client
- Database connection is active
- Agent is working within a project context

## Main Flow

### Phase 1: Initial Discovery (Minimal Tokens)
1. Agent/Developer needs to find available tools
2. Agent calls MCP tool: `search_tools({ detail_level: 'names_only' })`
   - System scans `backend/src/mcp/servers/` directory
   - Returns array of tool names only
   - Example response:
     ```json
     {
       "tools": [
         "search_tools",
         "bootstrap_project",
         "create_project",
         "list_projects",
         "get_project",
         "get_project_summary",
         "create_epic",
         "list_epics",
         "create_story",
         "list_stories",
         "get_story",
         "get_story_summary",
         "update_story"
       ],
       "total": 13,
       "detail_level": "names_only"
     }
     ```
   - **Token usage:** ~100 bytes

### Phase 2: Category Exploration (Moderate Tokens)
3. Agent identifies category of interest (e.g., "projects")
4. Agent calls: `search_tools({ category: 'projects', detail_level: 'with_descriptions' })`
   - System filters tools by category
   - Returns names + descriptions (no schemas)
   - Example response:
     ```json
     {
       "tools": [
         {
           "name": "bootstrap_project",
           "description": "Bootstrap a new project with default structure, including initial epic and framework configuration",
           "category": "projects"
         },
         {
           "name": "create_project",
           "description": "Create a new project without default structure",
           "category": "projects"
         },
         {
           "name": "list_projects",
           "description": "List all projects with optional status filter and pagination",
           "category": "projects"
         },
         {
           "name": "get_project",
           "description": "Get details for a specific project by ID",
           "category": "projects"
         },
         {
           "name": "get_project_summary",
           "description": "Get aggregated statistics for a project",
           "category": "projects"
         }
       ],
       "total": 5,
       "detail_level": "with_descriptions"
     }
     ```
   - **Token usage:** ~500-800 bytes

### Phase 3: Tool Schema Retrieval (Full Details)
5. Agent selects specific tool to use (e.g., "bootstrap_project")
6. Agent calls: `search_tools({ query: 'bootstrap_project', detail_level: 'full_schema' })`
   - System loads complete tool definition from file
   - Returns full schema with parameters and metadata
   - Example response:
     ```json
     {
       "tools": [
         {
           "name": "bootstrap_project",
           "description": "Bootstrap a new project with default structure...",
           "category": "projects",
           "inputSchema": {
             "type": "object",
             "properties": {
               "name": {
                 "type": "string",
                 "description": "Project name (must be unique)"
               },
               "description": {
                 "type": "string",
                 "description": "Project description"
               },
               "repositoryUrl": {
                 "type": "string",
                 "description": "Git repository URL"
               },
               "defaultFramework": {
                 "type": "string",
                 "description": "Name for default framework"
               }
             },
             "required": ["name"]
           },
           "metadata": {
             "category": "projects",
             "domain": "project_management",
             "tags": ["project", "bootstrap", "create"],
             "version": "1.0.0",
             "since": "sprint-3"
           }
         }
       ],
       "total": 1,
       "detail_level": "full_schema"
     }
     ```
   - **Token usage:** ~800-1000 bytes per tool

### Phase 4: Tool Execution
7. Agent executes tool with appropriate parameters
8. Agent calls: `bootstrap_project({ name: 'MyNewProject', description: 'My awesome project' })`
   - System validates parameters against schema
   - Loads tool handler dynamically from `servers/projects/bootstrap_project.ts`
   - Executes business logic
   - Returns result:
     ```json
     {
       "project": {
         "id": "uuid",
         "name": "MyNewProject",
         "status": "active",
         "createdAt": "2025-11-10T...",
         "epicCount": 1,
         "storyCount": 0
       },
       "defaultEpic": {
         "id": "uuid",
         "key": "EP-1",
         "title": "Initial Development"
       },
       "defaultFramework": {
         "id": "uuid",
         "name": "Single Agent"
       },
       "message": "Project \"MyNewProject\" bootstrapped successfully..."
     }
     ```

## Postconditions
- Agent successfully discovered available tools
- Agent understood tool purpose via descriptions
- Agent executed tool with correct parameters
- Token usage minimized through progressive disclosure
- **Total token usage:** ~1.5-2KB (vs. 5-25KB with full upfront loading)

## Alternative Flows

### 3a. Search by Keyword
- At step 3, agent searches for specific functionality
- Agent calls: `search_tools({ query: 'story', detail_level: 'with_descriptions' })`
- System filters tools matching keyword in name, description, or tags
- Returns only matching tools
- Agent narrows down to relevant tools quickly

### 3b. List All Tools with Descriptions
- At step 3, agent wants to see all available tools with descriptions
- Agent calls: `search_tools({ category: 'all', detail_level: 'with_descriptions' })`
- System returns all tools across all categories
- **Token usage:** ~2-3KB (still better than full schema upfront)

### 6a. Tool Not Found
- At step 6, agent searches for non-existent tool
- System returns empty array
- Agent receives helpful error message
- Agent retries with broader search or different category

### 8a. Invalid Parameters
- At step 8, agent provides invalid parameters
- System validates against input schema
- Returns validation error with specific field issues
- Agent corrects parameters and retries

### 8b. Tool Execution Fails
- At step 8, tool execution encounters error (database, business logic)
- System catches error, formats consistently
- Returns structured error response:
  ```json
  {
    "error": "Project with name 'MyNewProject' already exists",
    "code": "VALIDATION_ERROR",
    "statusCode": 400
  }
  ```
- Agent handles error gracefully (retry, notify user, log)

## Business Rules
- **Progressive Disclosure Required:** Agents should start with minimal detail levels
- **Category Organization:** Tools grouped by domain (projects, epics, stories, meta)
- **Detail Levels:**
  - `names_only`: Return only tool names (default)
  - `with_descriptions`: Return names + descriptions + categories
  - `full_schema`: Return complete tool definitions
- **Search Behavior:**
  - Empty query = return all in category
  - Query matches: name, description, tags (case-insensitive)
  - Category filter: 'projects', 'epics', 'stories', 'meta', 'all'
- **Caching:** Tool definitions cached in memory after first load
- **Dynamic Loading:** Handlers loaded on execution, not discovery

## Technical Implementation

### File-Based Tool Organization
```
backend/src/mcp/
├── servers/                    # Tool discovery root
│   ├── projects/
│   │   ├── bootstrap_project.ts
│   │   ├── create_project.ts
│   │   ├── list_projects.ts
│   │   ├── get_project.ts
│   │   └── get_project_summary.ts
│   ├── epics/
│   │   ├── create_epic.ts
│   │   └── list_epics.ts
│   ├── stories/
│   │   ├── create_story.ts
│   │   ├── list_stories.ts
│   │   ├── get_story.ts
│   │   ├── get_story_summary.ts
│   │   └── update_story.ts
│   └── meta/
│       └── search_tools.ts     # This tool
├── core/
│   ├── loader.ts               # ToolLoader class
│   ├── registry.ts             # ToolRegistry class
│   └── discovery.ts            # Filesystem scanning
└── server.ts                   # MCP server entry point
```

### Tool File Format
Each tool exports:
```typescript
// Tool definition (for discovery)
export const tool: Tool = {
  name: 'tool_name',
  description: 'What this tool does',
  inputSchema: { /* JSON Schema */ }
};

// Tool metadata (for categorization)
export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['tag1', 'tag2'],
  version: '1.0.0',
  since: 'sprint-3'
};

// Tool handler (for execution)
export async function handler(prisma: PrismaClient, params: any) {
  // Business logic
}
```

### Progressive Disclosure Architecture
```typescript
// ToolRegistry manages discovery and execution
class ToolRegistry {
  async discoverTools(category: string): Promise<ToolModule[]>
  async listTools(category?: string): Promise<Tool[]>
  async executeTool(name: string, params: any): Promise<any>
  async searchTools(query: string, category: string, detailLevel: string): Promise<any>
}

// ToolLoader handles dynamic loading
class ToolLoader {
  async discoverTools(category: string): Promise<ToolModule[]>
  async loadToolModule(filePath: string): Promise<ToolModule>
  async getToolByName(name: string): Promise<ToolModule>
}
```

### Token Usage Comparison

| Scenario | Old Approach (Upfront) | New Approach (Progressive) | Savings |
|----------|------------------------|----------------------------|---------|
| Discover all tools (10 tools) | ~5KB | ~100 bytes | 98% |
| Discover all tools (50 tools) | ~25KB | ~100 bytes | 99.6% |
| Get descriptions (10 tools) | ~5KB | ~800 bytes | 84% |
| Get schema for 1 tool | ~5KB | ~1KB | 80% |
| **Total workflow** | **~10KB+** | **~2KB** | **80%** |

## Related Use Cases
- UC-DEV-001: Pull Assigned Stories (uses list_stories)
- UC-DEV-002: Implement Story (uses update_story, link_commit)
- UC-DEV-003: Link Commit to Story (uses link_commit tool)
- UC-PM-001: Create Project (uses bootstrap_project)
- UC-PM-003: Create Story (uses create_story)
- UC-ADMIN-001: Bootstrap AI Studio (uses bootstrap_project)

## Acceptance Criteria
- Agent can discover tool names with <200 bytes token usage
- Agent can get descriptions for category with <1KB token usage
- Agent can get full schema for specific tool with <1.5KB token usage
- search_tools supports all three detail levels correctly
- Search by category filters tools accurately
- Search by query (keyword) matches name, description, and tags
- Tool execution works identically to Sprint 3 implementation
- Error handling provides clear, actionable feedback
- Performance: search_tools responds in <100ms (p95)
- All 10+ tools from Sprint 3 are discoverable and executable
- Documentation clearly explains progressive disclosure workflow
- Logging captures tool discovery and execution for metrics

## Success Metrics
- **Token Efficiency:** 90%+ reduction in discovery operations
- **Agent Performance:** 30-50% faster workflow completion
- **Developer Satisfaction:** "Easier to find the right tool"
- **Error Rate:** <1% tool execution failures
- **Adoption:** 95%+ of tool calls use progressive disclosure

## Sprint 4.5 Implementation Notes
- Implemented as part of progressive disclosure architecture
- Replaces static tool loading with dynamic discovery
- Maintains backward compatibility with existing tool interfaces
- Sets foundation for code execution (Phase 3)
- Aligns with Anthropic's MCP best practices

---

**Version:** 1.0
**Created:** 2025-11-10 (Sprint 4.5)
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
**Priority:** High (Core infrastructure for all MCP operations)
