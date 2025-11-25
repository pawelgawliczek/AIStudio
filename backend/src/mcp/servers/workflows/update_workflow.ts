/**
 * Update Workflow Tool
 * Updates an existing workflow with auto-versioning for structural changes
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
import { VersioningService } from '../../../services/versioning.service';

export interface UpdateWorkflowParams {
  workflowId: string;
  coordinatorId?: string;
  name?: string;
  description?: string;
  triggerConfig?: {
    type: string;
    url?: string;
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
  versionMajor?: number;
  versionMinor?: number;
  triggerConfig: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  autoVersioned?: boolean;
  versionedFrom?: string;
  changeDescription?: string;
}

export const tool: Tool = {
  name: 'update_workflow',
  description: 'Update an existing workflow definition. Supports partial updates - only provided fields will be modified.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID to update',
      },
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID (optional)',
      },
      name: {
        type: 'string',
        description: 'Workflow name (optional)',
      },
      description: {
        type: 'string',
        description: 'Workflow description (optional)',
      },
      triggerConfig: {
        type: 'object',
        description: 'Trigger configuration (optional)',
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
        description: 'Whether workflow is active (optional)',
      },
      version: {
        type: 'string',
        description: 'Version (optional)',
      },
    },
    required: ['workflowId'],
  },
};

export const metadata = {
  category: 'workflows',
  domain: 'workflow',
  tags: ['workflow', 'update'],
  version: '1.0.0',
  since: 'update-tools',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateWorkflowParams,
): Promise<WorkflowResponse> {
  try {
    validateRequired(params, ['workflowId']);

    // Verify workflow exists
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!existingWorkflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Check if structural changes require auto-versioning
    const coordinatorChanged = params.coordinatorId !== undefined &&
      params.coordinatorId !== existingWorkflow.coordinatorId;

    const triggerConfigChanged = params.triggerConfig !== undefined &&
      JSON.stringify(params.triggerConfig) !== JSON.stringify(existingWorkflow.triggerConfig);

    const requiresAutoVersion = coordinatorChanged || triggerConfigChanged;

    // Build update data object with only provided fields
    const updateData: any = {};

    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.active !== undefined) updateData.active = params.active;
    if (params.version !== undefined) updateData.version = params.version;

    // Handle coordinatorId update (requires validation)
    if (params.coordinatorId !== undefined) {
      // Verify coordinator exists and belongs to same project
      const coordinator = await prisma.component.findUnique({
        where: { id: params.coordinatorId },
      });

      if (!coordinator) {
        throw new NotFoundError('Coordinator', params.coordinatorId);
      }

      if (coordinator.projectId !== existingWorkflow.projectId) {
        throw new ValidationError('Coordinator does not belong to the same project as the workflow');
      }

      // Validate coordinator is active
      if (!coordinator.active) {
        throw new ValidationError(
          `Cannot assign inactive coordinator '${coordinator.name}' v${coordinator.version} to workflow. Please select an active coordinator version.`
        );
      }

      updateData.coordinatorId = params.coordinatorId;
    }

    // Handle triggerConfig update (requires validation)
    if (params.triggerConfig !== undefined) {
      if (!params.triggerConfig.type) {
        throw new ValidationError('triggerConfig.type is required');
      }
      updateData.triggerConfig = params.triggerConfig;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // If structural changes, auto-version before applying updates
    if (requiresAutoVersion) {
      const versioningService = new VersioningService(prisma as any);

      // Build change description
      const changes: string[] = [];
      if (coordinatorChanged) {
        changes.push(`Updated coordinator from ${existingWorkflow.coordinatorId} to ${params.coordinatorId}`);
      }
      if (triggerConfigChanged) {
        changes.push('Updated trigger configuration');
      }
      const changeDescription = changes.join('; ');

      // Create new version
      const newWorkflow = await versioningService.createMinorVersion(
        'workflow',
        params.workflowId,
        { changeDescription },
      );

      // Apply updates to the new version
      const updatedWorkflow = await prisma.workflow.update({
        where: { id: newWorkflow.id },
        data: updateData,
      });

      // Update version string to match versionMajor.versionMinor
      const versionLabel = `v${updatedWorkflow.versionMajor}.${updatedWorkflow.versionMinor}`;
      const finalWorkflow = await prisma.workflow.update({
        where: { id: updatedWorkflow.id },
        data: { version: versionLabel },
      });

      return {
        id: finalWorkflow.id,
        projectId: finalWorkflow.projectId,
        coordinatorId: finalWorkflow.coordinatorId,
        name: finalWorkflow.name,
        description: finalWorkflow.description,
        version: finalWorkflow.version,
        versionMajor: finalWorkflow.versionMajor,
        versionMinor: finalWorkflow.versionMinor,
        triggerConfig: finalWorkflow.triggerConfig,
        active: finalWorkflow.active,
        createdAt: finalWorkflow.createdAt.toISOString(),
        updatedAt: finalWorkflow.updatedAt.toISOString(),
        autoVersioned: true,
        versionedFrom: `v${existingWorkflow.versionMajor}.${existingWorkflow.versionMinor}`,
        changeDescription,
      };
    }

    // No structural changes - update in place (metadata only)
    const workflow = await prisma.workflow.update({
      where: { id: params.workflowId },
      data: updateData,
    });

    return {
      id: workflow.id,
      projectId: workflow.projectId,
      coordinatorId: workflow.coordinatorId,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      versionMajor: workflow.versionMajor,
      versionMinor: workflow.versionMinor,
      triggerConfig: workflow.triggerConfig,
      active: workflow.active,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      autoVersioned: false,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_workflow');
  }
}
