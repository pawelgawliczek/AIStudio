/**
 * Create Team Version Tool
 * Create minor/major version using VersioningService
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { VersioningService } from '../../../services/versioning.service';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface CreateWorkflowVersionParams {
  workflowId: string;
  majorVersion?: number;
  changeDescription?: string;
}

export const tool: Tool = {
  name: 'create_team_version',
  description: 'Create minor/major version of a team using VersioningService',
  inputSchema: {
    type: 'object',
    properties: {
      teamId: {
        type: 'string',
        description: 'Source team UUID (required)',
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
    required: ['teamId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['team', 'create', 'version'],
  version: '1.0.0',
  since: '2025-11-21',
};

async function generateAutoDiff(
  prisma: PrismaClient,
  sourceWorkflowId: string,
): Promise<any> {
  // Fetch source workflow to get old configuration
  const sourceWorkflow = await prisma.workflow.findUnique({
    where: { id: sourceWorkflowId },
  });

  if (!sourceWorkflow) {
    return null;
  }

  // Get parent workflow if exists (to compare against)
  const parentWorkflow = sourceWorkflow.parentId
    ? await prisma.workflow.findUnique({
        where: { id: sourceWorkflow.parentId },
      })
    : null;

  if (!parentWorkflow) {
    // This is the first version, no diff to generate
    return null;
  }

  const autoDiff: any = {
    agentChanges: [],
  };

  // Note: PM (coordinator) comparison removed - coordinatorId field no longer exists (ST-164)

  // Compare component assignments (agents)
  const oldAssignments = (parentWorkflow.componentAssignments as any[]) || [];
  const newAssignments = (sourceWorkflow.componentAssignments as any[]) || [];

  // Build maps for easy comparison
  const oldMap = new Map(oldAssignments.map((a) => [a.componentId, a]));
  const newMap = new Map(newAssignments.map((a) => [a.componentId, a]));

  // Find added agents
  for (const [componentId, assignment] of newMap) {
    if (!oldMap.has(componentId)) {
      autoDiff.agentChanges.push({
        type: 'added',
        agentId: componentId,
        agentName: assignment.componentName || 'Unknown',
        newVersion: assignment.version || 'Unknown',
      });
    }
  }

  // Find removed agents
  for (const [componentId, assignment] of oldMap) {
    if (!newMap.has(componentId)) {
      autoDiff.agentChanges.push({
        type: 'removed',
        agentId: componentId,
        agentName: assignment.componentName || 'Unknown',
        oldVersion: assignment.version || 'Unknown',
      });
    }
  }

  // Find version changed agents
  for (const [componentId, newAssignment] of newMap) {
    const oldAssignment = oldMap.get(componentId);
    if (oldAssignment && oldAssignment.version !== newAssignment.version) {
      autoDiff.agentChanges.push({
        type: 'version_changed',
        agentId: componentId,
        agentName: newAssignment.componentName || 'Unknown',
        oldVersion: oldAssignment.version || 'Unknown',
        newVersion: newAssignment.version || 'Unknown',
      });
    }
  }

  return autoDiff;
}

export async function handler(
  prisma: PrismaClient,
  params: CreateWorkflowVersionParams,
): Promise<any> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['workflowId']);

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

    // Generate auto-diff before creating version
    const autoDiff = await generateAutoDiff(prisma, params.workflowId);

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

    // ST-103: Store auto-diff in workflow metadata
    if (autoDiff) {
      const currentMetadata = ((newWorkflow as any).metadata as any) || {};
      await prisma.workflow.update({
        where: { id: newWorkflow.id },
        data: {
          metadata: {
            ...currentMetadata,
            autoDiff,
          } as any,
        },
      });
    }

    return {
      id: newWorkflow.id,
      projectId: newWorkflow.projectId,
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
      triggerConfig: (newWorkflow as any).triggerConfig,
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
