#!/usr/bin/env node

/**
 * AI Studio MCP Server
 *
 * This MCP server provides tools for project management, epic/story creation,
 * and will be extended with telemetry, use case management, and more.
 *
 * Usage:
 *   npm run mcp:dev
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

// Import tool implementations
import {
  bootstrapProject,
  createProject,
  listProjects,
  getProject,
} from './tools/project.tools.js';
import { createEpic, listEpics } from './tools/epic.tools.js';
import {
  createStory,
  listStories,
  getStory,
  updateStory,
} from './tools/story.tools.js';
import { formatError } from './utils.js';

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize MCP server
const server = new Server(
  {
    name: 'aistudio-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS: Tool[] = [
  // Project Management Tools
  {
    name: 'bootstrap_project',
    description:
      'Bootstrap a new project with default structure, including initial epic and framework configuration. This is the recommended way to start a new project.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name (must be unique)',
        },
        description: {
          type: 'string',
          description: 'Project description',
        },
        repositoryUrl: {
          type: 'string',
          description: 'Git repository URL',
        },
        defaultFramework: {
          type: 'string',
          description: 'Name for the default framework (default: "Single Agent")',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_project',
    description:
      'Create a new project without default structure. Use bootstrap_project for a more complete setup.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name (must be unique)',
        },
        description: {
          type: 'string',
          description: 'Project description',
        },
        repositoryUrl: {
          type: 'string',
          description: 'Git repository URL',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects with optional status filter',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'archived'],
          description: 'Filter by project status',
        },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Get details for a specific project by ID',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project UUID',
        },
      },
      required: ['projectId'],
    },
  },

  // Epic Management Tools
  {
    name: 'create_epic',
    description: 'Create a new epic within a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project UUID',
        },
        title: {
          type: 'string',
          description: 'Epic title',
        },
        description: {
          type: 'string',
          description: 'Epic description',
        },
        priority: {
          type: 'number',
          description: 'Epic priority (higher = more important)',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'list_epics',
    description: 'List all epics for a project with optional status filter',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project UUID',
        },
        status: {
          type: 'string',
          enum: ['planning', 'in_progress', 'done', 'archived'],
          description: 'Filter by epic status',
        },
      },
      required: ['projectId'],
    },
  },

  // Story Management Tools
  {
    name: 'create_story',
    description: 'Create a new story within a project and optionally an epic',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project UUID',
        },
        epicId: {
          type: 'string',
          description: 'Epic UUID (optional)',
        },
        title: {
          type: 'string',
          description: 'Story title',
        },
        description: {
          type: 'string',
          description: 'Story description',
        },
        type: {
          type: 'string',
          enum: ['feature', 'bug', 'defect', 'chore', 'spike'],
          description: 'Story type (default: feature)',
        },
        businessImpact: {
          type: 'number',
          description: 'Business impact score (1-10)',
        },
        businessComplexity: {
          type: 'number',
          description: 'Business complexity score (1-10)',
        },
        technicalComplexity: {
          type: 'number',
          description: 'Technical complexity score (1-10)',
        },
        assignedFrameworkId: {
          type: 'string',
          description: 'Framework UUID to assign this story to',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'list_stories',
    description: 'List stories with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Filter by project UUID',
        },
        epicId: {
          type: 'string',
          description: 'Filter by epic UUID',
        },
        status: {
          type: 'string',
          enum: ['planning', 'analysis', 'architecture', 'design', 'impl', 'review', 'qa', 'done'],
          description: 'Filter by story status',
        },
        type: {
          type: 'string',
          enum: ['feature', 'bug', 'defect', 'chore', 'spike'],
          description: 'Filter by story type',
        },
      },
    },
  },
  {
    name: 'get_story',
    description: 'Get details for a specific story by ID with optional related data',
    inputSchema: {
      type: 'object',
      properties: {
        storyId: {
          type: 'string',
          description: 'Story UUID',
        },
        includeSubtasks: {
          type: 'boolean',
          description: 'Include subtasks in response',
        },
        includeUseCases: {
          type: 'boolean',
          description: 'Include linked use cases in response',
        },
        includeCommits: {
          type: 'boolean',
          description: 'Include linked commits in response (last 10)',
        },
      },
      required: ['storyId'],
    },
  },
  {
    name: 'update_story',
    description:
      'Update an existing story (title, description, status, complexity, framework)',
    inputSchema: {
      type: 'object',
      properties: {
        storyId: {
          type: 'string',
          description: 'Story UUID',
        },
        title: {
          type: 'string',
          description: 'New story title',
        },
        description: {
          type: 'string',
          description: 'New story description',
        },
        status: {
          type: 'string',
          enum: ['planning', 'analysis', 'architecture', 'design', 'impl', 'review', 'qa', 'done'],
          description: 'New story status',
        },
        businessImpact: {
          type: 'number',
          description: 'Business impact score (1-10)',
        },
        businessComplexity: {
          type: 'number',
          description: 'Business complexity score (1-10)',
        },
        technicalComplexity: {
          type: 'number',
          description: 'Technical complexity score (1-10)',
        },
        assignedFrameworkId: {
          type: 'string',
          description: 'Framework UUID to assign this story to',
        },
      },
      required: ['storyId'],
    },
  },
];

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

/**
 * Call a tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Project Management Tools
      case 'bootstrap_project':
        result = await bootstrapProject(prisma, args);
        break;

      case 'create_project':
        result = await createProject(prisma, args);
        break;

      case 'list_projects':
        result = await listProjects(prisma, args);
        break;

      case 'get_project':
        result = await getProject(prisma, args);
        break;

      // Epic Management Tools
      case 'create_epic':
        result = await createEpic(prisma, args);
        break;

      case 'list_epics':
        result = await listEpics(prisma, args);
        break;

      // Story Management Tools
      case 'create_story':
        result = await createStory(prisma, args);
        break;

      case 'list_stories':
        result = await listStories(prisma, args);
        break;

      case 'get_story':
        result = await getStory(prisma, args);
        break;

      case 'update_story':
        result = await updateStory(prisma, args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

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

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ AI Studio MCP Server started');
  console.error(`📦 ${TOOLS.length} tools available`);
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
