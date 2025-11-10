# Migration Guide: File-Based Tool Discovery (Sprint 4.5)

**Version:** 1.0
**Effective:** Sprint 4.5 onwards
**Audience:** Backend developers, Contributors, Tool authors

---

## Overview

As of Sprint 4.5, the AI Studio MCP server has adopted a file-based tool discovery architecture with progressive disclosure. This guide helps developers understand how to create, organize, and maintain MCP tools in the new structure.

**Key Changes:**
- ✅ Tools moved from monolithic files (`tools/project.tools.ts`) to individual files (`servers/projects/create_project.ts`)
- ✅ Automatic discovery via filesystem scanning (no manual registration)
- ✅ Standardized tool file format with metadata
- ✅ Progressive disclosure support built-in

---

## Quick Start

### Creating a New Tool

**1. Choose the appropriate category:**
- `servers/projects/` - Project management
- `servers/epics/` - Epic management
- `servers/stories/` - Story management
- `servers/meta/` - Meta tools (search, discovery)
- `servers/{new_domain}/` - Create new category if needed

**2. Create tool file:**

```bash
# Example: Creating a new story tool
touch backend/src/mcp/servers/stories/assign_story.ts
```

**3. Implement tool using standard format:**

```typescript
// backend/src/mcp/servers/stories/assign_story.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired, handlePrismaError } from '../../utils.js';

/**
 * Tool Definition
 * This will be returned by search_tools based on detail level
 */
export const tool: Tool = {
  name: 'assign_story',
  description: 'Assign a story to a framework for implementation',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to assign',
      },
      frameworkId: {
        type: 'string',
        description: 'Framework UUID to assign to',
      },
    },
    required: ['storyId', 'frameworkId'],
  },
};

/**
 * Tool Metadata
 * Used for categorization, search, and versioning
 */
export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'assign', 'framework'],
  version: '1.0.0',
  since: 'sprint-5',
  // updated: 'sprint-6' // Add when making changes
};

/**
 * Tool Handler
 * Executes when tool is called
 */
export async function handler(
  prisma: PrismaClient,
  params: { storyId: string; frameworkId: string }
) {
  try {
    validateRequired(params, ['storyId', 'frameworkId']);

    // Verify story exists
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Verify framework exists
    const framework = await prisma.agentFramework.findUnique({
      where: { id: params.frameworkId },
    });

    if (!framework) {
      throw new NotFoundError('Framework', params.frameworkId);
    }

    // Update story
    const updated = await prisma.story.update({
      where: { id: params.storyId },
      data: { assignedFrameworkId: params.frameworkId },
    });

    return {
      success: true,
      story: {
        id: updated.id,
        key: updated.key,
        title: updated.title,
        assignedFrameworkId: updated.assignedFrameworkId,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'assign_story');
  }
}
```

**4. Export from category index:**

```typescript
// backend/src/mcp/servers/stories/index.ts

export * from './create_story.js';
export * from './list_stories.js';
export * from './get_story.js';
export * from './update_story.js';
export * from './assign_story.js'; // Add new tool
```

**5. Test the tool:**

```bash
# Run unit tests
npm test backend/src/mcp/servers/stories/assign_story

# Start MCP server
npm run mcp:dev

# Test discovery
# Use Claude Code or MCP client:
# search_tools({ query: 'assign', detail_level: 'full_schema' })

# Test execution
# assign_story({ storyId: 'uuid', frameworkId: 'uuid' })
```

**6. Done!** Tool is automatically discovered and available.

---

## Tool File Format Reference

### Minimum Required Exports

```typescript
export const tool: Tool = { /* ... */ };
export const metadata = { /* ... */ };
export async function handler(prisma, params) { /* ... */ }
```

### Tool Definition Schema

```typescript
export const tool: Tool = {
  name: string;              // Unique tool name (snake_case)
  description: string;       // Clear, concise description (1-2 sentences)
  inputSchema: JSONSchema;   // JSON Schema for parameters
};
```

**Best Practices:**
- ✅ Use `snake_case` for tool names (e.g., `create_project`, not `createProject`)
- ✅ Description should explain what the tool does, not how
- ✅ Include all parameters in `inputSchema` with descriptions
- ✅ Mark required fields in `required` array
- ❌ Don't include implementation details in description

### Metadata Schema

```typescript
export const metadata = {
  category: string;          // Domain folder name
  domain: string;            // Business domain
  tags: string[];            // Search keywords
  version: string;           // Semantic version (x.y.z)
  since: string;             // Sprint when introduced
  updated?: string;          // Sprint of last update (optional)
  deprecated?: boolean;      // If tool is deprecated (optional)
  replacedBy?: string;       // New tool name if replaced (optional)
};
```

**Best Practices:**
- ✅ Use meaningful tags for searchability
- ✅ Follow semantic versioning (1.0.0 → 1.1.0 for features, 2.0.0 for breaking changes)
- ✅ Update `version` and `updated` when making changes
- ✅ Mark deprecated tools and provide migration path

### Handler Function Signature

