/**
 * Hook for managing agent questions via MCP tools
 * Actions: get_pending_questions, answer_question, handoff_session
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../../lib/axios';
import type { AgentQuestion } from '../types';

interface UseAgentQuestionsOptions {
  runId: string;
  enabled?: boolean;
}

interface AnswerQuestionParams {
  answer: string;
  answeredBy?: string;
}

interface HandoffSessionParams {
  questionId?: string;
  sessionId?: string;
  handoffBy?: string;
}

interface ApiAgentQuestion {
  id: string;
  workflowRunId: string;
  stateId: string;
  question: string;
  answer: string | null;
  status: 'pending' | 'answered' | 'skipped';
  askedAt: string;
  answeredAt: string | null;
  answeredBy: string | null;
}

/**
 * Transform API response to frontend type
 */
function transformApiQuestion(apiQuestion: ApiAgentQuestion): AgentQuestion {
  return {
    id: apiQuestion.id,
    workflowRunId: apiQuestion.workflowRunId,
    stateId: apiQuestion.stateId,
    question: apiQuestion.question,
    answer: apiQuestion.answer,
    status: apiQuestion.status,
    askedAt: apiQuestion.askedAt,
    answeredAt: apiQuestion.answeredAt,
    answeredBy: apiQuestion.answeredBy,
  };
}

/**
 * Get project ID from localStorage
 */
function getProjectId(): string {
  const projectId = localStorage.getItem('selectedProjectId') ||
                   localStorage.getItem('currentProjectId');
  if (!projectId) {
    throw new Error('No project selected');
  }
  return projectId;
}

export function useAgentQuestions(options: UseAgentQuestionsOptions) {
  const { runId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch pending questions for this workflow run
  const { data, isLoading, error, refetch } = useQuery<AgentQuestion[]>({
    queryKey: ['agent-questions', runId],
    queryFn: async () => {
      const projectId = getProjectId();
      const response = await axios.get<ApiAgentQuestion[]>(
        `/api/projects/${projectId}/workflow-runs/${runId}/questions`
      );
      return response.data.map(transformApiQuestion);
    },
    enabled: enabled && !!runId,
  });

  // Get pending questions only
  const pendingQuestions = data?.filter(q => q.status === 'pending') || [];

  // Answer question mutation
  const answerQuestion = useMutation({
    mutationFn: async ({
      questionId,
      params,
    }: {
      questionId: string;
      params: AnswerQuestionParams;
    }) => {
      const projectId = getProjectId();
      const response = await axios.post(
        `/api/projects/${projectId}/questions/${questionId}/answer`,
        {
          ...params,
          answeredBy: params.answeredBy || 'user',
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-questions', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] });
    },
  });

  // Handoff session mutation
  const handoffSession = useMutation({
    mutationFn: async (params: HandoffSessionParams) => {
      const projectId = getProjectId();
      const response = await axios.post(`/api/projects/${projectId}/sessions/handoff`, {
        ...params,
        handoffBy: params.handoffBy || 'user',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-questions', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] });
    },
  });

  return {
    questions: data || [],
    pendingQuestions,
    isLoading,
    error,
    refetch,
    answerQuestion: (questionId: string, params: AnswerQuestionParams) =>
      answerQuestion.mutateAsync({ questionId, params }),
    handoffSession: handoffSession.mutateAsync,
    isAnswering: answerQuestion.isPending,
    isHandingOff: handoffSession.isPending,
  };
}
