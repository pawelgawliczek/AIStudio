/**
 * Create Team Tool
 * Creates a new team linking a project manager with trigger configuration
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
  name: string;
  description: string | null;
  version: string;
  triggerConfig: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const tool: Tool = {
  name: 'create_team',
  description: 'Create a new team with trigger configuration. Teams are groups of agents working together.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
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
    required: ['projectId', 'name', 'triggerConfig'],
  },
};

export const metadata = {
  category: 'teams',
  domain: 'team',
  tags: ['team', 'create', 'agents'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateWorkflowParams,
): Promise<WorkflowResponse> {
  try {
    validateRequired(params, [
      'projectId',
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

    // Validate triggerConfig
    if (!params.triggerConfig.type) {
      throw new ValidationError('triggerConfig.type is required');
    }

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        projectId: params.projectId,
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
