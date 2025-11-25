import { useQuery } from '@tanstack/react-query';
import { WorkflowRun, WorkflowRunStatus } from '../types/workflow-tracking';

interface UseWorkflowRunsOptions {
  projectId?: string;
  status?: WorkflowRunStatus;
  storyId?: string;
  includeCancelled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook for fetching and managing workflow runs with real-time updates
 */
export function useWorkflowRuns(options: UseWorkflowRunsOptions = {}) {
  const {
    projectId,
    status,
    storyId,
    includeCancelled = false,
    refetchInterval = 5000,
  } = options;

  // Get projectId from options or localStorage (try both keys for compatibility)
  const effectiveProjectId = projectId ||
    localStorage.getItem('selectedProjectId') ||
    localStorage.getItem('currentProjectId');

  const { data, isLoading, error, refetch } = useQuery<WorkflowRun[]>({
    queryKey: ['workflow-runs', { projectId: effectiveProjectId, status, storyId, includeCancelled }],
    queryFn: async () => {
      if (!effectiveProjectId) {
        console.warn('No projectId available for workflow runs query');
        return [];
      }

      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (storyId) params.append('storyId', storyId);

      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/projects/${effectiveProjectId}/workflow-runs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workflow runs');
      }
      return response.json();
    },
    refetchInterval,
    enabled: !!effectiveProjectId, // Only run query if we have a projectId
  });

  // Process and sort runs
  const runs = (data || [])
    .filter((run) => includeCancelled || run.status !== 'cancelled')
    .map((run) => ({
      ...run,
      progress: calculateProgress(run),
    }))
    .sort((a, b) => {
      // Sort by status priority: running > failed > pending > completed/paused/cancelled
      const priority = {
        running: 4,
        failed: 3,
        pending: 2,
        completed: 1,
        paused: 1,
        cancelled: 0,
      };
      return priority[b.status] - priority[a.status];
    });

  // Find the currently active (running) run
  const activeRun = runs.find((run) => run.status === 'running') || null;

  return {
    runs,
    activeRun,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Calculate progress percentage from component runs
 */
function calculateProgress(run: WorkflowRun): number {
  if (run.status === 'completed') return 100;
  if (run.status === 'pending') return 0;
  if (!run.componentRuns || run.componentRuns.length === 0) return run.progress || 0;

  const totalComponents = run.componentRuns.length;
  let completedWeight = 0;

  run.componentRuns.forEach((component) => {
    if (component.status === 'completed') {
      completedWeight += 1;
    } else if (component.status === 'running') {
      completedWeight += 0.5; // Running component counts as 50%
    }
    // pending/failed/skipped count as 0
  });

  return Math.round((completedWeight / totalComponents) * 100);
}
