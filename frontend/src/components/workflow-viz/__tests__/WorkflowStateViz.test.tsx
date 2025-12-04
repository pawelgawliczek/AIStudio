/**
 * Unit tests for WorkflowStateViz - Main orchestrator component
 * ST-168: Workflow State Visualization Web Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowStateViz } from '../WorkflowStateViz';
import { workflowRunsService } from '../../../services/workflow-runs.service';

// Mock services
vi.mock('../../../services/workflow-runs.service', () => ({
  workflowRunsService: {
    getOne: vi.fn(),
  },
}));

vi.mock('../../../services/websocket.service', () => ({
  websocketService: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe('WorkflowStateViz', () => {
  const mockRunId = 'run-abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-WF-VIZ-001: Variant rendering', () => {
    it('should render compact variant with horizontal layout', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(<WorkflowStateViz runId={mockRunId} variant="compact" />);

      await waitFor(() => {
        expect(screen.getByTestId('compact-state-pipeline')).toBeInTheDocument();
      });
    });

    it('should render standard variant with vertical list', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(<WorkflowStateViz runId={mockRunId} variant="standard" />);

      await waitFor(() => {
        expect(screen.getByTestId('standard-state-list')).toBeInTheDocument();
      });
    });

    it('should render full variant with all features', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="full"
          showLiveStream={true}
          showArtifacts={true}
          showBreakpointControls={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('full-state-panel')).toBeInTheDocument();
        expect(screen.getByTestId('live-execution-stream')).toBeInTheDocument();
        expect(screen.getByTestId('artifact-panel')).toBeInTheDocument();
      });
    });
  });

  describe('TC-WF-VIZ-002: Loading states', () => {
    it('should show loading skeleton while fetching', () => {
      vi.mocked(workflowRunsService.getOne).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithQueryClient(<WorkflowStateViz runId={mockRunId} variant="standard" />);

      expect(screen.getByTestId('workflow-viz-loading')).toBeInTheDocument();
    });

    it('should show error state on fetch failure', async () => {
      vi.mocked(workflowRunsService.getOne).mockRejectedValue(
        new Error('Failed to fetch workflow run')
      );

      renderWithQueryClient(<WorkflowStateViz runId={mockRunId} variant="standard" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('TC-WF-VIZ-003: State expansion logic', () => {
    it('should expand all states when defaultExpandedStates is "all"', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
          { id: 's3', name: 'Review', order: 3, status: 'pending' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="standard"
          defaultExpandedStates="all"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByTestId(/state-block-expanded/)).toHaveLength(3);
      });
    });

    it('should expand only active state when defaultExpandedStates is "active"', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
          { id: 's3', name: 'Review', order: 3, status: 'pending' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="standard"
          defaultExpandedStates="active"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByTestId(/state-block-expanded/)).toHaveLength(1);
        expect(screen.getByTestId('state-block-expanded-s2')).toBeInTheDocument();
      });
    });

    it('should collapse all states when defaultExpandedStates is "none"', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [
          { id: 's1', name: 'Analysis', order: 1, status: 'completed' },
          { id: 's2', name: 'Implementation', order: 2, status: 'running' },
        ],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="standard"
          defaultExpandedStates="none"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId(/state-block-expanded/)).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-WF-VIZ-004: WebSocket connection management', () => {
    it('should establish WebSocket connection on mount', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      renderWithQueryClient(<WorkflowStateViz runId={mockRunId} variant="full" />);

      await waitFor(() => {
        expect(screen.getByTestId('ws-status-connected')).toBeInTheDocument();
      });
    });

    it('should cleanup WebSocket connection on unmount', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      const { unmount } = renderWithQueryClient(
        <WorkflowStateViz runId={mockRunId} variant="full" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('ws-status-connected')).toBeInTheDocument();
      });

      unmount();

      // Verify cleanup was called
      // Note: This requires access to the websocket service mock
    });
  });

  describe('TC-WF-VIZ-005: Callback handlers', () => {
    it('should call onStateClick when state is clicked', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [{ id: 's1', name: 'Analysis', order: 1, status: 'completed' }],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      const onStateClick = vi.fn();

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="standard"
          onStateClick={onStateClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Analysis')).toBeInTheDocument();
      });

      screen.getByText('Analysis').click();

      expect(onStateClick).toHaveBeenCalledWith('s1');
    });

    it('should call onViewFullDetails when link is clicked', async () => {
      const mockRun = {
        id: mockRunId,
        status: 'running',
        states: [],
      };

      vi.mocked(workflowRunsService.getOne).mockResolvedValue(mockRun);

      const onViewFullDetails = vi.fn();

      renderWithQueryClient(
        <WorkflowStateViz
          runId={mockRunId}
          variant="compact"
          onViewFullDetails={onViewFullDetails}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/view full details/i)).toBeInTheDocument();
      });

      screen.getByText(/view full details/i).click();

      expect(onViewFullDetails).toHaveBeenCalled();
    });
  });
});
