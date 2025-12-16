/**
 * MCP Tool: Get Deployment Status
 *
 * ST-268: Async Deployment Progress Tracking
 *
 * Retrieves the current status of an async deployment, including:
 * - Current phase and progress (phaseIndex, totalPhases, percentComplete)
 * - Status (queued, deploying, deployed, failed)
 * - Timing information (startedAt, completedAt, duration)
 * - Result and error messages
 *
 * Use this tool to poll for deployment progress after calling deploy_to_production.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface GetDeploymentStatusParams {
  deploymentId: string;
}

export interface DeploymentProgress {
  phaseIndex: number;
  totalPhases: number;
  percentComplete: number;
  currentPhase: string;
  message: string;
}

export interface GetDeploymentStatusResponse {
  deploymentId: string;
  status: 'queued' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  storyKey?: string;
  prNumber?: number;
  directCommit?: boolean;

  // Progress tracking
  currentPhase?: string;
  progress?: DeploymentProgress;

  // Timing
  startedAt: Date;
  deployedAt?: Date;
  completedAt?: Date;
  duration?: number; // milliseconds

  // Result
  result?: {
    success: boolean;
    message: string;
  };

  // Errors
  errorMessage?: string;

  // Heartbeat (for liveness detection)
  lastHeartbeat?: Date;
  childProcessPid?: number;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'get_deployment_status',
  description: 'Get the current status of an async deployment. Use this to poll for progress after calling deploy_to_production.',

  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: {
        type: 'string',
        description: 'Deployment log ID returned by deploy_to_production (UUID)',
      },
    },
    required: ['deploymentId'],
  },
};

// ============================================================================
// Handler Implementation
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: GetDeploymentStatusParams
): Promise<GetDeploymentStatusResponse> {
  // Validate required parameters
  validateRequired(params, ['deploymentId']);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.deploymentId)) {
    throw new NotFoundError('DeploymentLog', params.deploymentId);
  }

  // Fetch deployment log
  const deployment = await prisma.deploymentLog.findUnique({
    where: { id: params.deploymentId },
    include: {
      story: {
        select: { key: true },
      },
    },
  });

  if (!deployment) {
    throw new NotFoundError('DeploymentLog', params.deploymentId);
  }

  // Calculate duration if completed
  let duration: number | undefined;
  if (deployment.completedAt && deployment.createdAt) {
    duration = deployment.completedAt.getTime() - deployment.createdAt.getTime();
  } else if (deployment.createdAt) {
    duration = Date.now() - deployment.createdAt.getTime();
  }

  // Build response
  const response: GetDeploymentStatusResponse = {
    deploymentId: deployment.id,
    status: deployment.status as any,
    storyKey: deployment.story?.key,
    prNumber: deployment.prNumber || undefined,
    directCommit: deployment.approvalMethod === 'MANUAL',
    currentPhase: deployment.currentPhase || undefined,
    progress: deployment.progress as any,
    startedAt: deployment.createdAt,
    deployedAt: deployment.deployedAt || undefined,
    completedAt: deployment.completedAt || undefined,
    duration,
    errorMessage: deployment.errorMessage || undefined,
    lastHeartbeat: deployment.lastHeartbeat || undefined,
    childProcessPid: deployment.childProcessPid || undefined,
  };

  // Add result summary
  if (deployment.status === 'deployed') {
    response.result = {
      success: true,
      message: 'Deployment completed successfully',
    };
  } else if (deployment.status === 'failed') {
    response.result = {
      success: false,
      message: deployment.errorMessage || 'Deployment failed',
    };
  }

  return response;
}

// ============================================================================
// Export
// ============================================================================

export default {
  tool,
  handler,
};