```typescript
export async function handler(
  prisma: PrismaClient,
  params: InputParams
): Promise<OutputType> {
  // Implementation
}
```

**Best Practices:**
- ✅ Always validate required parameters first
- ✅ Use TypeScript types for `params` and return value
- ✅ Handle errors with try/catch
- ✅ Re-throw `MCPError` instances as-is
- ✅ Wrap other errors with `handlePrismaError`
- ✅ Keep handler focused on business logic (use utils for common operations)

---

## Migration Checklist

### Migrating an Existing Tool

If you have a tool in the old structure (`tools/project.tools.ts`), follow these steps:

**Step 1: Create new file structure**

```bash
# Old: backend/src/mcp/tools/project.tools.ts
# New: backend/src/mcp/servers/projects/tool_name.ts

# Create individual files
mkdir -p backend/src/mcp/servers/projects
touch backend/src/mcp/servers/projects/create_project.ts
```

**Step 2: Extract tool definition**

Old format:
```typescript
// tools/project.tools.ts
export async function createProject(prisma, params) {
  // Implementation
}

// Manually registered in server.ts
const TOOLS = [
  {
    name: 'create_project',
    description: '...',
    inputSchema: {...}
  }
];
```

New format:
```typescript
// servers/projects/create_project.ts
export const tool: Tool = {
  name: 'create_project',
  description: '...',
  inputSchema: {...}
};

export const metadata = {
  category: 'projects',
  // ...
};

export async function handler(prisma, params) {
  // Same implementation as before
}
```

**Step 3: Add metadata**

```typescript
export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'create'],
  version: '1.0.0',
  since: 'sprint-3', // When originally created
};
```

**Step 4: Update imports**

No changes needed! The ToolRegistry automatically discovers tools.

**Step 5: Remove from old location**

After confirming the new tool works:
```bash
# Remove old implementation
# Keep tools/ directory until Sprint 5 for backward compatibility
# git rm backend/src/mcp/tools/project.tools.ts
```

**Step 6: Test thoroughly**

```bash
# Unit tests
npm test backend/src/mcp/servers/projects/create_project

# Integration tests
npm run test:integration -- --grep "create_project"

# Manual testing with Claude Code
```

---

## Progressive Disclosure Integration

Your tool automatically supports progressive disclosure through the `search_tools` meta tool.

### How Agents Discover Your Tool

**Level 1: Names Only**
```json
// Agent calls: search_tools({ detail_level: 'names_only' })
{
  "tools": ["assign_story", ...],
  "total": 13
}
// Your tool name appears in the list
```

**Level 2: With Descriptions**
```json
// Agent calls: search_tools({ category: 'stories', detail_level: 'with_descriptions' })
{
  "tools": [
    {
      "name": "assign_story",
      "description": "Assign a story to a framework for implementation",
      "category": "stories"
    }
  ]
}
```

**Level 3: Full Schema**
```json
// Agent calls: search_tools({ query: 'assign', detail_level: 'full_schema' })
{
  "tools": [
    {
      "name": "assign_story",
      "description": "...",
      "inputSchema": { /* full schema */ },
      "metadata": { /* full metadata */ }
    }
  ]
}
```

### Optimizing for Discovery

**Good metadata example:**
```typescript
export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: [
    'story',          // Primary entity
    'assign',         // Action
    'framework',      // Related entity
    'allocation',     // Synonym
    'distribute'      // Alternative term
  ],
  version: '1.0.0',
  since: 'sprint-5',
};
```

Agents can find this tool by searching:
- "assign story"
- "framework allocation"
- "distribute stories"
- Category: "stories"

---

## Testing Your Tool

### Unit Tests

```typescript
// backend/src/mcp/servers/stories/assign_story.spec.ts

import { PrismaClient } from '@prisma/client';
import { handler, tool, metadata } from './assign_story';
import { NotFoundError } from '../../types';

describe('assign_story tool', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('tool definition', () => {
    it('should have required exports', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('assign_story');
      expect(metadata).toBeDefined();
      expect(metadata.category).toBe('stories');
      expect(handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema', () => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('storyId');
      expect(tool.inputSchema.required).toContain('frameworkId');
    });
  });

  describe('handler', () => {
    it('should assign story to framework', async () => {
      const result = await handler(prisma, {
        storyId: 'test-story-uuid',
        frameworkId: 'test-framework-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.story.assignedFrameworkId).toBe('test-framework-uuid');
    });

    it('should throw NotFoundError for invalid story', async () => {
      await expect(
        handler(prisma, {
          storyId: 'invalid-uuid',
          frameworkId: 'test-framework-uuid',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
```

### Integration Tests

```typescript
// backend/test/integration/mcp-tools.spec.ts

describe('MCP Tool Discovery and Execution', () => {
  it('should discover assign_story tool', async () => {
    const result = await registry.searchTools('assign', 'stories', 'full_schema');

    expect(result.tools).toContainEqual(
      expect.objectContaining({
        name: 'assign_story',
        category: 'stories',
      })
    );
  });

  it('should execute assign_story tool', async () => {
    const result = await registry.executeTool('assign_story', {
      storyId: testStoryId,
      frameworkId: testFrameworkId,
    });

    expect(result.success).toBe(true);
  });
});
```

