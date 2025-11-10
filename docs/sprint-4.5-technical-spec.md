# Sprint 4.5: MCP Progressive Disclosure Architecture

**Version:** 1.0
**Date:** 2025-11-10
**Status:** Ready for Implementation
**Duration:** 3 weeks
**Team:** Backend (2-3), DevOps (1)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Context](#background--context)
3. [Technical Objectives](#technical-objectives)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Specifications](#detailed-specifications)
6. [Implementation Tasks](#implementation-tasks)
7. [Testing Strategy](#testing-strategy)
8. [Migration Plan](#migration-plan)
9. [Success Criteria](#success-criteria)
10. [Risks & Mitigation](#risks--mitigation)

---

## 1. Executive Summary

### Problem Statement

Our current MCP server implementation loads all tool definitions upfront, sending ~5-10KB of schema data on every `list_tools` request. According to Anthropic's research on proficient MCP server design, this approach:

- **Wastes tokens**: At scale (50+ tools), this becomes 25KB+ per discovery
- **Slows agents**: Unnecessary context processing delays responses
- **Doesn't scale**: Linear growth in token costs with tool count
- **Misses 98.7% optimization**: Progressive disclosure can reduce tokens by up to 98.7%

### Solution Overview

Implement **file-based tool discovery** with **progressive disclosure pattern** as recommended by Anthropic's engineering team. This involves:

1. **Restructuring tools** into a filesystem-based hierarchy
2. **Implementing search_tools** with detail-level parameters
3. **Dynamic tool loading** on-demand instead of upfront
4. **Adding pagination & aggregation** to reduce result sizes
5. **Documenting patterns** in ADR and architecture docs

### Expected Outcomes

- ✅ **98% token reduction** on tool discovery (5KB → 100 bytes)
- ✅ **30-50% faster** agent response times
- ✅ **Scalable architecture** ready for 50+ tools in Phase 3-4
- ✅ **Better organization** for contributors
- ✅ **Anthropic best practices** fully implemented

### Timeline

**Week 1:** Pagination, aggregation, and architectural design
**Week 2:** File-based tool restructuring and search_tools implementation
**Week 3:** Testing, documentation, and migration

---

## 2. Background & Context

### Anthropic's Research Findings

From [Anthropic's Code Execution with MCP article](https://www.anthropic.com/engineering/code-execution-with-mcp):

> **Key Efficiency Principle**: Loading all tool definitions upfront and passing intermediate results through the context window slows down agents and increases costs. Agents should load only necessary tool definitions on-demand, reducing token usage by up to 98.7%.

#### Two Primary Token Consumption Problems:

1. **Tool definitions** create context window overload (hundreds/thousands of tools)
2. **Intermediate results** require re-processing through model context

#### Recommended Patterns:

- **File-based tool discovery**: Present MCP servers as code APIs using filesystem structure
- **Progressive disclosure**: Implement search with detail levels (names only, with descriptions, full schema)
- **Filter before context**: Transform and summarize data before returning to model
- **Code-based logic**: Replace sequential tool calls with code execution (Phase 3)
- **State management**: Persist intermediate results, save learned operations as skills

### Current Implementation Analysis

**Current State** (as of Sprint 3):

```typescript
// backend/src/mcp/server.ts:60-333
const TOOLS: Tool[] = [
  { name: 'bootstrap_project', description: '...', inputSchema: {...} },
  { name: 'create_project', description: '...', inputSchema: {...} },
  // ... 10 tools, ~5KB total
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }; // ❌ Returns ALL tools every time
});
```

**Issues:**
- ❌ All 10 tool definitions loaded upfront
- ❌ No progressive disclosure mechanism
- ❌ No file-based discovery
- ❌ List operations lack pagination
- ❌ No aggregation tools for large datasets

**What Works Well:**
- ✅ Clean separation of concerns (tools/, utils.ts, types.ts)
- ✅ Strong typing with TypeScript
- ✅ Proper error handling with custom error classes
- ✅ Good test coverage on existing tools

### Future Scaling Concerns

**Projected Growth:**
- Sprint 3 (Current): 10 tools (~5KB)
- Sprint 5-6 (Use Cases): +6 tools (~8KB)
- Sprint 7-8 (Metrics): +8 tools (~12KB)
- Sprint 9-10 (Testing): +10 tools (~17KB)
- Sprint 11-12 (Advanced): +15 tools (~25KB)

**Total by Production:** 49 tools, ~25KB per discovery request

At 1000 agent sessions/month with average 5 discovery requests:
- **Current approach**: 5,000 requests × 25KB = 125MB = ~$50/month in wasted tokens
- **Progressive disclosure**: 5,000 requests × 100 bytes = 500KB = ~$0.20/month
- **Savings**: $600/year + improved UX

---

## 3. Technical Objectives

### Primary Objectives

1. **Implement Progressive Disclosure**
   - Add `search_tools` MCP tool with detail-level parameters
   - Support filtering by category/domain
   - Return minimal data by default, full schema on-demand

2. **File-Based Tool Discovery**
   - Restructure tools into `backend/src/mcp/servers/` hierarchy
   - Each tool becomes a separate file
   - Dynamic loading instead of static TOOLS array

3. **Optimize Data Operations**
   - Add pagination to all list operations
   - Implement aggregation tools for summaries
   - Limit result sizes by default

4. **Update Architecture Documentation**
   - Create ADR for progressive disclosure adoption
   - Update architecture.md with MCP patterns
   - Document new structure for contributors

### Secondary Objectives

5. **Improve Developer Experience**
   - Clear file structure for finding tools
   - Type-safe tool registration
   - Better error messages

6. **Prepare for Code Execution** (Phase 3)
   - Design with future sandboxed execution in mind
   - Plan skills directory structure
   - Document state management patterns

---

## 4. Architecture Overview

### New Directory Structure

```
backend/src/mcp/
├── servers/                          # File-based tool hierarchy
│   ├── projects/                     # Project management domain
│   │   ├── bootstrap_project.ts      # Tool definition + handler
│   │   ├── create_project.ts
│   │   ├── list_projects.ts
│   │   ├── get_project.ts
│   │   └── index.ts                  # Domain exports
│   ├── epics/                        # Epic management domain
│   │   ├── create_epic.ts
│   │   ├── list_epics.ts
│   │   └── index.ts
│   ├── stories/                      # Story management domain
│   │   ├── create_story.ts
│   │   ├── list_stories.ts
│   │   ├── get_story.ts
│   │   ├── update_story.ts
│   │   └── index.ts
│   └── meta/                         # Meta tools (new)
│       ├── search_tools.ts           # Progressive disclosure
│       └── index.ts
├── tools/                            # Legacy (to be deprecated)
│   ├── project.tools.ts              # Will be migrated
│   ├── epic.tools.ts
│   └── story.tools.ts
├── core/                             # Core utilities (new)
│   ├── loader.ts                     # Dynamic tool loader
│   ├── registry.ts                   # Tool registration
│   └── discovery.ts                  # Filesystem discovery
├── server.ts                         # Main MCP server
├── types.ts                          # Type definitions
└── utils.ts                          # Utility functions
```

### Tool File Format

Each tool file exports:

```typescript
// backend/src/mcp/servers/projects/create_project.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { CreateProjectParams, ProjectResponse } from '../../types.js';

/**
 * Tool Definition
 * Loaded on-demand based on search_tools detail level
 */
export const tool: Tool = {
  name: 'create_project',
  description: 'Create a new project without default structure',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project name (must be unique)' },
      description: { type: 'string', description: 'Project description' },
      repositoryUrl: { type: 'string', description: 'Git repository URL' },
    },
    required: ['name'],
  },
};

/**
 * Tool Metadata
 * Used for search and categorization
 */
export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'create', 'management'],
  version: '1.0.0',
  since: 'sprint-3',
};

/**
 * Tool Handler
 * Loaded only when tool is executed
 */
export async function handler(
  prisma: PrismaClient,
  params: CreateProjectParams
): Promise<ProjectResponse> {
  // Implementation moved from tools/project.tools.ts
  // ... (existing implementation)
}
```

### Progressive Disclosure Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Discovery Workflow                                     │
└─────────────────────────────────────────────────────────────┘

Step 1: Discover tool names only (minimal tokens)
┌──────────────────────────────────────────────────────────┐
│ search_tools({ detail_level: 'names_only' })            │
│ → Returns: ['bootstrap_project', 'create_project', ...] │
│ → Tokens: ~100 bytes                                     │
└──────────────────────────────────────────────────────────┘

Step 2: Get descriptions for relevant category
┌──────────────────────────────────────────────────────────┐
│ search_tools({                                           │
│   category: 'projects',                                  │
│   detail_level: 'with_descriptions'                      │
│ })                                                        │
│ → Returns: [{ name, description }]                       │
│ → Tokens: ~500 bytes                                     │
└──────────────────────────────────────────────────────────┘

Step 3: Get full schema for execution
┌──────────────────────────────────────────────────────────┐
│ search_tools({                                           │
│   query: 'bootstrap_project',                            │
│   detail_level: 'full_schema'                            │
│ })                                                        │
│ → Returns: [{ name, description, inputSchema }]          │
│ → Tokens: ~800 bytes                                     │
└──────────────────────────────────────────────────────────┘

Step 4: Execute tool
┌──────────────────────────────────────────────────────────┐
│ bootstrap_project({ name: 'MyApp' })                     │
│ → Handler loaded dynamically                             │
│ → Executed with full context                             │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Specifications

### 5.1 Progressive Disclosure: search_tools

**New MCP Tool:** `search_tools`

#### Tool Definition

```typescript
{
  name: 'search_tools',
  description: 'Search and discover available MCP tools with progressive detail levels',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional keyword search (searches name, description, tags)',
      },
      category: {
        type: 'string',
        enum: ['projects', 'epics', 'stories', 'meta', 'all'],
        description: 'Filter by tool category',
      },
      detail_level: {
        type: 'string',
        enum: ['names_only', 'with_descriptions', 'full_schema'],
        default: 'names_only',
        description: 'Level of detail to return',
      },
    },
  },
}
```

#### Response Formats

**Level 1: names_only**
```json
{
  "tools": ["bootstrap_project", "create_project", "list_projects"],
  "total": 3,
  "detail_level": "names_only"
}
```

**Level 2: with_descriptions**
```json
{
  "tools": [
    {
      "name": "bootstrap_project",
      "description": "Bootstrap a new project with default structure",
      "category": "projects"
    },
    {
      "name": "create_project",
      "description": "Create a new project without default structure",
      "category": "projects"
    }
  ],
  "total": 2,
  "detail_level": "with_descriptions"
}
```

**Level 3: full_schema**
```json
{
  "tools": [
    {
      "name": "bootstrap_project",
      "description": "Bootstrap a new project with default structure",
      "category": "projects",
      "inputSchema": {
        "type": "object",
        "properties": { "...": "..." },
        "required": ["name"]
      },
      "metadata": {
        "version": "1.0.0",
        "since": "sprint-3",
        "tags": ["project", "bootstrap"]
      }
    }
  ],
  "total": 1,
  "detail_level": "full_schema"
}
```

#### Implementation

```typescript
// backend/src/mcp/servers/meta/search_tools.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from '../../core/registry.js';

export const tool: Tool = {
  name: 'search_tools',
  description: 'Search and discover available MCP tools with progressive detail levels',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      category: {
        type: 'string',
        enum: ['projects', 'epics', 'stories', 'meta', 'all'],
      },
      detail_level: {
        type: 'string',
        enum: ['names_only', 'with_descriptions', 'full_schema'],
        default: 'names_only',
      },
    },
  },
};

export async function handler(registry: ToolRegistry, params: any) {
  const { query, category = 'all', detail_level = 'names_only' } = params;

  // Discover tools from filesystem
  let tools = await registry.discoverTools(category);

  // Filter by query if provided
  if (query) {
    tools = tools.filter((t) =>
      t.name.includes(query) ||
      t.description?.includes(query) ||
      t.metadata?.tags?.some((tag) => tag.includes(query))
    );
  }

  // Return based on detail level
  switch (detail_level) {
    case 'names_only':
      return {
        tools: tools.map((t) => t.name),
        total: tools.length,
        detail_level: 'names_only',
      };

    case 'with_descriptions':
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          category: t.metadata?.category,
        })),
        total: tools.length,
        detail_level: 'with_descriptions',
      };

    case 'full_schema':
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          category: t.metadata?.category,
          inputSchema: t.inputSchema,
          metadata: t.metadata,
        })),
        total: tools.length,
        detail_level: 'full_schema',
      };

    default:
      throw new Error(`Invalid detail_level: ${detail_level}`);
  }
}
```

---

### 5.2 Dynamic Tool Loading

**Component:** `backend/src/mcp/core/loader.ts`

#### Purpose
Dynamically load tool definitions and handlers from filesystem instead of static imports.

#### Implementation

```typescript
// backend/src/mcp/core/loader.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs/promises';

export interface ToolModule {
  tool: Tool;
  handler: Function;
  metadata?: {
    category: string;
    domain: string;
    tags: string[];
    version: string;
    since: string;
  };
}

export class ToolLoader {
  private cache: Map<string, ToolModule> = new Map();
  private serversPath: string;

  constructor(serversPath: string) {
    this.serversPath = serversPath;
  }

  /**
   * Discover all tool files in the servers/ directory
   */
  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    const tools: ToolModule[] = [];
    const categoriesPath = this.serversPath;

    // Get category directories
    const categories =
      category === 'all'
        ? await fs.readdir(categoriesPath)
        : [category];

    for (const cat of categories) {
      const categoryPath = path.join(categoriesPath, cat);
      const stat = await fs.stat(categoryPath).catch(() => null);

      if (!stat?.isDirectory()) continue;

      // Get all .ts files except index.ts
      const files = await fs.readdir(categoryPath);
      const toolFiles = files.filter(
        (f) => f.endsWith('.ts') && f !== 'index.ts'
      );

      // Load each tool module
      for (const file of toolFiles) {
        const toolPath = path.join(categoryPath, file);
        const module = await this.loadToolModule(toolPath);
        if (module) {
          tools.push(module);
        }
      }
    }

    return tools;
  }

  /**
   * Load a single tool module from file path
   */
  async loadToolModule(filePath: string): Promise<ToolModule | null> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

      if (!module.tool || !module.handler) {
        console.warn(`Invalid tool module: ${filePath}`);
        return null;
      }

      const toolModule: ToolModule = {
        tool: module.tool,
        handler: module.handler,
        metadata: module.metadata,
      };

      // Cache for future use
      this.cache.set(filePath, toolModule);

      return toolModule;
    } catch (error) {
      console.error(`Failed to load tool module ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get a specific tool by name
   */
  async getToolByName(name: string): Promise<ToolModule | null> {
    const allTools = await this.discoverTools();
    return allTools.find((t) => t.tool.name === name) || null;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
```

---

### 5.3 Tool Registry

**Component:** `backend/src/mcp/core/registry.ts`

#### Purpose
Central registry for tool discovery, registration, and execution.

#### Implementation

```typescript
// backend/src/mcp/core/registry.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolLoader, ToolModule } from './loader.js';

export class ToolRegistry {
  private loader: ToolLoader;
  private prisma: PrismaClient;

  constructor(serversPath: string, prisma: PrismaClient) {
    this.loader = new ToolLoader(serversPath);
    this.prisma = prisma;
  }

  /**
   * Discover all available tools
   */
  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    return this.loader.discoverTools(category);
  }

  /**
   * Get tool definitions for ListToolsRequest
   * Now returns minimal set by default
   */
  async listTools(category?: string): Promise<Tool[]> {
    const modules = await this.loader.discoverTools(category || 'all');
    return modules.map((m) => m.tool);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, params: any): Promise<any> {
    const toolModule = await this.loader.getToolByName(name);

    if (!toolModule) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Execute handler with prisma client
    return toolModule.handler(this.prisma, params);
  }

  /**
   * Search tools with progressive disclosure
   */
  async searchTools(query: string, category: string, detailLevel: string): Promise<any> {
    let tools = await this.discoverTools(category);

    // Filter by query
    if (query) {
      const queryLower = query.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.tool.name.toLowerCase().includes(queryLower) ||
          t.tool.description?.toLowerCase().includes(queryLower) ||
          t.metadata?.tags?.some((tag) => tag.toLowerCase().includes(queryLower))
      );
    }

    // Return based on detail level
    switch (detailLevel) {
      case 'names_only':
        return {
          tools: tools.map((t) => t.tool.name),
          total: tools.length,
          detail_level: 'names_only',
        };

      case 'with_descriptions':
        return {
          tools: tools.map((t) => ({
            name: t.tool.name,
            description: t.tool.description,
            category: t.metadata?.category,
          })),
          total: tools.length,
          detail_level: 'with_descriptions',
        };

      case 'full_schema':
        return {
          tools: tools.map((t) => ({
            name: t.tool.name,
            description: t.tool.description,
            category: t.metadata?.category,
            inputSchema: t.tool.inputSchema,
            metadata: t.metadata,
          })),
          total: tools.length,
          detail_level: 'full_schema',
        };

      default:
        throw new Error(`Invalid detail_level: ${detailLevel}`);
    }
  }
}
```

---

### 5.4 Pagination for List Operations

**Affected Tools:**
- `list_projects`
- `list_epics`
- `list_stories`

#### Updated Type Definitions

```typescript
// backend/src/mcp/types.ts

export interface PaginationParams {
  page?: number; // Default: 1
  pageSize?: number; // Default: 20, Max: 100
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ListProjectsParams extends PaginationParams {
  status?: 'active' | 'archived';
}

export interface ListStoriesParams extends PaginationParams {
  projectId?: string;
  epicId?: string;
  status?: string;
  type?: string;
}
```

#### Example Implementation: list_stories

```typescript
// backend/src/mcp/servers/stories/list_stories.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ListStoriesParams, PaginatedResponse, StoryResponse } from '../../types.js';
import { formatStory, handlePrismaError } from '../../utils.js';

export const tool: Tool = {
  name: 'list_stories',
  description: 'List stories with optional filters and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Filter by project UUID' },
      epicId: { type: 'string', description: 'Filter by epic UUID' },
      status: { type: 'string', description: 'Filter by status' },
      type: { type: 'string', description: 'Filter by type' },
      page: { type: 'number', description: 'Page number (default: 1)', minimum: 1 },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'list', 'search'],
  version: '2.0.0',
  since: 'sprint-3',
  updated: 'sprint-4.5',
};

export async function handler(
  prisma: PrismaClient,
  params: ListStoriesParams
): Promise<PaginatedResponse<StoryResponse>> {
  try {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause
    const whereClause: any = {};
    if (params.projectId) whereClause.projectId = params.projectId;
    if (params.epicId) whereClause.epicId = params.epicId;
    if (params.status) whereClause.status = params.status;
    if (params.type) whereClause.type = params.type;

    // Get total count
    const total = await prisma.story.count({ where: whereClause });

    // Get paginated data
    const stories = await prisma.story.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: stories.map((s: any) => formatStory(s)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: any) {
    throw handlePrismaError(error, 'list_stories');
  }
}
```

---

### 5.5 Aggregation Tools

**New Tools for Data Summarization**

#### Tool: get_project_summary

```typescript
// backend/src/mcp/servers/projects/get_project_summary.ts

export const tool: Tool = {
  name: 'get_project_summary',
  description: 'Get aggregated statistics for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project UUID' },
    },
    required: ['projectId'],
  },
};

export async function handler(prisma: PrismaClient, params: { projectId: string }) {
  const [project, storiesByStatus, storiesByType, epicStats] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),

    // Stories by status
    prisma.story.groupBy({
      by: ['status'],
      where: { projectId: params.projectId },
      _count: true,
    }),

    // Stories by type
    prisma.story.groupBy({
      by: ['type'],
      where: { projectId: params.projectId },
      _count: true,
    }),

    // Epic statistics
    prisma.epic.findMany({
      where: { projectId: params.projectId },
      include: {
        _count: { select: { stories: true } },
      },
    }),
  ]);

  if (!project) {
    throw new NotFoundError('Project', params.projectId);
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
    },
    statistics: {
      storiesByStatus: Object.fromEntries(
        storiesByStatus.map((s) => [s.status, s._count])
      ),
      storiesByType: Object.fromEntries(
        storiesByType.map((t) => [t.type, t._count])
      ),
      totalEpics: epicStats.length,
      epicsWithStories: epicStats.filter((e) => e._count.stories > 0).length,
      totalStories: storiesByStatus.reduce((sum, s) => sum + s._count, 0),
    },
  };
}
```

#### Tool: get_story_summary

```typescript
// backend/src/mcp/servers/stories/get_story_summary.ts

