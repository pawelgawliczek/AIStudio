/**
 * Get Pending Questions Tool (ST-160)
 *
 * Lists pending questions from Claude CLI agents that need human answers.
 * Supports filtering by workflow run, state, or project.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, AgentQuestionStatus } from '@prisma/client';
import { handlePrismaError } from '../../utils';

export interface GetPendingQuestionsParams {
  workflowRunId?: string;
  stateId?: string;
  projectId?: string;
  includeAnswered?: boolean;
  page?: number;
  pageSize?: number;
}

export interface QuestionSummary {
  id: string;
  workflowRunId: string;
  stateId: string;
  sessionId: string;
  questionText: string;
  status: string;
  canHandoff: boolean;
  createdAt: string;
  // Context fields
  stateName?: string;
  storyKey?: string;
  storyTitle?: string;
  waitingMinutes: number;
}

export interface GetPendingQuestionsResponse {
  questions: QuestionSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const tool: Tool = {
  name: 'get_pending_questions',
  description:
    'List pending questions from Claude CLI agents awaiting human answers. ' +
    'Filter by workflow run, state, or project. Returns questions with context.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowRunId: {
        type: 'string',
        description: 'Filter by workflow run UUID (optional)',
      },
      stateId: {
        type: 'string',
        description: 'Filter by workflow state UUID (optional)',
      },
      projectId: {
        type: 'string',
        description: 'Filter by project UUID (optional)',
      },
      includeAnswered: {
        type: 'boolean',
        description: 'Include answered questions in results (default: false)',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'questions',
  domain: 'workflow',
  tags: ['agent', 'question', 'list', 'native-subagent'],
  version: '1.0.0',
  since: '2025-12-01',
};

export async function handler(
  prisma: PrismaClient,
  params: GetPendingQuestionsParams,
): Promise<GetPendingQuestionsResponse> {
  try {
    // 1. Parse pagination
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    // 2. Build where clause
    const where: any = {};

    // Status filter
    if (params.includeAnswered) {
      where.status = {
        in: [AgentQuestionStatus.pending, AgentQuestionStatus.answered],
      };
    } else {
      where.status = AgentQuestionStatus.pending;
    }

    // Optional filters
    if (params.workflowRunId) {
      where.workflowRunId = params.workflowRunId;
    }
    if (params.stateId) {
      where.stateId = params.stateId;
    }

    // Project filter requires joining through workflow run
    if (params.projectId) {
      where.workflowRun = {
        workflow: {
          projectId: params.projectId,
        },
      };
    }

    // 3. Query questions with context
    const [questions, total] = await Promise.all([
      prisma.agentQuestion.findMany({
        where,
        include: {
          workflowRun: {
            select: {
              story: {
                select: {
                  key: true,
                  title: true,
                },
              },
            },
          },
          state: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.agentQuestion.count({ where }),
    ]);

    // 4. Transform results
    const now = new Date();
    const questionSummaries: QuestionSummary[] = questions.map((q) => ({
      id: q.id,
      workflowRunId: q.workflowRunId,
      stateId: q.stateId,
      sessionId: q.sessionId,
      questionText: q.questionText,
      status: q.status,
      canHandoff: q.canHandoff,
      createdAt: q.createdAt.toISOString(),
      stateName: q.state?.name,
      storyKey: q.workflowRun?.story?.key,
      storyTitle: q.workflowRun?.story?.title,
      waitingMinutes: Math.round((now.getTime() - q.createdAt.getTime()) / 60000),
    }));

    // 5. Return response
    return {
      questions: questionSummaries,
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'get_pending_questions');
  }
}
