import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  runnerService,
  RunnerStatus,
  StartRunnerParams,
  RepeatStepParams,
  AdvanceStepParams,
} from '../../../services/runner.service';

/**
 * useRunnerControl Hook
 * ST-195: Workflow Control & Results Dashboard
 *
 * React Query hook for workflow runner control operations.
 * Provides status query with auto-refresh and mutations for all control actions.
 */

export interface UseRunnerControlOptions {
  runId: string;
  enabled?: boolean;
  refetchInterval?: number; // Auto-refresh interval in ms (default: 5000)
}

export interface UseRunnerControlReturn {
  // Status query
  status: RunnerStatus | undefined;
  isLoadingStatus: boolean;
  statusError: Error | null;

  // Control mutations
  pause: (reason?: string) => Promise<void>;
  resume: () => Promise<void>;
  repeat: (params: RepeatStepParams) => Promise<void>;
  advance: (params: AdvanceStepParams) => Promise<void>;
  cancel: (reason?: string) => Promise<void>;

  // Loading states
  isPausing: boolean;
  isResuming: boolean;
  isRepeating: boolean;
  isAdvancing: boolean;
  isCancelling: boolean;
}

export function useRunnerControl({
  runId,
  enabled = true,
  refetchInterval = 5000,
}: UseRunnerControlOptions): UseRunnerControlReturn {
  const queryClient = useQueryClient();

  // Status query with auto-refresh
  const {
    data: status,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useQuery({
    queryKey: ['runner-status', runId],
    queryFn: () => runnerService.getStatus(runId),
    enabled,
    refetchInterval,
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: (reason?: string) => runnerService.pauseRunner(runId, reason),
    onSuccess: () => {
      // Invalidate status query to refetch
      queryClient.invalidateQueries({ queryKey: ['runner-status', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: () => runnerService.resumeRunner(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runner-status', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
    },
  });

  // Repeat step mutation
  const repeatMutation = useMutation({
    mutationFn: (params: RepeatStepParams) => runnerService.repeatStep(runId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runner-status', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
    },
  });

  // Advance step mutation
  const advanceMutation = useMutation({
    mutationFn: (params: AdvanceStepParams) => runnerService.advanceStep(runId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runner-status', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
    },
  });

  // Cancel mutation (ST-202)
  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => runnerService.cancelRunner(runId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runner-status', runId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
    },
  });

  // Wrapper functions
  const pause = async (reason?: string) => {
    await pauseMutation.mutateAsync(reason);
  };

  const resume = async () => {
    await resumeMutation.mutateAsync();
  };

  const repeat = async (params: RepeatStepParams) => {
    await repeatMutation.mutateAsync(params);
  };

  const advance = async (params: AdvanceStepParams) => {
    await advanceMutation.mutateAsync(params);
  };

  const cancel = async (reason?: string) => {
    await cancelMutation.mutateAsync(reason);
  };

  return {
    // Status query
    status,
    isLoadingStatus,
    statusError: statusError as Error | null,

    // Control mutations
    pause,
    resume,
    repeat,
    advance,
    cancel,

    // Loading states
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isRepeating: repeatMutation.isPending,
    isAdvancing: advanceMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
