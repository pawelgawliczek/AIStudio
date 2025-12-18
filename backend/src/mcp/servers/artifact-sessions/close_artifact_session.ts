/**
 * Close Artifact Session Tool
 * ST-152: End artifact editing session and cleanup
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'close_artifact_session',
  description: 'Close artifact session without saving. Use save_artifact_changes first if you need to persist.',
  inputSchema: {
    type: 'object',
    properties: {
      jobId: {
        type: 'string',
        description: 'Job ID from open_artifact_session',
      },
      reason: {
        type: 'string',
        description: 'Reason for closing the session (optional)',
      },
    },
    required: ['jobId'],
  },
};

export const metadata = {
  category: 'artifact_sessions',
  domain: 'story_runner',
  tags: ['artifact', 'session', 'close', 'st-152'],
  version: '1.0.0',
  since: 'ST-152',
};

interface CloseArtifactSessionParams {
  jobId: string;
  reason?: string;
}

interface CloseArtifactSessionResponse {
  success: boolean;
  jobId: string;
  previousStatus?: string;
  newStatus: string;
  error?: string;
}

export async function handler(
  prisma: PrismaClient,
  params: CloseArtifactSessionParams,
): Promise<CloseArtifactSessionResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['jobId']);

    const { jobId, reason } = params;

    // Get job details
    const job = await prisma.remoteJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError('RemoteJob', jobId);
    }

    // Verify this is an artifact session job
    if (job.jobType !== 'artifact-session') {
      throw new ValidationError(
        `Job ${jobId} is not an artifact session (type: ${job.jobType})`,
      );
    }

    const previousStatus = job.status;

    // Only allow closing if not already completed/failed/cancelled
    if (['completed', 'failed', 'cancelled'].includes(previousStatus)) {
      return {
        success: true,
        jobId,
        previousStatus,
        newStatus: previousStatus,
        error: `Session already in terminal state: ${previousStatus}`,
      };
    }

    // Update job status to cancelled
    await prisma.remoteJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        error: reason || 'Session closed by user',
      },
    });

    // Release agent if it was assigned
    if (job.agentId) {
      const agent = await prisma.remoteAgent.findUnique({
        where: { id: job.agentId },
      });

      // Only clear if this job is the current execution
      if (agent && agent.currentExecutionId === jobId) {
        await prisma.remoteAgent.update({
          where: { id: job.agentId },
          data: { currentExecutionId: null },
        });
      }
    }

    return {
      success: true,
      jobId,
      previousStatus,
      newStatus: 'cancelled',
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'close_artifact_session');
  }
}
