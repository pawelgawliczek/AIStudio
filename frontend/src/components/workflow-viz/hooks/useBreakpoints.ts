/**
 * Hook for managing breakpoints via MCP tools
 * CRUD operations: set_breakpoint, clear_breakpoint, list_breakpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../../lib/axios';
import type { Breakpoint } from '../types';

interface UseBreakpointsOptions {
  runId: string;
  enabled?: boolean;
}

interface SetBreakpointParams {
  stateId?: string;
  stateName?: string;
  stateOrder?: number;
  position?: 'before' | 'after';
  condition?: any;
}

interface ClearBreakpointParams {
  breakpointId?: string;
  stateId?: string;
  stateName?: string;
  stateOrder?: number;
  position?: 'before' | 'after';
  clearAll?: boolean;
}

interface ApiBreakpoint {
  id: string;
  runId: string;
  stateId: string;
  position: 'before' | 'after';
  condition: any | null;
  active: boolean;
  hitAt: string | null;
}

/**
 * Transform API response to frontend type
 */
function transformApiBreakpoint(apiBreakpoint: ApiBreakpoint): Breakpoint {
  return {
    id: apiBreakpoint.id,
    runId: apiBreakpoint.runId,
    stateId: apiBreakpoint.stateId,
    position: apiBreakpoint.position,
    condition: apiBreakpoint.condition,
    active: apiBreakpoint.active,
    hitAt: apiBreakpoint.hitAt,
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

export function useBreakpoints(options: UseBreakpointsOptions) {
  const { runId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch breakpoints for this workflow run
  const { data, isLoading, error, refetch } = useQuery<Breakpoint[]>({
    queryKey: ['breakpoints', runId],
    queryFn: async () => {
      const projectId = getProjectId();
      const response = await axios.get<ApiBreakpoint[]>(
        `/projects/${projectId}/workflow-runs/${runId}/breakpoints`
      );
      return response.data.map(transformApiBreakpoint);
    },
    enabled: enabled && !!runId,
  });

  // Set breakpoint mutation
  const setBreakpoint = useMutation({
    mutationFn: async (params: SetBreakpointParams) => {
      const projectId = getProjectId();
      const response = await axios.post<ApiBreakpoint>(
        `/projects/${projectId}/workflow-runs/${runId}/breakpoints`,
        {
          runId,
          ...params,
        }
      );
      return transformApiBreakpoint(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakpoints', runId] });
    },
  });

  // Clear breakpoint mutation
  const clearBreakpoint = useMutation({
    mutationFn: async (params: ClearBreakpointParams) => {
      const projectId = getProjectId();
      if (params.breakpointId) {
        // Clear specific breakpoint by ID
        await axios.delete(
          `/projects/${projectId}/workflow-runs/${runId}/breakpoints/${params.breakpointId}`
        );
      } else {
        // Clear by state/position or clear all
        await axios.post(`/projects/${projectId}/workflow-runs/${runId}/breakpoints/clear`, {
          runId,
          ...params,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakpoints', runId] });
    },
  });

  // Clear all breakpoints
  const clearAllBreakpoints = useMutation({
    mutationFn: async () => {
      const projectId = getProjectId();
      await axios.post(`/projects/${projectId}/workflow-runs/${runId}/breakpoints/clear`, {
        runId,
        clearAll: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakpoints', runId] });
    },
  });

  return {
    breakpoints: data || [],
    isLoading,
    error,
    refetch,
    setBreakpoint: setBreakpoint.mutateAsync,
    clearBreakpoint: clearBreakpoint.mutateAsync,
    clearAllBreakpoints: clearAllBreakpoints.mutateAsync,
    isSettingBreakpoint: setBreakpoint.isPending,
    isClearingBreakpoint: clearBreakpoint.isPending,
  };
}