export const tool: Tool = {
  name: 'get_story_summary',
  description: 'Get aggregated story statistics with grouping',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project UUID' },
      groupBy: {
        type: 'string',
        enum: ['status', 'type', 'epic', 'complexity'],
        description: 'Group stories by field',
      },
    },
    required: ['projectId', 'groupBy'],
  },
};

export async function handler(
  prisma: PrismaClient,
  params: { projectId: string; groupBy: string }
) {
  const { projectId, groupBy } = params;

  switch (groupBy) {
    case 'status':
      const byStatus = await prisma.story.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
        _avg: { technicalComplexity: true },
      });
      return {
        groupBy: 'status',
        summary: byStatus.map((s) => ({
          status: s.status,
          count: s._count,
          avgComplexity: s._avg.technicalComplexity,
        })),
      };

    case 'type':
      const byType = await prisma.story.groupBy({
        by: ['type'],
        where: { projectId },
        _count: true,
      });
      return {
        groupBy: 'type',
        summary: byType.map((t) => ({
          type: t.type,
          count: t._count,
        })),
      };

    case 'epic':
      const byEpic = await prisma.story.groupBy({
        by: ['epicId'],
        where: { projectId },
        _count: true,
      });
      // Enrich with epic titles
      const epicIds = byEpic.map((e) => e.epicId).filter(Boolean);
      const epics = await prisma.epic.findMany({
        where: { id: { in: epicIds } },
        select: { id: true, key: true, title: true },
      });
      const epicMap = new Map(epics.map((e) => [e.id, e]));

      return {
        groupBy: 'epic',
        summary: byEpic.map((e) => ({
          epicId: e.epicId,
          epic: e.epicId ? epicMap.get(e.epicId) : null,
          count: e._count,
        })),
      };

    case 'complexity':
      const byComplexity = await prisma.story.groupBy({
        by: ['technicalComplexity'],
        where: { projectId },
        _count: true,
      });
      return {
        groupBy: 'complexity',
        summary: byComplexity
          .filter((c) => c.technicalComplexity !== null)
          .map((c) => ({
            complexity: c.technicalComplexity,
            count: c._count,
          }))
          .sort((a, b) => (a.complexity || 0) - (b.complexity || 0)),
      };

    default:
      throw new Error(`Invalid groupBy: ${groupBy}`);
  }
}
```

---

### 5.6 Updated Server Implementation

**Component:** `backend/src/mcp/server.ts` (refactored)

```typescript
#!/usr/bin/env node

