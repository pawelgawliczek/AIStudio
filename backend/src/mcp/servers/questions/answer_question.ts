/**
 * Answer Question Tool (ST-160)
 *
 * Answers a pending question from a Claude CLI agent and triggers session resume.
 * The laptop agent receives the answer via WebSocket and resumes the session
 * using `claude -p --resume <session-id>` with the answer as stdin input.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, AgentQuestionStatus } from '@prisma/client';
import { sendAnswerToRemoteAgent, broadcastQuestionAnswered } from '../../services/websocket-gateway.instance';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface AnswerQuestionParams {
  questionId: string;
  answer: string;
  answeredBy?: string;
}

export interface AnswerQuestionResponse {
  id: string;
  workflowRunId: string;
  stateId: string;
  sessionId: string;
  questionText: string;
  status: string;
  answer: string;
  answeredBy: string | null;
  answeredAt: string;
  canHandoff: boolean;
}

export const tool: Tool = {
  name: 'answer_question',
  description:
    'Answer a pending question from a Claude CLI agent. The answer will be used to resume ' +
    'the agent session via `--resume`. Returns the updated question record.',
  inputSchema: {
    type: 'object',
    properties: {
      questionId: {
        type: 'string',
        description: 'AgentQuestion UUID to answer (required)',
      },
      answer: {
        type: 'string',
        description: 'The answer text to provide to the agent (required)',
      },
      answeredBy: {
        type: 'string',
        description: 'User identifier who provided the answer (optional, defaults to "mcp-user")',
      },
    },
    required: ['questionId', 'answer'],
  },
};

export const metadata = {
  category: 'questions',
  domain: 'workflow',
  tags: ['agent', 'question', 'answer', 'native-subagent'],
  version: '1.0.0',
  since: '2025-12-01',
};

export async function handler(
  prisma: PrismaClient,
  params: AnswerQuestionParams,
): Promise<AnswerQuestionResponse> {
  try {
    // 1. Validate input
    validateRequired(params as unknown as Record<string, unknown>, ['questionId', 'answer']);

    if (!params.answer.trim()) {
      throw new ValidationError('Answer cannot be empty');
    }

    // 2. Find the question
    const question = await prisma.agentQuestion.findUnique({
      where: { id: params.questionId },
    });

    if (!question) {
      throw new NotFoundError('AgentQuestion', params.questionId);
    }

    // 3. Validate question is pending
    if (question.status !== AgentQuestionStatus.pending) {
      throw new ValidationError(
        `Question ${params.questionId} is not pending (current status: ${question.status})`,
      );
    }

    // 4. Update question with answer
    const updatedQuestion = await prisma.agentQuestion.update({
      where: { id: params.questionId },
      data: {
        status: AgentQuestionStatus.answered,
        answer: params.answer,
        answeredBy: params.answeredBy || 'mcp-user',
        answeredAt: new Date(),
      },
    });

    // 5. Find the associated job to get agent ID
    const job = await prisma.remoteJob.findFirst({
      where: {
        workflowRunId: question.workflowRunId,
        componentRunId: question.componentRunId || undefined,
        status: 'paused', // The job should be paused waiting for answer
      },
      orderBy: { createdAt: 'desc' },
    });

    // 6. Get workflow run for project ID (for broadcasting)
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: question.workflowRunId },
      include: {
        workflow: {
          select: { projectId: true },
        },
      },
    });

    let resumeTriggered = false;

    // 7. Trigger resume on laptop agent if job and agent found
    if (job?.agentId) {
      const result = await sendAnswerToRemoteAgent(job.agentId, {
        sessionId: question.sessionId,
        answer: params.answer,
        questionId: params.questionId,
        jobId: job.id,
        workflowRunId: question.workflowRunId,
      });

      if (result.success) {
        console.log(`[ST-160] Resume triggered for session ${question.sessionId}`);
        resumeTriggered = true;

        // Update job status back to running
        await prisma.remoteJob.update({
          where: { id: job.id },
          data: { status: 'running' },
        });
      } else {
        console.warn(`[ST-160] Failed to trigger resume: ${result.error}`);
      }
    } else {
      console.warn(`[ST-160] No paused job found for question ${params.questionId}`);
    }

    // 8. Broadcast question answered event
    if (workflowRun?.workflow?.projectId) {
      await broadcastQuestionAnswered(
        question.workflowRunId,
        workflowRun.workflow.projectId,
        {
          questionId: params.questionId,
          answeredBy: params.answeredBy,
          resumeTriggered,
        },
      );
    }

    // 9. Return response
    return {
      id: updatedQuestion.id,
      workflowRunId: updatedQuestion.workflowRunId,
      stateId: updatedQuestion.stateId,
      sessionId: updatedQuestion.sessionId,
      questionText: updatedQuestion.questionText,
      status: updatedQuestion.status,
      answer: updatedQuestion.answer!,
      answeredBy: updatedQuestion.answeredBy,
      answeredAt: updatedQuestion.answeredAt!.toISOString(),
      canHandoff: updatedQuestion.canHandoff,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'answer_question');
  }
}
