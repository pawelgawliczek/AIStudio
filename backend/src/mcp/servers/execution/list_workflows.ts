/**
 * List Workflows Tool
 * Discover available workflows for a project
 */

import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

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
          decisionStrategy: true,
          componentIds: true,
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

  // Fetch component details for each workflow
  const workflowsWithComponents = await Promise.all(
    workflows.map(async (workflow) => {
      const componentIds = workflow.coordinator.componentIds || [];

      let components = [];
      if (componentIds.length > 0) {
        components = await prisma.component.findMany({
          where: {
            id: { in: componentIds },
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
        });
      }

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
          strategy: workflow.coordinator.decisionStrategy,
          componentCount: componentIds.length,
          components: components.map((c, index) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            order: index + 1,
          })),
        },

        usageStats: {
          totalRuns: workflow._count.workflowRuns,
          storiesAssigned: workflow._count.stories,
        },
      };
    }),
  );

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
