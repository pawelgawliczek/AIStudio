/**
 * Tests for useAnalysisPolling hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from '../../lib/axios';
import { useAnalysisPolling } from '../useAnalysisPolling';

vi.mock('../../lib/axios');

describe('useAnalysisPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with correct default state', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisStatus).toBeNull();
    expect(result.current.analysisJobId).toBeNull();
    expect(result.current.showAnalysisNotification).toBe(false);
    expect(result.current.showAnalysisResultsModal).toBe(false);
  });

  it('should provide all required functions', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    expect(typeof result.current.startAnalysis).toBe('function');
    expect(typeof result.current.dismissNotification).toBe('function');
    expect(typeof result.current.closeResultsModal).toBe('function');
  });

  it('should start analysis and set analyzing state', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: 'running', message: 'Analysis in progress' },
    });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    expect(result.current.isAnalyzing).toBe(true);
    expect(result.current.analysisJobId).toBe('job-123');
    expect(result.current.analysisStatus?.status).toBe('running');
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
      '/code-metrics/project/test-project-id/analyze',
      {}
    );
  });

  it('should poll status and complete analysis successfully', async () => {
    const mockOnComplete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: { status: 'running', message: 'Analysis in progress' },
      })
      .mockResolvedValueOnce({
        data: { status: 'completed', message: 'Analysis complete' },
      });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    expect(result.current.isAnalyzing).toBe(true);

    // Fast-forward polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(false);
    });

    expect(mockOnComplete).toHaveBeenCalled();
    expect(result.current.showAnalysisNotification).toBe(true);
    expect(result.current.showAnalysisResultsModal).toBe(true);
    expect(result.current.analysisStatus?.status).toBe('completed');
  });

  it('should handle analysis failure', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: 'failed', message: 'Analysis failed' },
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
      expect(result.current.isAnalyzing).toBe(false);
    });

    expect(result.current.analysisStatus?.status).toBe('failed');
    expect(result.current.showAnalysisNotification).toBe(true);
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it('should handle timeout after max duration', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: 'running', message: 'Still running' },
    });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    // Fast-forward to timeout (5 minutes)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });

    await waitFor(() => {
      expect(result.current.analysisStatus?.status).toBe('failed');
    });

    expect(result.current.analysisStatus?.message).toContain('timeout');
  });

  it('should handle start analysis API error', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockRejectedValue({
      response: { data: { message: 'API error' } },
    });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisStatus?.status).toBe('failed');
    expect(result.current.analysisStatus?.message).toBe('API error');
  });

  it('should not start analysis when already analyzing', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: 'running' },
    });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    const firstCallCount = vi.mocked(axios.post).mock.calls.length;

    await act(async () => {
      await result.current.startAnalysis();
    });

    expect(vi.mocked(axios.post).mock.calls.length).toBe(firstCallCount);
  });

  it('should not start analysis when projectId is undefined', async () => {
    const mockOnComplete = vi.fn();

    const { result } = renderHook(() =>
      useAnalysisPolling(undefined, mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    expect(vi.mocked(axios.post)).not.toHaveBeenCalled();
  });

  it('should dismiss notification', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    act(() => {
      result.current.dismissNotification();
    });

    expect(result.current.showAnalysisNotification).toBe(false);
  });

  it('should close results modal', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    act(() => {
      result.current.closeResultsModal();
    });

    expect(result.current.showAnalysisResultsModal).toBe(false);
  });

  it('should continue polling on status check error', async () => {
    const mockOnComplete = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { jobId: 'job-123' },
    });
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: { status: 'completed', message: 'Done' },
      });

    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    await act(async () => {
      await result.current.startAnalysis();
    });

    // First poll fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Second poll succeeds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(false);
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });
});
