import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowRun } from '../../types/workflow-tracking';
import { useWorkflowRuns } from '../useWorkflowRuns';

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';

const mockRun: WorkflowRun = {
  id: 'run-1',
  workflowId: 'wf-1',
  storyId: 'story-1',
  storyKey: 'ST-53',
  storyTitle: 'Multi-Run Progress Tracker',
  status: 'running',
  progress: 45,
  currentComponent: 'Implementer',
  branchName: 'st-53-multi-run-tracker',
  worktreePath: '/opt/stack/worktrees/st-53-multi-run-tracker',
  queueStatus: 'running',
  queuePosition: 1,
  queuePriority: 5,
  queueWaitTimeMs: 0,
  queueLocked: false,
  startedAt: new Date().toISOString(),
  completedAt: null,
  elapsedTimeMs: 120000,
  estimatedTimeRemainingMs: 180000,
  componentRuns: [],
  recentOutputs: [],
  transcriptPath: null,
  commitsAhead: null,
  commitsBehind: null,
};

describe('useWorkflowRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    (useQuery as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.runs).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('returns runs data when loaded', () => {
    (useQuery as any).mockReturnValue({
      data: [mockRun],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.runs).toEqual([mockRun]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns error when fetch fails', () => {
    const error = new Error('Failed to fetch');
    (useQuery as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.runs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('sorts runs by status priority', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'completed' },
      { ...mockRun, id: '2', status: 'running' },
      { ...mockRun, id: '3', status: 'failed' },
      { ...mockRun, id: '4', status: 'pending' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    // Expected order: running > failed > pending > completed
    expect(result.current.runs[0].status).toBe('running');
    expect(result.current.runs[1].status).toBe('failed');
    expect(result.current.runs[2].status).toBe('pending');
    expect(result.current.runs[3].status).toBe('completed');
  });

  it('filters out cancelled runs by default', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'running' },
      { ...mockRun, id: '2', status: 'cancelled' },
      { ...mockRun, id: '3', status: 'completed' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.runs).toHaveLength(2);
    expect(result.current.runs.every(r => r.status !== 'cancelled')).toBe(true);
  });

  it('includes cancelled runs when includeCancelled is true', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'running' },
      { ...mockRun, id: '2', status: 'cancelled' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns({ includeCancelled: true }));

    expect(result.current.runs).toHaveLength(2);
  });

  it('refetches data on interval', async () => {
    const mockRefetch = vi.fn();
    (useQuery as any).mockReturnValue({
      data: [mockRun],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderHook(() => useWorkflowRuns());

    // Wait for refetch interval (default 5 seconds)
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    }, { timeout: 6000 });
  });

  it('calculates progress from component runs', () => {
    const runWithComponents: WorkflowRun = {
      ...mockRun,
      componentRuns: [
        { id: '1', componentId: 'c1', componentName: 'PM', status: 'completed', startedAt: '', completedAt: '', output: null, errorMessage: null },
        { id: '2', componentId: 'c2', componentName: 'Explorer', status: 'completed', startedAt: '', completedAt: '', output: null, errorMessage: null },
        { id: '3', componentId: 'c3', componentName: 'Architect', status: 'running', startedAt: '', completedAt: null, output: null, errorMessage: null },
        { id: '4', componentId: 'c4', componentName: 'Implementer', status: 'pending', startedAt: null, completedAt: null, output: null, errorMessage: null },
      ],
    };

    (useQuery as any).mockReturnValue({
      data: [runWithComponents],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    // 2 completed + 0.5 running = 2.5 / 4 = 62.5%
    expect(result.current.runs[0].progress).toBe(62.5);
  });

  it('finds active run', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'completed' },
      { ...mockRun, id: '2', status: 'running' },
      { ...mockRun, id: '3', status: 'pending' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.activeRun?.id).toBe('2');
    expect(result.current.activeRun?.status).toBe('running');
  });

  it('returns null for activeRun when no runs are active', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'completed' },
      { ...mockRun, id: '2', status: 'failed' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns());

    expect(result.current.activeRun).toBe(null);
  });

  it('filters by status', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', status: 'running' },
      { ...mockRun, id: '2', status: 'completed' },
      { ...mockRun, id: '3', status: 'failed' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns({ status: 'running' }));

    expect(result.current.runs).toHaveLength(1);
    expect(result.current.runs[0].status).toBe('running');
  });

  it('filters by storyId', () => {
    const runs: WorkflowRun[] = [
      { ...mockRun, id: '1', storyId: 'story-1' },
      { ...mockRun, id: '2', storyId: 'story-2' },
      { ...mockRun, id: '3', storyId: 'story-1' },
    ];

    (useQuery as any).mockReturnValue({
      data: runs,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowRuns({ storyId: 'story-1' }));

    expect(result.current.runs).toHaveLength(2);
    expect(result.current.runs.every(r => r.storyId === 'story-1')).toBe(true);
  });
});