/**
 * AI Studio MCP Server (Sprint 4.5)
 *
 * Implements progressive disclosure pattern with file-based tool discovery.
 * See: docs/sprint-4.5-technical-spec.md
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolRegistry } from './core/registry.js';
import { formatError } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Tool Registry
const serversPath = path.join(__dirname, 'servers');
const registry = new ToolRegistry(serversPath, prisma);

// Initialize MCP server
const server = new Server(
  {
    name: 'aistudio-mcp-server',
    version: '0.2.0', // Sprint 4.5
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * List available tools
 *
 * Note: For progressive disclosure, agents should use search_tools instead.
 * This handler now returns a minimal set by default.
 */
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  try {
    // Return only meta tools by default to encourage progressive disclosure
    const tools = await registry.listTools('meta');

    console.error(`📋 Listing ${tools.length} meta tools (use search_tools for all)`);

    return { tools };
  } catch (error: any) {
    console.error('Error listing tools:', error);
    throw error;
  }
});

/**
 * Call a tool
 *
 * Tools are loaded dynamically from the filesystem.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    console.error(`🔧 Executing tool: ${name}`);

    // Execute tool via registry
    const result = await registry.executeTool(name, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const formattedError = formatError(error);
    console.error(`Error executing tool ${name}:`, formattedError);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedError, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function main() {
  // Connect to database
  await prisma.$connect();
  console.error('✅ Connected to database');

  // Discover available tools
  const allTools = await registry.discoverTools();
  console.error(`✅ Discovered ${allTools.length} tools from filesystem`);

  // Log categories
  const categories = new Set(allTools.map((t) => t.metadata?.category).filter(Boolean));
  console.error(`📂 Categories: ${Array.from(categories).join(', ')}`);

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ AI Studio MCP Server started (Sprint 4.5)');
  console.error('💡 Use search_tools for progressive discovery');
  console.error('Listening for MCP requests...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down MCP server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\n🛑 Shutting down MCP server...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
main().catch((error) => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});
```

---

## 6. Implementation Tasks

### Week 1: Foundation & Aggregation

#### Task 1.1: Add Pagination Support
**Owner:** Backend Dev 1
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] Update types.ts with PaginationParams and PaginatedResponse
- [ ] Refactor list_projects to support pagination
- [ ] Refactor list_epics to support pagination
- [ ] Refactor list_stories to support pagination
- [ ] All list operations default to page=1, pageSize=20, max=100
- [ ] Response includes pagination metadata
- [ ] Unit tests pass with pagination

**Files to Modify:**
- `backend/src/mcp/types.ts`
- `backend/src/mcp/tools/project.tools.ts`
- `backend/src/mcp/tools/epic.tools.ts`
- `backend/src/mcp/tools/story.tools.ts`
- `backend/src/mcp/tools/*.spec.ts`

#### Task 1.2: Create Aggregation Tools
**Owner:** Backend Dev 2
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] Implement get_project_summary tool
- [ ] Implement get_story_summary tool with groupBy parameter
- [ ] Add to tools/project.tools.ts and tools/story.tools.ts (temporary)
- [ ] Write unit tests for aggregation logic
- [ ] Document tool usage with examples

**Files to Create/Modify:**
- `backend/src/mcp/tools/project.tools.ts` (add get_project_summary)
- `backend/src/mcp/tools/story.tools.ts` (add get_story_summary)
- `backend/src/mcp/tools/*.spec.ts`

#### Task 1.3: Design File-Based Architecture
**Owner:** Backend Dev 1 + DevOps
**Duration:** 1 day
**Acceptance Criteria:**
- [ ] Create detailed directory structure specification
- [ ] Define tool file format standard
- [ ] Design metadata schema
- [ ] Plan migration strategy from tools/ to servers/
- [ ] Document in sprint-4.5-technical-spec.md (this file)

### Week 2: File-Based Tool Discovery

#### Task 2.1: Create Core Infrastructure
**Owner:** Backend Dev 1
**Duration:** 3 days
**Acceptance Criteria:**
- [ ] Implement ToolLoader class in core/loader.ts
- [ ] Implement ToolRegistry class in core/registry.ts
- [ ] Add filesystem discovery with caching
- [ ] Add dynamic tool loading
- [ ] Write comprehensive unit tests for loader and registry
- [ ] Test with mock tool files

**Files to Create:**
- `backend/src/mcp/core/loader.ts`
- `backend/src/mcp/core/registry.ts`
- `backend/src/mcp/core/discovery.ts`
- `backend/src/mcp/core/*.spec.ts`

#### Task 2.2: Migrate Tools to servers/ Structure
**Owner:** Backend Dev 2
**Duration:** 3 days
**Acceptance Criteria:**
- [ ] Create servers/ directory structure
- [ ] Migrate bootstrap_project to servers/projects/
- [ ] Migrate create_project to servers/projects/
- [ ] Migrate list_projects to servers/projects/
- [ ] Migrate get_project to servers/projects/
- [ ] Migrate all epic tools to servers/epics/
- [ ] Migrate all story tools to servers/stories/
- [ ] Add metadata to each tool file
- [ ] Update imports and exports
- [ ] All existing tests still pass

**Files to Create:**
- `backend/src/mcp/servers/projects/*.ts` (4 files)
- `backend/src/mcp/servers/epics/*.ts` (2 files)
- `backend/src/mcp/servers/stories/*.ts` (4 files)
- `backend/src/mcp/servers/*/index.ts`

#### Task 2.3: Implement search_tools
**Owner:** Backend Dev 1
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] Create servers/meta/ directory
- [ ] Implement search_tools tool with all detail levels
- [ ] Support query filtering
- [ ] Support category filtering
- [ ] Integration tests for all detail levels
- [ ] Performance test with 50+ mock tools

**Files to Create:**
- `backend/src/mcp/servers/meta/search_tools.ts`
- `backend/src/mcp/servers/meta/index.ts`
- `backend/src/mcp/servers/meta/search_tools.spec.ts`

### Week 3: Integration & Documentation

#### Task 3.1: Refactor server.ts
**Owner:** Backend Dev 1
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] Replace static TOOLS array with ToolRegistry
- [ ] Update ListToolsRequestSchema handler to return meta tools only
- [ ] Update CallToolRequestSchema handler to use registry.executeTool()
- [ ] Add startup logging for discovered tools
- [ ] All existing MCP tools work with new architecture
- [ ] No breaking changes to tool interfaces

**Files to Modify:**
- `backend/src/mcp/server.ts`

#### Task 3.2: Testing & Validation
**Owner:** Backend Dev 2 + QA
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] Manual testing with Claude Code CLI
- [ ] Performance benchmarks meet targets:
  - search_tools (names_only): < 50ms
  - search_tools (with_descriptions): < 100ms
  - search_tools (full_schema): < 200ms
- [ ] Token usage measured and documented

**Test Scenarios:**
1. Progressive discovery workflow
2. Tool execution with new architecture
3. Pagination on all list operations
4. Aggregation tools with large datasets
5. Error handling and edge cases

#### Task 3.3: Documentation Updates
**Owner:** DevOps + Backend Dev 2
**Duration:** 2 days
**Acceptance Criteria:**
- [ ] Create ADR-001-progressive-disclosure.md
- [ ] Update architecture.md with MCP patterns section
- [ ] Update backend/src/mcp/README.md
- [ ] Create MIGRATION.md guide for future tool authors
- [ ] Update use-cases with new tools (UC-DEV-001, etc.)
- [ ] Add examples to sprint-4.5-technical-spec.md

**Files to Create/Modify:**
- `docs/adr/001-progressive-disclosure.md`
- `architecture.md`
- `backend/src/mcp/README.md`
- `docs/MIGRATION.md`
- `use-cases/developer/*.md`

#### Task 3.4: Update plan.md
**Owner:** DevOps
**Duration:** 0.5 days
**Acceptance Criteria:**
- [ ] Insert Sprint 4.5 between Sprint 4 and 5
- [ ] Update sprint count to 12.5 (or renumber sprints 5-12 to 6-13)
- [ ] Update dependencies and critical path
- [ ] Update milestones with Sprint 4.5
- [ ] Document completion status

**Files to Modify:**
- `plan.md`

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Scope:** All core components and tool implementations

#### Core Infrastructure Tests

```typescript
// backend/src/mcp/core/loader.spec.ts

describe('ToolLoader', () => {
  let loader: ToolLoader;

  beforeEach(() => {
    loader = new ToolLoader('/path/to/servers');
  });

  describe('discoverTools', () => {
    it('should discover all tools in all categories', async () => {
      const tools = await loader.discoverTools('all');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: expect.objectContaining({ name: 'bootstrap_project' }),
            handler: expect.any(Function),
            metadata: expect.objectContaining({ category: 'projects' }),
          }),
        ])
      );
    });

    it('should filter by category', async () => {
      const tools = await loader.discoverTools('projects');
      tools.forEach((t) => {
        expect(t.metadata?.category).toBe('projects');
      });
    });

    it('should cache loaded modules', async () => {
      const tools1 = await loader.discoverTools();
      const tools2 = await loader.discoverTools();
      expect(tools1).toBe(tools2); // Same references
    });
  });

  describe('loadToolModule', () => {
    it('should load valid tool module', async () => {
      const module = await loader.loadToolModule('/path/to/tool.ts');
      expect(module).toHaveProperty('tool');
      expect(module).toHaveProperty('handler');
      expect(module?.handler).toBeInstanceOf(Function);
    });

    it('should return null for invalid module', async () => {
      const module = await loader.loadToolModule('/invalid/path.ts');
      expect(module).toBeNull();
    });
  });
});
```

#### Registry Tests

```typescript
// backend/src/mcp/core/registry.spec.ts

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    registry = new ToolRegistry('/path/to/servers', prisma);
  });

  describe('searchTools', () => {
    it('should return names only', async () => {
      const result = await registry.searchTools('', 'all', 'names_only');
      expect(result).toEqual({
        tools: expect.arrayContaining([expect.any(String)]),
        total: expect.any(Number),
        detail_level: 'names_only',
      });
    });

    it('should return with descriptions', async () => {
      const result = await registry.searchTools('', 'all', 'with_descriptions');
      expect(result.tools[0]).toHaveProperty('name');
      expect(result.tools[0]).toHaveProperty('description');
      expect(result.tools[0]).toHaveProperty('category');
    });

    it('should filter by query', async () => {
      const result = await registry.searchTools('project', 'all', 'names_only');
      result.tools.forEach((name: string) => {
        expect(name.toLowerCase()).toContain('project');
      });
    });

    it('should filter by category', async () => {
      const result = await registry.searchTools('', 'projects', 'with_descriptions');
      result.tools.forEach((tool: any) => {
        expect(tool.category).toBe('projects');
      });
    });
  });

  describe('executeTool', () => {
    it('should execute tool successfully', async () => {
      const result = await registry.executeTool('list_projects', {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
    });

    it('should throw error for unknown tool', async () => {
      await expect(registry.executeTool('unknown_tool', {})).rejects.toThrow(
        'Tool not found: unknown_tool'
      );
    });
  });
});
```

#### Pagination Tests

```typescript
// backend/src/mcp/servers/stories/list_stories.spec.ts

describe('list_stories with pagination', () => {
  it('should return first page by default', async () => {
    const result = await handler(prisma, { projectId: 'test-project' });
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
  });

  it('should respect page parameter', async () => {
    const result = await handler(prisma, {
      projectId: 'test-project',
      page: 2,
      pageSize: 10,
    });
    expect(result.pagination.page).toBe(2);
    expect(result.data.length).toBeLessThanOrEqual(10);
  });

  it('should cap pageSize at 100', async () => {
    const result = await handler(prisma, {
      projectId: 'test-project',
      pageSize: 500,
    });
    expect(result.pagination.pageSize).toBe(100);
  });

  it('should calculate pagination metadata correctly', async () => {
    const result = await handler(prisma, {
      projectId: 'test-project',
      pageSize: 5,
    });
    expect(result.pagination.totalPages).toBe(
      Math.ceil(result.pagination.total / 5)
    );
    expect(result.pagination.hasNext).toBe(result.pagination.page < result.pagination.totalPages);
    expect(result.pagination.hasPrev).toBe(result.pagination.page > 1);
  });
});
```

### 7.2 Integration Tests

**Scope:** End-to-end tool execution via MCP server

```typescript
// backend/test/integration/mcp-progressive-disclosure.spec.ts

describe('MCP Progressive Disclosure Integration', () => {
  let client: MCPClient; // Mock MCP client

  beforeAll(async () => {
    // Start MCP server
    // Initialize client
  });

  it('should support progressive discovery workflow', async () => {
    // Step 1: Discover tool names
    const namesResponse = await client.callTool('search_tools', {
      detail_level: 'names_only',
    });
    expect(namesResponse.tools).toContain('bootstrap_project');
    expect(JSON.stringify(namesResponse).length).toBeLessThan(500); // < 500 bytes

    // Step 2: Get descriptions for projects category
    const descriptionsResponse = await client.callTool('search_tools', {
      category: 'projects',
      detail_level: 'with_descriptions',
    });
    expect(descriptionsResponse.tools[0]).toHaveProperty('description');
    expect(JSON.stringify(descriptionsResponse).length).toBeLessThan(2000); // < 2KB

    // Step 3: Get full schema for specific tool
    const schemaResponse = await client.callTool('search_tools', {
      query: 'bootstrap_project',
      detail_level: 'full_schema',
    });
    expect(schemaResponse.tools[0]).toHaveProperty('inputSchema');

    // Step 4: Execute tool
    const executeResponse = await client.callTool('bootstrap_project', {
      name: 'TestProject',
    });
    expect(executeResponse).toHaveProperty('project');
  });

  it('should handle pagination correctly', async () => {
    // Create 50 stories
    for (let i = 0; i < 50; i++) {
      await client.callTool('create_story', {
        projectId: 'test-project',
        title: `Story ${i}`,
      });
    }

    // Get first page
    const page1 = await client.callTool('list_stories', {
      projectId: 'test-project',
      pageSize: 20,
    });
    expect(page1.data.length).toBe(20);
    expect(page1.pagination.hasNext).toBe(true);

    // Get second page
    const page2 = await client.callTool('list_stories', {
      projectId: 'test-project',
      page: 2,
      pageSize: 20,
    });
    expect(page2.data.length).toBe(20);
    expect(page2.pagination.page).toBe(2);
  });
});
```

### 7.3 Performance Tests

**Scope:** Token usage and response time benchmarks

```typescript
// backend/test/performance/mcp-token-usage.spec.ts

describe('MCP Token Usage Performance', () => {
  it('should reduce token usage with progressive disclosure', async () => {
    // Baseline: Old approach (hypothetical)
    const oldApproachSize = 5000; // ~5KB for all tools

    // New approach: names_only
    const namesResponse = await client.callTool('search_tools', {
      detail_level: 'names_only',
    });
    const namesSize = JSON.stringify(namesResponse).length;
    expect(namesSize).toBeLessThan(500); // < 500 bytes

    const reduction = ((oldApproachSize - namesSize) / oldApproachSize) * 100;
    expect(reduction).toBeGreaterThan(90); // > 90% reduction
  });

  it('should meet response time SLAs', async () => {
    const start = Date.now();
    await client.callTool('search_tools', { detail_level: 'names_only' });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50); // < 50ms
  });
});
```

### 7.4 Test Coverage Goals

| Component | Coverage Target |
|-----------|----------------|
| Core (loader, registry) | > 90% |
| Tool implementations | > 85% |
| Utils | > 80% |
| Server | > 75% |
| Overall | > 80% |

---

## 8. Migration Plan

### 8.1 Backward Compatibility

**Strategy:** Maintain both old and new structures during Sprint 4.5

#### Phase 1: Dual Support (Week 1-2)
- Keep existing `tools/` directory
- Add new `servers/` directory in parallel
- Tools work from both locations
- Deprecation warnings in logs

#### Phase 2: Migration (Week 3)
- Primary: `servers/` directory
- Fallback: `tools/` directory (with warnings)
- Update all documentation to use new structure

#### Phase 3: Cleanup (Sprint 5)
- Remove `tools/` directory
- Remove fallback code
- Update all imports

### 8.2 Tool Author Migration Guide

**For Future Contributors:**

#### Old Pattern (Sprint 3):
```typescript
// backend/src/mcp/tools/project.tools.ts

export async function bootstrapProject(prisma, params) {
  // Implementation
}

// Add to server.ts TOOLS array manually
```

#### New Pattern (Sprint 4.5+):
```typescript
// backend/src/mcp/servers/projects/bootstrap_project.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'bootstrap_project',
  description: '...',
  inputSchema: { /* ... */ },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'bootstrap'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(prisma, params) {
  // Implementation
}

