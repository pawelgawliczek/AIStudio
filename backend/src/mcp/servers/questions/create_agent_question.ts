/**
 * ST-172: Create Agent Question MCP Tool
 *
 * Creates an AgentQuestion record when AskUserQuestion is called.
 * Triggered by hook and emits WebSocket event for real-time UI notification.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { broadcastQuestionDetected } from '../../services/websocket-gateway.instance';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'create_agent_question',
  description: 'Create an AgentQuestion record and notify via WebSocket. Called by AskUserQuestion hook.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowRunId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
      sessionId: {
        type: 'string',
        description: 'Claude Code session ID (required for --resume)',
      },
      questions: {
        type: 'array',
        description: 'Array of question objects from AskUserQuestion tool',
      },
      source: {
        type: 'string',
        description: 'Source of the question (hook, agent, manual). Default: agent',
      },
      stateId: {
        type: 'string',
        description: 'Workflow state ID (optional - will use currentStateId from WorkflowRun if not provided)',
      },
    },
    required: ['workflowRunId', 'sessionId', 'questions'],
  },
};

export const metadata = {
  category: 'questions',
  domain: 'Agent Questions',
  tags: ['questions', 'workflow', 'realtime', 'websocket'],
  version: '1.0.0',
  since: '2025-12-04',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.workflowRunId) {
    throw new ValidationError('Missing required parameter: workflowRunId', {
      expectedState: 'A valid workflow run ID must be provided',
    });
  }
  if (!params.sessionId) {
    throw new ValidationError('Missing required parameter: sessionId', {
      expectedState: 'A valid session ID must be provided',
    });
  }
  if (!params.questions || !Array.isArray(params.questions)) {
    throw new ValidationError('Missing required parameter: questions', {
      expectedState: 'An array of question objects must be provided',
    });
  }

  // Get workflow run to find current state
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.workflowRunId },
    select: {
      id: true,
      projectId: true,
      currentStateId: true,
      status: true,
    },
  });

  if (!workflowRun) {
    throw new ValidationError(`Workflow run ${params.workflowRunId} not found`, {
      resourceId: params.workflowRunId,
    });
  }

  // Determine stateId - use provided or fall back to currentStateId
  const stateId = params.stateId || workflowRun.currentStateId;

  if (!stateId) {
    throw new ValidationError(
      'Cannot determine state ID. Either provide stateId parameter or ensure workflow run has currentStateId set.',
      {
        workflowRunId: params.workflowRunId,
        hasCurrentStateId: !!workflowRun.currentStateId,
      },
    );
  }

  // Format questions as text
  const questionText = JSON.stringify(params.questions, null, 2);

  // Create the AgentQuestion record
  const agentQuestion = await prisma.agentQuestion.create({
    data: {
      workflowRunId: params.workflowRunId,
      stateId: stateId,
      sessionId: params.sessionId,
      questionText: questionText,
      status: 'pending',
      canHandoff: true,
    },
  });

  // Emit WebSocket event for real-time UI notification
  // Use existing broadcast function (ST-160 pattern)
  try {
    await broadcastQuestionDetected(
      params.workflowRunId,
      workflowRun.projectId,
      {
        questionId: agentQuestion.id,
        sessionId: params.sessionId,
        questionText: questionText,
        canHandoff: true,
        executionType: params.source || 'hook',
      },
    );
    console.log(`[ST-172] WebSocket event emitted: question:detected for question ${agentQuestion.id}`);
  } catch (wsError: any) {
    // Non-fatal - log and continue
    console.warn(`[ST-172] Failed to emit WebSocket event: ${wsError.message}`);
  }

  return {
    success: true,
    questionId: agentQuestion.id,
    workflowRunId: params.workflowRunId,
    stateId: stateId,
    sessionId: params.sessionId,
    status: 'pending',
    questionsCount: params.questions.length,
    createdAt: agentQuestion.createdAt.toISOString(),
    message: `Created AgentQuestion ${agentQuestion.id} with ${params.questions.length} question(s)`,
  };
}
