/**
 * List Workflows Tool
 * Discover available workflows for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'list_workflows',
  description:
    'List all available workflows for a project. Use this to discover workflows that can be used to execute stories or epics.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID (required)',
      },
      active: {
        type: 'boolean',
        description: 'Filter by active status (default: true, show only active workflows)',
      },
      triggerType: {
        type: 'string',
        description: 'Filter by trigger type (e.g., manual, story_assigned, webhook)',
      },
    },
    required: ['projectId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'discovery', 'list', 'query'],
  version: '1.0.0',
  since: '2025-11-14',
};

// ALIASING: Workflow → Team (ST-109)
export const teamTool: Tool = {
  name: 'list_teams',
  description:
    'List all available teams for a project. A team is a group of agents working together on stories or epics. Use this to discover teams that can be assigned to execute work.',
  inputSchema: tool.inputSchema,
};

export const teamMetadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'agents', 'discovery', 'list', 'query'],
  version: '1.0.0',
  since: '2025-11-26',
  aliasOf: 'list_workflows',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.projectId) {
    throw new Error('projectId is required');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });

  if (!project) {
    throw new Error(`Project with ID ${params.projectId} not found`);
  }

  // Build filter criteria
  const where: any = {
    projectId: params.projectId,
  };

  // Filter by active status (default: true)
  if (params.active !== undefined) {
    where.active = params.active;
  } else {
    where.active = true; // Default to active workflows only
  }

  // Filter by trigger type if provided
  if (params.triggerType) {
    where.triggerConfig = {
      path: ['type'],
      equals: params.triggerType,
    };
  }

  // Fetch workflows with related data
  const workflows = await prisma.workflow.findMany({
    where,
    include: {
      coordinator: {
        select: {
          id: true,
          name: true,
          description: true,
          config: true,
          tools: true,
          tags: true,
        },
      },
      _count: {
        select: {
          workflowRuns: true,
          stories: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Transform workflows with coordinator details
  const workflowsWithComponents = workflows.map((workflow) => {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      active: workflow.active,
      triggerConfig: workflow.triggerConfig,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),

      coordinator: {
        id: workflow.coordinator.id,
        name: workflow.coordinator.name,
        description: workflow.coordinator.description,
        config: workflow.coordinator.config,
        tools: workflow.coordinator.tools,
        tags: workflow.coordinator.tags,
      },

      usageStats: {
        totalRuns: workflow._count.workflowRuns,
        storiesAssigned: workflow._count.stories,
      },
    };
  });

  return {
    success: true,
    project: {
      id: project.id,
      name: project.name,
    },
    workflows: workflowsWithComponents,
    count: workflowsWithComponents.length,
    message: `Found ${workflowsWithComponents.length} workflow(s) for project "${project.name}"`,
  };
}
