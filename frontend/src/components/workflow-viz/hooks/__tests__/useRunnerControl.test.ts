/**
 * Unit tests for useRunnerControl hook
 * ST-195: Workflow Control & Results Dashboard
 *
 * Tests TDD - written BEFORE implementation
 * Expected: ALL TESTS WILL FAIL (implementation doesn't exist yet)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunnerControl } from '../useRunnerControl';
import * as runnerService from '../../../../services/runner.service';

vi.mock('../../../../services/runner.service');

describe('useRunnerControl', () => {
  let queryClient: QueryClient;

  const mockRunId = 'run-123';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('TC-HOOK-001: Status query', () => {
    it('should fetch runner status on mount', async () => {
      const mockStatus = {
        runId: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
      };

      vi.mocked(runnerService.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      await waitFor(() => {
        expect(result.current.status.isSuccess).toBe(true);
      });

      expect(result.current.status.data).toEqual(mockStatus);
      expect(runnerService.getStatus).toHaveBeenCalledWith(mockRunId);
    });

    it('should auto-refresh status every 5 seconds', async () => {
      const mockStatus = {
        runId: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
      };

      vi.mocked(runnerService.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      await waitFor(() => {
        expect(result.current.status.isSuccess).toBe(true);
      });

      expect(runnerService.getStatus).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle status fetch errors', async () => {
      vi.mocked(runnerService.getStatus).mockRejectedValue(new Error('Not found'));

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      await waitFor(() => {
        expect(result.current.status.isError).toBe(true);
      });

      expect(result.current.status.error).toEqual(new Error('Not found'));
    });

    it('should disable auto-refresh when workflow completed', async () => {
      const mockStatus = {
        runId: mockRunId,
        status: 'completed',
      };

      vi.mocked(runnerService.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      await waitFor(() => {
        expect(result.current.status.isSuccess).toBe(true);
      });

      expect(runnerService.getStatus).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Should not refetch for completed workflows
      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('TC-HOOK-002: Pause mutation', () => {
    it('should pause workflow', async () => {
      vi.mocked(runnerService.pauseRunner).mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'paused',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.pauseMutation.mutate({ reason: 'Testing' });

      await waitFor(() => {
        expect(result.current.pauseMutation.isSuccess).toBe(true);
      });

      expect(runnerService.pauseRunner).toHaveBeenCalledWith(mockRunId, { reason: 'Testing' });
    });

    it('should invalidate status query after pause', async () => {
      vi.mocked(runnerService.pauseRunner).mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'paused',
      });

      vi.mocked(runnerService.getStatus).mockResolvedValue({
        runId: mockRunId,
        status: 'paused',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.pauseMutation.mutate({});

      await waitFor(() => {
        expect(result.current.pauseMutation.isSuccess).toBe(true);
      });

      // Status query should be invalidated and refetched
      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalled();
      });
    });

    it('should handle pause errors', async () => {
      vi.mocked(runnerService.pauseRunner).mockRejectedValue(new Error('Not running'));

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.pauseMutation.mutate({});

      await waitFor(() => {
        expect(result.current.pauseMutation.isError).toBe(true);
      });

      expect(result.current.pauseMutation.error).toEqual(new Error('Not running'));
    });
  });

  describe('TC-HOOK-003: Resume mutation', () => {
    it('should resume workflow', async () => {
      vi.mocked(runnerService.resumeRunner).mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'running',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.resumeMutation.mutate();

      await waitFor(() => {
        expect(result.current.resumeMutation.isSuccess).toBe(true);
      });

      expect(runnerService.resumeRunner).toHaveBeenCalledWith(mockRunId);
    });

    it('should invalidate status query after resume', async () => {
      vi.mocked(runnerService.resumeRunner).mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'running',
      });

      vi.mocked(runnerService.getStatus).mockResolvedValue({
        runId: mockRunId,
        status: 'running',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.resumeMutation.mutate();

      await waitFor(() => {
        expect(result.current.resumeMutation.isSuccess).toBe(true);
      });

      // Status query should be invalidated and refetched
      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalled();
      });
    });

    it('should handle resume errors', async () => {
      vi.mocked(runnerService.resumeRunner).mockRejectedValue(new Error('Not paused'));

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.resumeMutation.mutate();

      await waitFor(() => {
        expect(result.current.resumeMutation.isError).toBe(true);
      });

      expect(result.current.resumeMutation.error).toEqual(new Error('Not paused'));
    });
  });

  describe('TC-HOOK-004: Repeat mutation', () => {
    it('should repeat current step with feedback', async () => {
      vi.mocked(runnerService.repeatStep).mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-1',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.repeatMutation.mutate({
        feedback: 'Fix the tests',
      });

      await waitFor(() => {
        expect(result.current.repeatMutation.isSuccess).toBe(true);
      });

      expect(runnerService.repeatStep).toHaveBeenCalledWith(mockRunId, {
        feedback: 'Fix the tests',
      });
    });

    it('should invalidate status query after repeat', async () => {
      vi.mocked(runnerService.repeatStep).mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-1',
      });

      vi.mocked(runnerService.getStatus).mockResolvedValue({
        runId: mockRunId,
        status: 'running',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.repeatMutation.mutate({ feedback: 'Retry' });

      await waitFor(() => {
        expect(result.current.repeatMutation.isSuccess).toBe(true);
      });

      // Status query should be invalidated and refetched
      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalled();
      });
    });

    it('should handle repeat errors', async () => {
      vi.mocked(runnerService.repeatStep).mockRejectedValue(new Error('Invalid state'));

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.repeatMutation.mutate({ feedback: 'Retry' });

      await waitFor(() => {
        expect(result.current.repeatMutation.isError).toBe(true);
      });

      expect(result.current.repeatMutation.error).toEqual(new Error('Invalid state'));
    });
  });

  describe('TC-HOOK-005: Advance mutation', () => {
    it('should advance to next state', async () => {
      vi.mocked(runnerService.advanceStep).mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-2',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.advanceMutation.mutate({});

      await waitFor(() => {
        expect(result.current.advanceMutation.isSuccess).toBe(true);
      });

      expect(runnerService.advanceStep).toHaveBeenCalledWith(mockRunId, {});
    });

    it('should skip to specific state', async () => {
      vi.mocked(runnerService.advanceStep).mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-3',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.advanceMutation.mutate({
        skipToState: 'state-3',
      });

      await waitFor(() => {
        expect(result.current.advanceMutation.isSuccess).toBe(true);
      });

      expect(runnerService.advanceStep).toHaveBeenCalledWith(mockRunId, {
        skipToState: 'state-3',
      });
    });

    it('should invalidate status query after advance', async () => {
      vi.mocked(runnerService.advanceStep).mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-2',
      });

      vi.mocked(runnerService.getStatus).mockResolvedValue({
        runId: mockRunId,
        status: 'running',
        currentStateId: 'state-2',
      });

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.advanceMutation.mutate({});

      await waitFor(() => {
        expect(result.current.advanceMutation.isSuccess).toBe(true);
      });

      // Status query should be invalidated and refetched
      await waitFor(() => {
        expect(runnerService.getStatus).toHaveBeenCalled();
      });
    });

    it('should handle advance errors', async () => {
      vi.mocked(runnerService.advanceStep).mockRejectedValue(new Error('Already at last state'));

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.advanceMutation.mutate({});

      await waitFor(() => {
        expect(result.current.advanceMutation.isError).toBe(true);
      });

      expect(result.current.advanceMutation.error).toEqual(new Error('Already at last state'));
    });
  });

  describe('TC-HOOK-006: Loading states', () => {
    it('should track loading state for status query', async () => {
      vi.mocked(runnerService.getStatus).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ runId: mockRunId, status: 'running' }), 100))
      );

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      expect(result.current.status.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.status.isLoading).toBe(false);
      });
    });

    it('should track loading state for mutations', async () => {
      vi.mocked(runnerService.pauseRunner).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, runId: mockRunId, status: 'paused' }), 100))
      );

      const { result } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      result.current.pauseMutation.mutate({});

      expect(result.current.pauseMutation.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.pauseMutation.isLoading).toBe(false);
      });
    });
  });

  describe('TC-HOOK-007: Hook cleanup', () => {
    it('should cleanup on unmount', async () => {
      const { unmount } = renderHook(() => useRunnerControl(mockRunId), { wrapper });

      unmount();

      // Query should be removed from cache
      expect(queryClient.getQueryData(['runner-status', mockRunId])).toBeUndefined();
    });
  });
});
