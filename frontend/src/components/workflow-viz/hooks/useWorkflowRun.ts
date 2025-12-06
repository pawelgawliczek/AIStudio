/**
 * Hook for fetching workflow run with states and component runs
 * Includes real-time WebSocket updates for state transitions
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from '../../../lib/axios';
import { useWebSocket } from '../../../services/websocket.service';
import type { WorkflowRunWithStates, WorkflowState, ComponentRunWithMetrics } from '../types';

interface UseWorkflowRunOptions {
  runId: string;
  refetchInterval?: number;
  enabled?: boolean;
}

interface SpawnedAgentTranscript {
  agentId: string;
  spawnedAt: string;
  componentId: string;
  transcriptPath: string;
}

interface ApiWorkflowRunResponse {
  id: string;
  workflowId: string;
  storyId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  // ST-182: Master transcript paths for live streaming
  masterTranscriptPaths?: string[];
  // ST-182: Spawned agent transcripts for live streaming
  spawnedAgentTranscripts?: SpawnedAgentTranscript[];
  executingAgentId?: string;
  states: Array<{
    id: string;
    name: string;
    order: number;
    componentId: string | null;
    preExecutionInstructions: string | null;
    postExecutionInstructions: string | null;
    mandatory: boolean;
    requiresApproval: boolean;
    runLocation: 'local' | 'laptop';
    offlineFallback: 'pause' | 'skip' | 'fail';
  }>;
  componentRuns: Array<{
    id: string;
    componentId: string;
    componentName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt: string | null;
    finishedAt: string | null;
    output: any;
    errorMessage: string | null;
    // Token metrics can come in different formats from the API
    tokenMetrics?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    // ST-168: Also support flat token fields from backend
    tokensInput?: number;
    tokensOutput?: number;
    totalTokens?: number;
  }>;
}

/**
 * Transform API response to frontend type
 */
function transformApiResponse(apiRun: ApiWorkflowRunResponse): WorkflowRunWithStates {
  const states: WorkflowState[] = apiRun.states.map(s => ({
    id: s.id,
    name: s.name,
    order: s.order,
    componentId: s.componentId,
    preExecutionInstructions: s.preExecutionInstructions,
    postExecutionInstructions: s.postExecutionInstructions,
    mandatory: s.mandatory,
    requiresApproval: s.requiresApproval,
    runLocation: s.runLocation,
    offlineFallback: s.offlineFallback,
  }));

  const componentRuns: ComponentRunWithMetrics[] = apiRun.componentRuns.map(cr => {
    // ST-168: Map token metrics from either nested structure or flat fields
    const inputTokens = cr.tokenMetrics?.inputTokens ?? cr.tokensInput ?? 0;
    const outputTokens = cr.tokenMetrics?.outputTokens ?? cr.tokensOutput ?? 0;
    const totalTokens = cr.tokenMetrics?.totalTokens ?? cr.totalTokens ?? (inputTokens + outputTokens);

    return {
      id: cr.id,
      componentId: cr.componentId,
      componentName: cr.componentName,
      status: cr.status,
      startedAt: cr.startedAt,
      completedAt: cr.finishedAt,
      output: cr.output,
      errorMessage: cr.errorMessage,
      tokenMetrics: totalTokens > 0 ? {
        inputTokens,
        outputTokens,
        totalTokens,
      } : undefined,
    };
  });

  return {
    id: apiRun.id,
    workflowId: apiRun.workflowId,
    storyId: apiRun.storyId,
    status: apiRun.status,
    states,
    componentRuns,
    // ST-182: Include master transcript paths for live streaming
    masterTranscriptPaths: apiRun.masterTranscriptPaths || [],
    // ST-182: Include spawned agent transcripts for live streaming
    spawnedAgentTranscripts: apiRun.spawnedAgentTranscripts || [],
    executingAgentId: apiRun.executingAgentId,
  };
}

export function useWorkflowRun(options: UseWorkflowRunOptions) {
  const { runId, refetchInterval = 5000, enabled = true } = options;
  const queryClient = useQueryClient();
  const { socket, isConnected } = useWebSocket();

  // Fetch workflow run data
  const { data, isLoading, error, refetch } = useQuery<WorkflowRunWithStates>({
    queryKey: ['workflow-run', runId],
    queryFn: async () => {
      // Get projectId from localStorage (set by ProjectContext)
      const projectId = localStorage.getItem('selectedProjectId') ||
                       localStorage.getItem('currentProjectId');
      if (!projectId) {
        throw new Error('No project selected');
      }
      const response = await axios.get<ApiWorkflowRunResponse>(
        `/projects/${projectId}/workflow-runs/${runId}?includeRelations=true`
      );
      return transformApiResponse(response.data);
    },
    refetchInterval,
    enabled: enabled && !!runId,
  });

  // Subscribe to WebSocket updates for this workflow run
  useEffect(() => {
    if (!socket || !isConnected || !runId) return;

    const handleUpdate = () => {
      // Invalidate query to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] });
    };

    // Subscribe to workflow events
    socket.on('workflow:stateTransition', handleUpdate);
    socket.on('workflow:paused', handleUpdate);
    socket.on('workflow:resumed', handleUpdate);
    socket.on('component:started', handleUpdate);
    socket.on('component:progress', handleUpdate);
    socket.on('component:completed', handleUpdate);
    socket.on('approval:requested', handleUpdate);
    socket.on('breakpoint:hit', handleUpdate);

    return () => {
      socket.off('workflow:stateTransition', handleUpdate);
      socket.off('workflow:paused', handleUpdate);
      socket.off('workflow:resumed', handleUpdate);
      socket.off('component:started', handleUpdate);
      socket.off('component:progress', handleUpdate);
      socket.off('component:completed', handleUpdate);
      socket.off('approval:requested', handleUpdate);
      socket.off('breakpoint:hit', handleUpdate);
    };
  }, [socket, isConnected, runId, queryClient]);

  return {
    workflowRun: data,
    isLoading,
    error,
    refetch,
  };
}
