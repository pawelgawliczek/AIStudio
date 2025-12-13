/**
 * List Teams Tool
 * Discover available teams for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'list_teams',
  description: 'List available teams/workflows for a project. Filter by active status or trigger type.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID (required)',
      },
      active: {
        type: 'boolean',
        description: 'Filter by active status (default: true, show only active teams)',
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
  domain: 'Team Execution',
  tags: ['team', 'agents', 'discovery', 'list', 'query'],
  version: '1.0.0',
  since: '2025-11-26',
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
      _count: {
        select: {
          workflowRuns: true,
          stories: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Transform workflows
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