// ✅ Auto-discovered, no manual registration needed
```

### 8.3 Breaking Changes

**None.** All existing MCP tool interfaces remain unchanged. Tools can be called with the same parameters and return the same responses.

#### Changes that ARE NOT Breaking:
- ✅ Internal file organization
- ✅ Adding pagination to list operations (optional parameters)
- ✅ Adding new tools (search_tools, aggregations)
- ✅ Response format enhancements (pagination metadata)

#### Changes to Watch:
- ⚠️ `ListToolsRequest` now returns only meta tools by default
  - **Mitigation:** Agents should use `search_tools` instead
  - **Fallback:** Can still get all tools via `search_tools({ category: 'all', detail_level: 'full_schema' })`

---

## 9. Success Criteria

### 9.1 Functional Requirements

- [ ] **Progressive Disclosure Works**
  - search_tools returns correct results for all detail levels
  - Agents can discover tools incrementally
  - Full schema available on-demand

- [ ] **File-Based Discovery Works**
  - All tools auto-discovered from servers/ directory
  - Tools load dynamically
  - Caching prevents redundant loads

- [ ] **Pagination Works**
  - All list operations support pagination
  - Default and max limits enforced
  - Pagination metadata accurate

- [ ] **Aggregation Tools Work**
  - get_project_summary returns accurate stats
  - get_story_summary supports all groupBy modes
  - Large datasets summarized efficiently

- [ ] **Backward Compatibility**
  - All existing tools work unchanged
  - Tool interfaces stable
  - Claude Code integration unaffected

### 9.2 Non-Functional Requirements

#### Performance
- [ ] search_tools (names_only): < 50ms (p95)
- [ ] search_tools (with_descriptions): < 100ms (p95)
- [ ] search_tools (full_schema): < 200ms (p95)
- [ ] Tool execution: no regression from Sprint 3 baseline

#### Token Usage
- [ ] names_only: < 500 bytes
- [ ] with_descriptions: < 2KB
- [ ] full_schema for single tool: < 1KB
- [ ] Overall reduction: > 90% for discovery operations

#### Code Quality
- [ ] Test coverage > 80%
- [ ] No linting errors
- [ ] All TypeScript types defined
- [ ] Documentation complete

### 9.3 Acceptance Criteria

#### End-to-End Test Scenario

**Scenario:** Developer uses Claude Code to discover and use MCP tools

1. **Discovery:**
   ```
   Developer: "What tools are available?"
   Agent: Calls search_tools({ detail_level: 'names_only' })
   Response: ["search_tools", "bootstrap_project", "create_project", ...]
   Token usage: ~100 bytes
   ```

2. **Exploration:**
   ```
   Developer: "Tell me about project management tools"
   Agent: Calls search_tools({ category: 'projects', detail_level: 'with_descriptions' })
   Response: [{ name: "bootstrap_project", description: "...", category: "projects" }, ...]
   Token usage: ~500 bytes
   ```

3. **Execution:**
   ```
   Developer: "Bootstrap a new project called MyApp"
   Agent: Calls search_tools({ query: 'bootstrap_project', detail_level: 'full_schema' })
   Agent: Calls bootstrap_project({ name: 'MyApp' })
   Response: { project: {...}, defaultEpic: {...}, message: "..." }
   ```

4. **Verification:**
   - [ ] All steps complete successfully
   - [ ] Total token usage < 2KB (vs. 5KB+ in old approach)
   - [ ] Response times under SLA
   - [ ] Agent found and used correct tool

---

## 10. Risks & Mitigation

### Risk 1: Dynamic Loading Performance

**Risk:** Dynamic tool loading could be slower than static imports
**Probability:** Medium
**Impact:** Medium

**Mitigation:**
- Implement aggressive caching in ToolLoader
- Pre-load common tools at startup
- Benchmark against Sprint 3 baseline
- Monitor metrics in production

**Contingency:**
- If >20% slower, revert to static imports with progressive disclosure abstraction

---

### Risk 2: File System Complexity

**Risk:** File-based discovery adds complexity for new contributors
**Probability:** Low
**Impact:** Medium

**Mitigation:**
- Comprehensive MIGRATION.md guide
- Clear examples in documentation
- Template files for new tools
- Automated tool scaffolding script (future)

**Contingency:**
- Provide both patterns in docs for 1-2 sprints

---

### Risk 3: Breaking Changes

**Risk:** Refactoring could break existing integrations
**Probability:** Low
**Impact:** High

**Mitigation:**
- Maintain dual support during migration
- Comprehensive integration tests
- Manual testing with Claude Code
- Beta testing with users before full rollout

**Contingency:**
- Rollback plan: Keep tools/ directory as fallback
- Feature flag to switch between old/new implementations

---

### Risk 4: Incomplete Migration

**Risk:** Some tools not migrated to new structure
**Probability:** Low
**Impact:** Medium

**Mitigation:**
- Checklist of all tools to migrate (10 tools in Sprint 3)
- Automated discovery to verify all tools present
- Cross-team code review
- QA validation

**Contingency:**
- Fallback loader checks both tools/ and servers/

---

### Risk 5: Documentation Drift

**Risk:** Documentation not updated for new patterns
**Probability:** Medium
**Impact:** Medium

**Mitigation:**
- Documentation updates as acceptance criteria
- ADR captures decision rationale
- Examples in all docs updated
- Link to sprint-4.5-technical-spec.md from README

**Contingency:**
- Documentation sprint in week 4 if needed

---

## Conclusion

Sprint 4.5 positions AI Studio MCP server to scale efficiently by implementing Anthropic's progressive disclosure best practices. By restructuring tools into a file-based hierarchy and adding intelligent discovery mechanisms, we achieve:

- **98% token reduction** on tool discovery operations
- **30-50% faster** agent response times
- **Production-ready architecture** for 50+ tools
- **Better developer experience** with clear structure
- **Future-proof foundation** for code execution (Phase 3)

### Next Steps

1. **Week 1:** Implement pagination and aggregation tools
2. **Week 2:** Build file-based infrastructure and migrate tools
3. **Week 3:** Test, document, and deploy to production
4. **Sprint 5:** Continue with Use Case Library (original Sprint 5 plan)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Next Review:** End of Sprint 4.5 (2025-12-01)
**Owner:** Backend Team + DevOps
