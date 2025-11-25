import { useQuery } from '@tanstack/react-query';
import axios from '../lib/axios';
import { WorkflowRun, WorkflowRunStatus, ComponentRun } from '../types/workflow-tracking';

interface UseWorkflowRunsOptions {
  projectId?: string;
  status?: WorkflowRunStatus;
  storyId?: string;
  includeCancelled?: boolean;
  includeCompleted?: boolean;
  refetchInterval?: number;
}

// API response type (what the backend actually returns)
interface ApiWorkflowRun {
  id: string;
  projectId: string;
  workflowId: string;
  storyId?: string;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  story?: {
    id: string;
    key: string;
    title: string;
  };
  workflow?: {
    id: string;
    name: string;
    version: string;
  };
  componentRuns?: Array<{
    id: string;
    componentId: string;
    componentName: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
  }>;
}

/**
 * Transform API response to frontend WorkflowRun type
 */
function transformApiResponse(apiRun: ApiWorkflowRun): WorkflowRun {
  const componentRuns: ComponentRun[] = (apiRun.componentRuns || []).map(cr => ({
    id: cr.id,
    componentId: cr.componentId,
    componentName: cr.componentName,
    status: cr.status as ComponentRun['status'],
    startedAt: cr.startedAt,
    completedAt: cr.finishedAt || null,
    output: null,
    errorMessage: null,
  }));

  // Calculate elapsed time - handle null/undefined startedAt gracefully
  let elapsedTimeMs = 0;
  const startedAtStr = apiRun.startedAt || apiRun.createdAt;
  if (startedAtStr) {
    const startedAtTime = new Date(startedAtStr).getTime();
    if (!isNaN(startedAtTime)) {
      if (apiRun.finishedAt) {
        const finishedAtTime = new Date(apiRun.finishedAt).getTime();
        if (!isNaN(finishedAtTime)) {
          elapsedTimeMs = finishedAtTime - startedAtTime;
        }
      } else {
        elapsedTimeMs = Date.now() - startedAtTime;
      }
    }
  }
  // Use durationSeconds if available and elapsedTimeMs is still 0
  if (elapsedTimeMs === 0 && apiRun.durationSeconds) {
    elapsedTimeMs = apiRun.durationSeconds * 1000;
  }

  // Find current running component
  const runningComponent = componentRuns.find(c => c.status === 'running');

  // Extract story info - handle both nested story object and flat fields
  const storyKey = apiRun.story?.key || `Run-${apiRun.id.slice(0, 8)}`;
  const storyTitle = apiRun.story?.title || apiRun.workflow?.name || 'Workflow Run';

  return {
    id: apiRun.id,
    workflowId: apiRun.workflowId,
    storyId: apiRun.storyId || '',
    storyKey,
    storyTitle,
    status: apiRun.status,
    progress: 0, // Will be calculated by calculateProgress
    currentComponent: runningComponent?.componentName || null,
    branchName: null, // Not in API yet
    worktreePath: null, // Not in API yet
    queueStatus: null, // Not in API yet
    queuePosition: null,
    queuePriority: null,
    queueWaitTimeMs: null,
    queueLocked: false,
    startedAt: apiRun.startedAt || apiRun.createdAt,
    completedAt: apiRun.finishedAt || null,
    elapsedTimeMs,
    estimatedTimeRemainingMs: null,
    componentRuns,
    recentOutputs: [],
    transcriptPath: null,
    commitsAhead: null,
    commitsBehind: null,
  };
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
    includeCompleted = false,
    refetchInterval = 5000,
  } = options;

  // Get projectId from options or localStorage (try both keys for compatibility)
  const effectiveProjectId = projectId ||
    localStorage.getItem('selectedProjectId') ||
    localStorage.getItem('currentProjectId');

  const { data, isLoading, error, refetch } = useQuery<WorkflowRun[]>({
    queryKey: ['workflow-runs', { projectId: effectiveProjectId, status, storyId, includeCancelled, includeCompleted }],
    queryFn: async () => {
      if (!effectiveProjectId) {
        console.warn('No projectId available for workflow runs query');
        return [];
      }

      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (storyId) params.append('storyId', storyId);
      // Always include relations to get story key/title
      params.append('includeRelations', 'true');

      // Use authenticated axios instance
      const response = await axios.get<ApiWorkflowRun[]>(
        `/projects/${effectiveProjectId}/workflow-runs?${params.toString()}`
      );

      // Transform API response to frontend types
      return response.data.map(transformApiResponse);
    },
    refetchInterval,
    enabled: !!effectiveProjectId, // Only run query if we have a projectId
  });

  // Process and sort runs - filter out completed/cancelled unless explicitly requested
  const runs = (data || [])
    .filter((run) => {
      if (!includeCancelled && run.status === 'cancelled') return false;
      if (!includeCompleted && run.status === 'completed') return false;
      return true;
    })
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
