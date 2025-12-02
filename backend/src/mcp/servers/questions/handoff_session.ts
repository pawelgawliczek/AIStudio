/**
 * Handoff Session Tool (ST-160)
 *
 * Marks a session for handoff to manual control.
 * The job is paused and the user can resume it locally.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, AgentQuestionStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface HandoffSessionParams {
  sessionId?: string;
  questionId?: string;
  handoffBy?: string;
}

export interface HandoffSessionResponse {
  success: boolean;
  sessionId: string;
  jobId: string;
  workflowRunId: string;
  projectPath?: string;
  resumeCommand: string;
  message: string;
}

export const tool: Tool = {
  name: 'handoff_session',
  description:
    'Mark a Claude Code session for manual handoff. The automated job will be paused and ' +
    'the user can resume it locally using `claude --resume <session-id>`. ' +
    'Provide either sessionId or questionId to identify the session.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID to handoff (from question or job)',
      },
      questionId: {
        type: 'string',
        description: 'Question ID to handoff (will look up session from question)',
      },
      handoffBy: {
        type: 'string',
        description: 'User identifier who is taking over (optional)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'questions',
  domain: 'workflow',
  tags: ['agent', 'session', 'handoff', 'native-subagent'],
  version: '1.0.0',
  since: '2025-12-02',
};

export async function handler(
  prisma: PrismaClient,
  params: HandoffSessionParams,
): Promise<HandoffSessionResponse> {
  try {
    // 1. Validate - need either sessionId or questionId
    if (!params.sessionId && !params.questionId) {
      throw new ValidationError('Either sessionId or questionId is required');
    }

    let sessionId = params.sessionId;
    let questionId = params.questionId;

    // 2. If questionId provided, look up the session
    if (questionId && !sessionId) {
      const question = await prisma.agentQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new NotFoundError('AgentQuestion', questionId);
      }

      sessionId = question.sessionId;

      // Update question status to skipped (user is handling it manually)
      await prisma.agentQuestion.update({
        where: { id: questionId },
        data: {
          status: AgentQuestionStatus.skipped,
          answeredBy: params.handoffBy || 'handoff',
          answeredAt: new Date(),
          answer: '[Session handed off to manual control]',
        },
      });
    }

    // 3. Find the job with this session ID
    const job = await prisma.remoteJob.findFirst({
      where: {
        result: {
          path: ['sessionId'],
          equals: sessionId,
        },
        status: { in: ['running', 'paused'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!job) {
      // Try to find by looking at params
      const jobByParams = await prisma.remoteJob.findFirst({
        where: {
          status: { in: ['running', 'paused'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!jobByParams) {
        throw new ValidationError(`No active job found for session ${sessionId}`);
      }
    }

    const targetJob = job || (await prisma.remoteJob.findFirst({
      where: { status: { in: ['running', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    }));

    if (!targetJob) {
      throw new ValidationError('No active job found for handoff');
    }

    // 4. Update job status to handed_off
    await prisma.remoteJob.update({
      where: { id: targetJob.id },
      data: {
        status: 'handed_off',
        result: {
          ...(targetJob.result as Record<string, unknown> || {}),
          handoffAt: new Date().toISOString(),
          handoffBy: params.handoffBy || 'unknown',
        } as any,
      },
    });

    // 5. Get project path from job params
    const jobParams = targetJob.params as Record<string, unknown> || {};
    const projectPath = jobParams.projectPath as string || '.';

    // 6. Build resume command
    const resumeCommand = `claude --resume ${sessionId}`;

    // 7. Return handoff details
    return {
      success: true,
      sessionId: sessionId!,
      jobId: targetJob.id,
      workflowRunId: targetJob.workflowRunId!,
      projectPath,
      resumeCommand,
      message: `Session ${sessionId} marked for handoff. Run the resume command locally to continue.`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'handoff_session');
  }
}
