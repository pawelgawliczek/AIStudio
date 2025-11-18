/**
 * ST-16 Specific Tests for useAnalysisPolling Hook
 *
 * Purpose: Verify 500ms delay and toast notifications after analysis completion
 * to prevent race conditions and improve UX.
 *
 * Related Requirements:
 * - BR-1 (Real-Time Data Refresh): 500ms delay ensures DB commits complete
 * - Designer Analysis: Toast notifications for analysis status
 * - AC-1: Metrics immediately update after analysis completion
 * - AC-6: Works consistently across multiple analysis runs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysisPolling } from '../useAnalysisPolling';
import axios from '../../lib/axios';
import toast from 'react-hot-toast';

vi.mock('../../lib/axios');
vi.mock('react-hot-toast');

describe('useAnalysisPolling - ST-16 Specific Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('TC-ST16-F1: 500ms delay after analysis completion', () => {
    it('should wait 500ms before calling onAnalysisComplete', async () => {
      const mockOnComplete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'completed', message: 'Analysis complete' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      // Start analysis
      await act(async () => {
        await result.current.startAnalysis();
      });

      // Advance to first poll (3 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // At this point, onComplete should NOT be called yet (waiting for 500ms delay)
      expect(mockOnComplete).not.toHaveBeenCalled();

      // Advance the 500ms delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Now onComplete should be called
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain 500ms delay across multiple analysis runs', async () => {
      const mockOnComplete = vi.fn().mockResolvedValue(undefined);

      for (let run = 0; run < 3; run++) {
        vi.clearAllMocks();
        vi.mocked(axios.post).mockResolvedValue({ data: { jobId: `job-${run}` } });
        vi.mocked(axios.get).mockResolvedValue({
          data: { status: 'completed', message: 'Analysis complete' },
        });

        const { result } = renderHook(() =>
          useAnalysisPolling('test-project-id', mockOnComplete)
        );

        await act(async () => {
          await result.current.startAnalysis();
        });

        // Advance to poll completion
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });

        // Verify delay is respected
        expect(mockOnComplete).not.toHaveBeenCalled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });

        await waitFor(() => {
          expect(mockOnComplete).toHaveBeenCalledTimes(1);
        });
      }
    });
  });

  describe('TC-ST16-F2: Toast notification on analysis success', () => {
    it('should show success toast when analysis completes', async () => {
      const mockOnComplete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'completed', message: 'Analysis complete' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(500);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Analysis complete! Dashboard metrics have been updated.',
          expect.objectContaining({
            duration: 4000,
            position: 'top-right',
          })
        );
      });
    });

    it('should show error toast when analysis fails', async () => {
      const mockOnComplete = vi.fn();
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'failed', message: 'Analysis failed due to syntax error' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Analysis failed due to syntax error',
          expect.objectContaining({
            duration: 5000,
            position: 'top-right',
          })
        );
      });
    });

    it('should show error toast with default message when no message provided', async () => {
      const mockOnComplete = vi.fn();
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'failed' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Analysis failed. Please try again.',
          expect.objectContaining({
            duration: 5000,
          })
        );
      });
    });

    it('should show error toast when analysis start fails', async () => {
      const mockOnComplete = vi.fn();
      vi.mocked(axios.post).mockRejectedValue({
        response: { data: { message: 'Project not found' } },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Project not found',
          expect.objectContaining({
            duration: 5000,
            position: 'top-right',
          })
        );
      });
    });
  });

  describe('TC-ST16-F3: Complete flow with delay and notifications', () => {
    it('should execute full flow: start → poll → delay → notify → complete', async () => {
      const mockOnComplete = vi.fn().mockResolvedValue(undefined);
      const timeline: string[] = [];

      vi.mocked(axios.post).mockImplementation(async () => {
        timeline.push('start_analysis');
        return { data: { jobId: 'job-123' } };
      });

      vi.mocked(axios.get).mockImplementation(async () => {
        timeline.push('poll_status');
        return { data: { status: 'completed', message: 'Done' } };
      });

      mockOnComplete.mockImplementation(async () => {
        timeline.push('on_complete_called');
      });

      vi.mocked(toast.success).mockImplementation(() => {
        timeline.push('toast_shown');
        return 'toast-id' as any;
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      expect(timeline).toContain('start_analysis');

      // Advance to poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(timeline).toContain('poll_status');

      // Advance delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      await waitFor(() => {
        expect(timeline).toContain('on_complete_called');
        expect(timeline).toContain('toast_shown');
      });

      // Verify correct order: start → poll → complete → toast
      const startIdx = timeline.indexOf('start_analysis');
      const pollIdx = timeline.indexOf('poll_status');
      const completeIdx = timeline.indexOf('on_complete_called');
      const toastIdx = timeline.indexOf('toast_shown');

      expect(startIdx).toBeLessThan(pollIdx);
      expect(pollIdx).toBeLessThan(completeIdx);
      expect(completeIdx).toBeLessThan(toastIdx);
    });
  });

  describe('TC-ST16-F4: Race condition prevention', () => {
    it('should prevent race condition by delaying data fetch', async () => {
      let dbWriteComplete = false;

      // Simulate DB write completing during the 500ms delay
      const mockOnComplete = vi.fn().mockImplementation(async () => {
        // This should be called AFTER the 500ms delay
        // During which the DB write completes
        expect(dbWriteComplete).toBe(true);
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'completed', message: 'Done' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      // Advance to poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Simulate DB write completing during delay
      setTimeout(() => {
        dbWriteComplete = true;
      }, 250); // Completes 250ms into the 500ms delay

      // Advance the delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should not call onComplete if poll fails before delay', async () => {
      const mockOnComplete = vi.fn();
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { status: 'failed', message: 'Error' },
      });

      const { result } = renderHook(() =>
        useAnalysisPolling('test-project-id', mockOnComplete)
      );

      await act(async () => {
        await result.current.startAnalysis();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(500);
      });

      // Should NOT call onComplete for failed analysis
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });
});
