import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GlobalWorkflowTrackingBar } from '../GlobalWorkflowTrackingBar';
import * as api from '../../../services/api';

// Mock the API module
vi.mock('../../../services/api', () => ({
  getActiveWorkflowForProject: vi.fn(),
}));

// Mock the workflow-viz module
vi.mock('../../workflow-viz', () => ({
  CompactStatePipeline: () => null,
  useWorkflowRun: () => ({
    workflowRun: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
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

describe('GlobalWorkflowTrackingBar', () => {
  const mockProjectId = 'project-1';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => mockProjectId),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('TC-WORKFLOW-BAR-001: Visibility based on active workflow', () => {
    it('should not render when no active workflow exists', async () => {
      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(null);

      const { container } = renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should render when active workflow exists', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Add global live workflow tracking bar',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByTestId('workflow-tracking-bar')).toBeInTheDocument();
      });
    });
  });

  describe('TC-WORKFLOW-BAR-002: Display story information', () => {
    it('should display story key and title', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Add global live workflow tracking bar',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByText('ST-28')).toBeInTheDocument();
        expect(screen.getByText(/Add global live workflow tracking bar/)).toBeInTheDocument();
      });
    });

    it('should make story clickable with link to story detail page', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /ST-28/ });
        expect(link).toHaveAttribute('href', '/stories/ST-28');
      });
    });
  });

  describe('TC-WORKFLOW-BAR-003: Display active component', () => {
    it('should display currently running component name', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByText(/Business Analyst/)).toBeInTheDocument();
      });
    });

    it('should display "Initializing..." when no component is active yet', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'pending',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: null,
        progress: {
          completed: 0,
          total: 6,
          percentage: 0,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByText(/Initializing/)).toBeInTheDocument();
      });
    });
  });

  describe('TC-WORKFLOW-BAR-004: Display progress indicator', () => {
    it('should display progress as "X/Y components completed"', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Architect',
        progress: {
          completed: 3,
          total: 6,
          percentage: 50,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByText(/3\/6 components/)).toBeInTheDocument();
      });
    });

    it('should display progress percentage', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Developer',
        progress: {
          completed: 4,
          total: 6,
          percentage: 67,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.getByText(/67%/)).toBeInTheDocument();
      });
    });

    it('should render linear progress bar with correct value', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Developer',
        progress: {
          completed: 4,
          total: 6,
          percentage: 67,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '67');
      });
    });
  });

  describe('TC-WORKFLOW-BAR-005: Spinning animation indicator', () => {
    it('should display spinning icon when workflow is running', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const spinner = screen.getByTestId('workflow-spinner');
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveClass('animate-spin');
      });
    });

    it('should not display spinner when workflow is paused', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'paused',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(screen.queryByTestId('workflow-spinner')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-WORKFLOW-BAR-006: Styling and positioning', () => {
    it('should render with expected structure', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const bar = screen.getByTestId('workflow-tracking-bar');
        expect(bar).toBeInTheDocument();
        // Check that it has the expected card classes
        expect(bar.className).toContain('bg-card');
        expect(bar.className).toContain('border-b');
      });
    });

    it('should have max-width container for content', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const bar = screen.getByTestId('workflow-tracking-bar');
        // Check for the max-width container inside
        const container = bar.querySelector('.max-w-7xl');
        expect(container).toBeInTheDocument();
      });
    });

    it('should have flex layout for items', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const bar = screen.getByTestId('workflow-tracking-bar');
        // Check for flex container
        const flexContainer = bar.querySelector('.flex.items-center.justify-between');
        expect(flexContainer).toBeInTheDocument();
      });
    });
  });

  describe('TC-WORKFLOW-BAR-007: Real-time updates', () => {
    it('should poll for updates every 3 seconds', async () => {
      vi.useFakeTimers();

      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'Test Story',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        expect(api.getActiveWorkflowForProject).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 3 seconds (use async version to flush promises)
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => {
        expect(api.getActiveWorkflowForProject).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });

    it('should update display when workflow progresses', async () => {
      vi.useFakeTimers();

      let callCount = 0;
      vi.mocked(api.getActiveWorkflowForProject).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            runId: 'run-1',
            status: 'running',
            storyKey: 'ST-28',
            storyTitle: 'Test Story',
            activeComponentName: 'Business Analyst',
            progress: { completed: 2, total: 6, percentage: 33 },
            startedAt: '2024-01-15T10:00:00Z',
          };
        }
        return {
          runId: 'run-1',
          status: 'running',
          storyKey: 'ST-28',
          storyTitle: 'Test Story',
          activeComponentName: 'Designer',
          progress: { completed: 3, total: 6, percentage: 50 },
          startedAt: '2024-01-15T10:00:00Z',
        };
      });

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      // Initial render
      await waitFor(() => {
        expect(screen.getByText(/Business Analyst/)).toBeInTheDocument();
        expect(screen.getByText(/2\/6/)).toBeInTheDocument();
      });

      // Advance timer to trigger refetch (3 second polling interval)
      await vi.advanceTimersByTimeAsync(3000);

      // Check updated display
      await waitFor(() => {
        expect(screen.getByText(/Designer/)).toBeInTheDocument();
        expect(screen.getByText(/3\/6/)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should hide bar when workflow completes', async () => {
      vi.useFakeTimers();

      let callCount = 0;
      vi.mocked(api.getActiveWorkflowForProject).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            runId: 'run-1',
            status: 'running',
            storyKey: 'ST-28',
            storyTitle: 'Test Story',
            activeComponentName: 'QA Engineer',
            progress: { completed: 5, total: 6, percentage: 83 },
            startedAt: '2024-01-15T10:00:00Z',
          };
        }
        return null; // Workflow completed
      });

      const { container } = renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      // Initial render
      await waitFor(() => {
        expect(screen.getByTestId('workflow-tracking-bar')).toBeInTheDocument();
      });

      // Advance timer to trigger refetch (3 second polling interval)
      await vi.advanceTimersByTimeAsync(3000);

      // After completion - bar should be hidden
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });

      vi.useRealTimers();
    });
  });

  describe('TC-WORKFLOW-BAR-008: Responsive design', () => {
    it('should be responsive on mobile devices (truncate long titles)', async () => {
      const mockActiveWorkflow = {
        runId: 'run-1',
        status: 'running',
        storyKey: 'ST-28',
        storyTitle: 'This is a very long story title that should be truncated on mobile devices to prevent layout issues and ensure proper display',
        activeComponentName: 'Business Analyst',
        progress: {
          completed: 2,
          total: 6,
          percentage: 33,
        },
        startedAt: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.getActiveWorkflowForProject).mockResolvedValue(mockActiveWorkflow);

      renderWithQueryClient(<GlobalWorkflowTrackingBar />);

      await waitFor(() => {
        const titleElement = screen.getByText(/This is a very long/);
        // Check for truncate class instead of computed styles (CSS may not be computed in test env)
        expect(titleElement).toHaveClass('truncate');
      });
    });
  });
});
