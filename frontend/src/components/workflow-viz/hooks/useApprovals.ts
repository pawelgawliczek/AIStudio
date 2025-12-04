/**
 * Hook for managing approval gates via MCP tools
 * Actions: respond_to_approval, get_pending_approvals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../../lib/axios';
import type { ApprovalRequest } from '../types';

interface UseApprovalsOptions {
  runId: string;
  enabled?: boolean;
}

interface RespondToApprovalParams {
  action: 'approve' | 'rerun' | 'reject';
  decidedBy: string;
  feedback?: string;
  reason?: string;
  rejectMode?: 'cancel' | 'pause';
  notes?: string;
}

interface ApiApprovalRequest {
  id: string;
  workflowRunId: string;
  stateId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  feedback: string | null;
}

/**
 * Transform API response to frontend type
 */
function transformApiApproval(apiApproval: ApiApprovalRequest): ApprovalRequest {
  return {
    id: apiApproval.id,
    workflowRunId: apiApproval.workflowRunId,
    stateId: apiApproval.stateId,
    status: apiApproval.status,
    requestedAt: apiApproval.requestedAt,
    decidedBy: apiApproval.decidedBy,
    decidedAt: apiApproval.decidedAt,
    feedback: apiApproval.feedback,
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

export function useApprovals(options: UseApprovalsOptions) {
  const { runId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch pending approvals for this workflow run
  const { data, isLoading, error, refetch } = useQuery<ApprovalRequest[]>({
    queryKey: ['approvals', runId],
    queryFn: async () => {
      const projectId = getProjectId();
      const response = await axios.get<ApiApprovalRequest[]>(
        `/api/projects/${projectId}/workflow-runs/${runId}/approvals`
      );
      return response.data.map(transformApiApproval);
    },
    enabled: enabled && !!runId,
  });

  // Get the pending approval (there should only be one at a time)
  const pendingApproval = data?.find(a => a.status === 'pending') || null;

  // Respond to approval mutation
  const respondToApproval = useMutation({
    mutationFn: async (params: RespondToApprovalParams) => {
      if (!pendingApproval) {
        throw new Error('No pending approval found');
      }

      const projectId = getProjectId();
      const response = await axios.post(
        `/api/projects/${projectId}/workflow-runs/${runId}/approvals/${pendingApproval.id}/respond`,
        {
          runId,
          ...params,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] });
    },
  });

  return {
    approvals: data || [],
    pendingApproval,
    isLoading,
    error,
    refetch,
    respondToApproval: respondToApproval.mutateAsync,
    isResponding: respondToApproval.isPending,
  };
}
