/**
 * ST-127: StoryDeploymentsTab Tests
 * Tests for the story deployments tab component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { StoryDeploymentsTab } from '../StoryDeploymentsTab';
import { deploymentsService } from '../../../services/deployments.service';

vi.mock('../../../services/deployments.service');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createMockDeployment = (id: string, overrides = {}) => ({
  id,
  storyId: 'story-123',
  storyKey: 'ST-123',
  storyTitle: 'Test Story',
  projectId: 'project-1',
  prNumber: parseInt(id),
  status: 'deployed',
  environment: 'production',
  branch: 'main',
  commitHash: `abc${id}`,
  approvedBy: 'admin@test.com',
  approvedAt: '2025-01-15T10:00:00Z',
  deployedBy: 'claude-agent',
  deployedAt: '2025-01-15T10:05:00Z',
  completedAt: '2025-01-15T10:10:00Z',
  duration: 300000,
  errorMessage: null,
  approvalMethod: 'pr',
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:10:00Z',
  ...overrides,
});

const mockStoryDeployments = {
  data: [
    createMockDeployment('1'),
    createMockDeployment('2', { status: 'failed', errorMessage: 'Build failed' }),
    createMockDeployment('3', { environment: 'test' }),
  ],
  total: 3,
  successCount: 2,
  failedCount: 1,
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StoryDeploymentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deploymentsService.getByStoryId).mockResolvedValue(mockStoryDeployments);
  });

  describe('Header', () => {
    it('should display section title', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      expect(screen.getByText('Deployment History')).toBeInTheDocument();
    });

    it('should display refresh button', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state from table', () => {
      vi.mocked(deploymentsService.getByStoryId).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      // Loading spinner should be present
      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch deployments for the story', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(deploymentsService.getByStoryId).toHaveBeenCalledWith('story-123');
      });
    });

    it('should not fetch if storyId is empty', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="" />);

      await waitFor(() => {
        expect(deploymentsService.getByStoryId).not.toHaveBeenCalled();
      });
    });

    it('should refetch when refresh button is clicked', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      // Wait for initial data to load and be displayed
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Clear call history after initial load
      vi.mocked(deploymentsService.getByStoryId).mockClear();

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(deploymentsService.getByStoryId).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Deployments Display', () => {
    it('should display deployments in table', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('should hide story column (showStoryColumn=false)', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.queryByText('Story')).not.toBeInTheDocument();
      });
    });

    it('should display all deployments for the story', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        // Check that we have 3 data rows (excluding header)
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBe(4); // 1 header + 3 data rows
      });
    });
  });

  describe('Summary Section', () => {
    it('should display total count', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Total: 3 deployments/)).toBeInTheDocument();
      });
    });

    it('should use singular form for 1 deployment', async () => {
      vi.mocked(deploymentsService.getByStoryId).mockResolvedValue({
        data: [createMockDeployment('1')],
        total: 1,
        successCount: 1,
        failedCount: 0,
      });

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Total: 1 deployment(?!s)/)).toBeInTheDocument();
      });
    });

    it('should display success count', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByText('2 successful')).toBeInTheDocument();
      });
    });

    it('should display failed count when > 0', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByText('1 failed')).toBeInTheDocument();
      });
    });

    it('should not display failed count when 0', async () => {
      vi.mocked(deploymentsService.getByStoryId).mockResolvedValue({
        data: [createMockDeployment('1')],
        total: 1,
        successCount: 1,
        failedCount: 0,
      });

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
      });
    });

    it('should not display summary when no deployments', async () => {
      vi.mocked(deploymentsService.getByStoryId).mockResolvedValue({
        data: [],
        total: 0,
        successCount: 0,
        failedCount: 0,
      });

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display custom empty message', async () => {
      vi.mocked(deploymentsService.getByStoryId).mockResolvedValue({
        data: [],
        total: 0,
        successCount: 0,
        failedCount: 0,
      });

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(screen.getByText('No deployments for this story')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Button', () => {
    it('should show spinning icon while fetching', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(deploymentsService.getByStoryId).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      // Click refresh
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      // Check for spinning icon
      const icon = refreshButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');

      // Resolve
      resolvePromise!(mockStoryDeployments);
    });

    it('should disable refresh button while fetching', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(deploymentsService.getByStoryId).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeDisabled();

      // Resolve
      resolvePromise!(mockStoryDeployments);

      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });
  });

  describe('Query Key', () => {
    it('should use story-specific query key', async () => {
      const { rerender } = renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        expect(deploymentsService.getByStoryId).toHaveBeenCalledWith('story-123');
      });

      // Change story ID
      const queryClient = createQueryClient();
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <StoryDeploymentsTab storyId="story-456" />
          </BrowserRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(deploymentsService.getByStoryId).toHaveBeenCalledWith('story-456');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      vi.mocked(deploymentsService.getByStoryId).mockRejectedValue(new Error('API Error'));

      // Should not throw
      expect(() => renderWithProviders(<StoryDeploymentsTab storyId="story-123" />)).not.toThrow();
    });
  });

  describe('Styling', () => {
    it('should have proper heading styling', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      const heading = screen.getByText('Deployment History');
      expect(heading).toHaveClass('text-xl', 'font-semibold');
    });

    it('should have proper button styling', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toHaveClass('border', 'rounded-lg');
    });

    it('should have success text styling', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        const successText = screen.getByText('2 successful');
        expect(successText).toHaveClass('text-green-600');
      });
    });

    it('should have failed text styling', async () => {
      renderWithProviders(<StoryDeploymentsTab storyId="story-123" />);

      await waitFor(() => {
        const failedText = screen.getByText('1 failed');
        expect(failedText).toHaveClass('text-red-600');
      });
    });
  });
});