---

## Common Patterns

### Pagination Support

If your tool returns lists, add pagination:

```typescript
export const tool: Tool = {
  name: 'list_items',
  description: 'List items with pagination',
  inputSchema: {
    type: 'object',
    properties: {
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
        minimum: 1,
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
      },
      // ... other filters
    },
  },
};

export async function handler(prisma, params) {
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: buildWhereClause(params),
      skip,
      take: pageSize,
    }),
    prisma.item.count({ where: buildWhereClause(params) }),
  ]);

  return {
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page < Math.ceil(total / pageSize),
      hasPrev: page > 1,
    },
  };
}
```

### Aggregation Tools

For summary/statistics:

```typescript
export const tool: Tool = {
  name: 'get_item_summary',
  description: 'Get aggregated statistics for items',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      groupBy: {
        type: 'string',
        enum: ['status', 'type', 'complexity'],
      },
    },
    required: ['projectId', 'groupBy'],
  },
};

export async function handler(prisma, params) {
  const stats = await prisma.item.groupBy({
    by: [params.groupBy],
    where: { projectId: params.projectId },
    _count: true,
    _avg: { complexity: true },
  });

  return {
    groupBy: params.groupBy,
    summary: stats.map(s => ({
      [params.groupBy]: s[params.groupBy],
      count: s._count,
      avgComplexity: s._avg.complexity,
    })),
  };
}
```

---

## Troubleshooting

### Tool Not Discovered

**Symptom:** Tool doesn't appear in `search_tools` results

**Checklist:**
- [ ] File is in correct directory (`servers/{category}/{tool_name}.ts`)
- [ ] File exports `tool`, `metadata`, and `handler`
- [ ] File doesn't have syntax errors (check `npm run typecheck`)
- [ ] MCP server restarted after adding file
- [ ] Tool name matches filename (e.g., `assign_story.ts` → `tool.name = 'assign_story'`)

**Debug:**
```bash
# Check if file is being discovered
npm run mcp:dev

# Look for: "✅ Discovered N tools from filesystem"
# Check logs for any errors during discovery
```

### Tool Execution Fails

**Symptom:** `search_tools` finds tool, but execution throws error

**Checklist:**
- [ ] Handler function signature correct: `async function handler(prisma, params)`
- [ ] All required parameters validated
- [ ] Prisma models exist and are accessible
- [ ] Error handling uses `handlePrismaError` utility
- [ ] Try/catch wraps handler logic

**Debug:**
```typescript
export async function handler(prisma, params) {
  console.error('Handler called with:', JSON.stringify(params));

  try {
    // ... implementation
  } catch (error) {
    console.error('Handler error:', error);
    throw handlePrismaError(error, 'assign_story');
  }
}
```

### Type Errors

**Symptom:** TypeScript compilation fails

**Common Issues:**
- Missing type imports
- Incorrect parameter types
- Return type mismatch

**Fix:**
```typescript
import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Define explicit types
interface AssignStoryParams {
  storyId: string;
  frameworkId: string;
}

interface AssignStoryResponse {
  success: boolean;
  story: {
    id: string;
    key: string;
    title: string;
    assignedFrameworkId: string | null;
  };
}

export async function handler(
  prisma: PrismaClient,
  params: AssignStoryParams
): Promise<AssignStoryResponse> {
  // ...
}
```

---

## Best Practices Summary

**DO:**
- ✅ Use standardized file format (tool + metadata + handler)
- ✅ Add comprehensive metadata for discoverability
- ✅ Validate all required parameters
- ✅ Handle errors consistently with utilities
- ✅ Write unit tests for every tool
- ✅ Document parameters in input schema
- ✅ Keep handlers focused on business logic
- ✅ Use pagination for list operations
- ✅ Use aggregation for large datasets

**DON'T:**
- ❌ Register tools manually in `server.ts`
- ❌ Put multiple tools in one file
- ❌ Skip metadata (required for discovery)
- ❌ Use inconsistent error handling
- ❌ Return unbounded result sets
- ❌ Expose database errors directly to agents
- ❌ Forget to export from category `index.ts`
- ❌ Use `camelCase` for tool names (use `snake_case`)

---

## Getting Help

**Documentation:**
- Sprint 4.5 Technical Spec: `docs/sprint-4.5-technical-spec.md`
- Architecture: `architecture.md` Section 8
- ADR-001: `docs/adr/001-progressive-disclosure-mcp.md`
- MCP README: `backend/src/mcp/README.md`

**Examples:**
- Project tools: `backend/src/mcp/servers/projects/`
- Story tools: `backend/src/mcp/servers/stories/`
- Meta tools: `backend/src/mcp/servers/meta/`

**Support:**
- GitHub Issues: Report bugs or ask questions
- Code Reviews: Tag @backend-team for guidance
- Pair Programming: Reach out for live help

---

**Version:** 1.0
**Last Updated:** 2025-11-10 (Sprint 4.5)
**Maintained By:** Backend Team
