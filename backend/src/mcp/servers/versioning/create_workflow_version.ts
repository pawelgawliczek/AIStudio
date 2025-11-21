/**
 * Create Workflow Version Tool
 * Create minor/major version using VersioningService
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { VersioningService } from '../../../services/versioning.service';

export interface CreateWorkflowVersionParams {
  workflowId: string;
  majorVersion?: number;
  changeDescription?: string;
}

export const tool: Tool = {
  name: 'create_workflow_version',
  description: 'Create minor/major version of a workflow using VersioningService',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Source workflow UUID (required)',
      },
      majorVersion: {
        type: 'number',
        description: 'If provided, creates major version (X.0). Otherwise creates minor version increment.',
      },
      changeDescription: {
        type: 'string',
        description: 'Optional change notes',
      },
    },
    required: ['workflowId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['workflow', 'create', 'version'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateWorkflowVersionParams,
): Promise<any> {
  try {
    validateRequired(params, ['workflowId']);

    // Check workflow exists
    const sourceWorkflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!sourceWorkflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    if (sourceWorkflow.isDeprecated) {
      throw new ValidationError('Cannot create version from deprecated workflow');
    }

    const versioningService = new VersioningService(prisma as any);

    let newWorkflow;
    if (params.majorVersion !== undefined) {
      // Create major version
      newWorkflow = await versioningService.createMajorVersion(
        'workflow',
        params.workflowId,
        params.majorVersion,
        { changeDescription: params.changeDescription },
      );
    } else {
      // Create minor version
      newWorkflow = await versioningService.createMinorVersion(
        'workflow',
        params.workflowId,
        { changeDescription: params.changeDescription },
      );
    }

    return {
      id: newWorkflow.id,
      projectId: newWorkflow.projectId,
      coordinatorId: newWorkflow.coordinatorId,
      name: newWorkflow.name,
      description: newWorkflow.description,
      versionMajor: newWorkflow.versionMajor,
      versionMinor: newWorkflow.versionMinor,
      versionLabel: `${newWorkflow.versionMajor}.${newWorkflow.versionMinor}`,
      version: `v${newWorkflow.versionMajor}.${newWorkflow.versionMinor}`,
      parentId: newWorkflow.parentId,
      createdFromVersion: newWorkflow.createdFromVersion,
      changeDescription: newWorkflow.changeDescription,
      instructionsChecksum: newWorkflow.instructionsChecksum,
      configChecksum: newWorkflow.configChecksum,
      triggerConfig: newWorkflow.triggerConfig,
      active: newWorkflow.active,
      isDeprecated: newWorkflow.isDeprecated,
      createdAt: newWorkflow.createdAt.toISOString(),
      updatedAt: newWorkflow.updatedAt.toISOString(),
      message: `Created version ${newWorkflow.versionMajor}.${newWorkflow.versionMinor} from ${sourceWorkflow.versionMajor}.${sourceWorkflow.versionMinor}`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    // Handle NestJS BadRequestException
    if (error.name === 'BadRequestException' || error.status === 400) {
      throw new ValidationError(error.message);
    }
    throw handlePrismaError(error, 'create_workflow_version');
  }
}
