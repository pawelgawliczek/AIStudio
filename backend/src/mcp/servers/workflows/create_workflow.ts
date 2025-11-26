/**
 * Create Workflow Tool
 * Creates a new workflow linking a coordinator with trigger configuration
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export interface CreateWorkflowParams {
  projectId: string;
  coordinatorId: string;
  name: string;
  description?: string;
  triggerConfig: {
    type: string;
    filters?: any;
    notifications?: any;
  };
  active?: boolean;
  version?: string;
}

export interface WorkflowResponse {
  id: string;
  projectId: string;
  coordinatorId: string;
  name: string;
  description: string | null;
  version: string;
  triggerConfig: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const tool: Tool = {
  name: 'create_workflow',
  description: 'Create a new workflow linking a coordinator with trigger configuration',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID',
      },
      name: {
        type: 'string',
        description: 'Workflow name',
      },
      description: {
        type: 'string',
        description: 'Workflow description (optional)',
      },
      triggerConfig: {
        type: 'object',
        description: 'Trigger configuration (type, filters, notifications)',
        properties: {
          type: {
            type: 'string',
            description: 'Trigger type (e.g., manual, story_assigned, webhook)',
          },
          filters: {
            type: 'object',
            description: 'Filters for when to trigger (optional)',
          },
          notifications: {
            type: 'object',
            description: 'Notification settings (optional)',
          },
        },
        required: ['type'],
      },
      active: {
        type: 'boolean',
        description: 'Whether workflow is active (default: true)',
      },
      version: {
        type: 'string',
        description: 'Version (default: v1.0)',
      },
    },
    required: ['projectId', 'coordinatorId', 'name', 'triggerConfig'],
  },
};

export const metadata = {
  category: 'workflows',
  domain: 'workflow',
  tags: ['workflow', 'create'],
  version: '1.0.0',
  since: 'workflow-mvp',
};

// ALIASING: Workflow → Team, Coordinator → Project Manager (ST-109)
export const teamTool: Tool = {
  name: 'create_team',
  description: 'Create a new team linking a project manager with trigger configuration. A team is a group of agents working together.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      projectManagerId: {
        type: 'string',
        description: 'Project Manager UUID (coordinator that orchestrates the team)',
      },
      name: {
        type: 'string',
        description: 'Team name',
      },
      description: {
        type: 'string',
        description: 'Team description (optional)',
      },
      triggerConfig: {
        type: 'object',
        description: 'Trigger configuration (type, filters, notifications)',
        properties: {
          type: {
            type: 'string',
            description: 'Trigger type (e.g., manual, story_assigned, webhook)',
          },
          filters: {
            type: 'object',
            description: 'Filters for when to trigger (optional)',
          },
          notifications: {
            type: 'object',
            description: 'Notification settings (optional)',
          },
        },
        required: ['type'],
      },
      active: {
        type: 'boolean',
        description: 'Whether team is active (default: true)',
      },
      version: {
        type: 'string',
        description: 'Version (default: v1.0)',
      },
    },
    required: ['projectId', 'projectManagerId', 'name', 'triggerConfig'],
  },
};

export const teamMetadata = {
  category: 'teams',
  domain: 'team',
  tags: ['team', 'create', 'agents'],
  version: '1.0.0',
  since: '2025-11-26',
  aliasOf: 'create_workflow',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateWorkflowParams,
): Promise<WorkflowResponse> {
  try {
    validateRequired(params, [
      'projectId',
      'coordinatorId',
      'name',
      'triggerConfig',
    ]);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Verify coordinator exists and belongs to project
    const coordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
    });

    if (!coordinator) {
      throw new NotFoundError('Coordinator', params.coordinatorId);
    }

    if (coordinator.projectId !== params.projectId) {
      throw new ValidationError('Coordinator does not belong to the specified project');
    }

    // Validate coordinator is active
    if (!coordinator.active) {
      throw new ValidationError(
        `Cannot assign inactive coordinator '${coordinator.name}' v${coordinator.version} to workflow. Please select an active coordinator version.`
      );
    }

    // Validate triggerConfig
    if (!params.triggerConfig.type) {
      throw new ValidationError('triggerConfig.type is required');
    }

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        projectId: params.projectId,
        coordinatorId: params.coordinatorId,
        name: params.name,
        description: params.description,
        triggerConfig: params.triggerConfig,
        active: params.active !== undefined ? params.active : true,
        version: params.version || 'v1.0',
      },
    });

    return {
      id: workflow.id,
      projectId: workflow.projectId,
      coordinatorId: workflow.coordinatorId,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      triggerConfig: workflow.triggerConfig,
      active: workflow.active,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_workflow');
  }
}
