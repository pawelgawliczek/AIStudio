import { useQuery } from '@tanstack/react-query';
import { WorkflowRun, WorkflowRunStatus } from '../types/workflow-tracking';

interface UseWorkflowRunsOptions {
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
    status,
    storyId,
    includeCancelled = false,
    refetchInterval = 5000,
  } = options;

  const { data, isLoading, error, refetch } = useQuery<WorkflowRun[]>({
    queryKey: ['workflow-runs', { status, storyId, includeCancelled }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (storyId) params.append('storyId', storyId);

      const response = await fetch(`/api/workflow-runs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workflow runs');
      }
      return response.json();
    },
    refetchInterval,
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
