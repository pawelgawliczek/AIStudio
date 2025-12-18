import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { workflowRunsService, RunStatus } from '../../services/workflow-runs.service';
import { useTeamRunsList } from '../useTeamRunsList';

// Mock the workflow runs service
vi.mock('../../services/workflow-runs.service', () => ({
  workflowRunsService: {
    getAll: vi.fn(),
  },
  RunStatus: {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

const mockRuns = [
  {
    id: 'run-1',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    storyId: 'story-1',
    startedAt: '2024-01-01T10:00:00.000Z',
    durationSeconds: 120,
    totalTokens: 1000,
    estimatedCost: 0.05,
    status: RunStatus.COMPLETED,
    workflow: {
      id: 'workflow-1',
      name: 'Test Workflow',
      version: '1.0.0',
    },
    story: {
      id: 'story-1',
      key: 'ST-123',
      title: 'Test Story',
    },
  },
  {
    id: 'run-2',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    storyId: 'story-1',
    startedAt: '2024-01-01T09:00:00.000Z',
    durationSeconds: 90,
    totalTokens: 800,
    estimatedCost: 0.04,
    status: RunStatus.FAILED,
    workflow: {
      id: 'workflow-1',
      name: 'Test Workflow',
      version: '1.0.0',
    },
    story: {
      id: 'story-1',
      key: 'ST-123',
      title: 'Test Story',
    },
  },
  {
    id: 'run-3',
    projectId: 'project-1',
    workflowId: 'workflow-2',
    storyId: 'story-2',
    startedAt: '2024-01-02T10:00:00.000Z',
    durationSeconds: 200,
    totalTokens: 1500,
    estimatedCost: 0.08,
    status: RunStatus.RUNNING,
    workflow: {
      id: 'workflow-2',
      name: 'Another Workflow',
      version: '1.0.0',
    },
    story: {
      id: 'story-2',
      key: 'ST-456',
      title: 'Another Story',
    },
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useTeamRunsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (workflowRunsService.getAll as any).mockResolvedValue(mockRuns);
  });

  it('fetches and returns all runs', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.runs).toHaveLength(3);
    expect(result.current.allRuns).toHaveLength(3);
  });

  it('filters runs by status', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Filter by COMPLETED status
    result.current.filters.setSelectedStatus(RunStatus.COMPLETED);

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].status).toBe(RunStatus.COMPLETED);
    });
  });

  it('filters runs by team', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Filter by workflow-2
    result.current.filters.setSelectedTeam('workflow-2');

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].workflowId).toBe('workflow-2');
    });
  });

  it('filters runs by date', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Filter by date
    result.current.filters.setDateFilter('2024-01-02');

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].id).toBe('run-3');
    });
  });

  it('filters outstanding runs only', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Filter outstanding only (FAILED, RUNNING, PENDING)
    result.current.filters.setShowOutstandingOnly(true);

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(2);
      expect(result.current.runs.every(r =>
        r.status === RunStatus.FAILED ||
        r.status === RunStatus.RUNNING ||
        r.status === RunStatus.PENDING
      )).toBe(true);
    });
  });

  it('filters runs by search query (story key)', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Search by story key
    result.current.filters.setSearchQuery('ST-456');

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].story?.key).toBe('ST-456');
    });
  });

  it('filters runs by search query (story title)', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Search by story title (case insensitive)
    result.current.filters.setSearchQuery('another');

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].story?.title).toBe('Another Story');
    });
  });

  it('sorts runs by newest (default)', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.runs[0].id).toBe('run-3'); // Most recent
    expect(result.current.runs[2].id).toBe('run-2'); // Oldest
  });

  it('sorts runs by oldest', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.filters.setSortBy('oldest');

    await waitFor(() => {
      expect(result.current.runs[0].id).toBe('run-2'); // Oldest
      expect(result.current.runs[2].id).toBe('run-3'); // Most recent
    });
  });

  it('sorts runs by duration', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.filters.setSortBy('duration');

    await waitFor(() => {
      expect(result.current.runs[0].durationSeconds).toBe(200); // Longest
      expect(result.current.runs[2].durationSeconds).toBe(90); // Shortest
    });
  });

  it('sorts runs by cost', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.filters.setSortBy('cost');

    await waitFor(() => {
      expect(result.current.runs[0].estimatedCost).toBe(0.08); // Highest
      expect(result.current.runs[2].estimatedCost).toBe(0.04); // Lowest
    });
  });

  it('extracts unique teams from runs', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teams).toHaveLength(2);
    expect(result.current.teams.find(t => t.id === 'workflow-1')).toEqual({
      id: 'workflow-1',
      name: 'Test Workflow',
    });
    expect(result.current.teams.find(t => t.id === 'workflow-2')).toEqual({
      id: 'workflow-2',
      name: 'Another Workflow',
    });
  });

  it('clears all filters', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Set all filters
    result.current.filters.setSelectedStatus(RunStatus.COMPLETED);
    result.current.filters.setSelectedTeam('workflow-1');
    result.current.filters.setDateFilter('2024-01-01');
    result.current.filters.setShowOutstandingOnly(true);
    result.current.filters.setSortBy('cost');
    result.current.filters.setSearchQuery('test');

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(true);
    });

    // Clear filters
    result.current.clearFilters();

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.filters.selectedStatus).toBe('all');
      expect(result.current.filters.selectedTeam).toBe('all');
      expect(result.current.filters.dateFilter).toBe('');
      expect(result.current.filters.showOutstandingOnly).toBe(false);
      expect(result.current.filters.sortBy).toBe('newest');
      expect(result.current.filters.searchQuery).toBe('');
    });
  });

  it('tracks hasActiveFilters correctly', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initially no filters
    expect(result.current.hasActiveFilters).toBe(false);

    // Set a filter
    result.current.filters.setSelectedStatus(RunStatus.COMPLETED);

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  it('combines multiple filters correctly', async () => {
    const { result } = renderHook(
      () => useTeamRunsList({ projectId: 'project-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Apply multiple filters
    result.current.filters.setSelectedTeam('workflow-1');
    result.current.filters.setSelectedStatus(RunStatus.COMPLETED);

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.runs[0].id).toBe('run-1');
      expect(result.current.runs[0].status).toBe(RunStatus.COMPLETED);
      expect(result.current.runs[0].workflowId).toBe('workflow-1');
    });
  });
});
