/**
 * ST-127: DashboardDeploymentsWidget Tests
 * Tests for the dashboard deployments widget component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { DashboardDeploymentsWidget } from '../DashboardDeploymentsWidget';
import { deploymentsService } from '../../services/deployments.service';

vi.mock('../../services/deployments.service');

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
  storyId: `story-${id}`,
  storyKey: `ST-${id}`,
  storyTitle: `Test Story ${id}`,
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

const mockStats = {
  total: 100,
  byStatus: {
    deployed: 70,
    failed: 20,
    pending: 10,
  },
  byEnvironment: {
    production: 60,
    test: 40,
  },
  todayCount: 5,
  todaySuccessCount: 4,
  todayFailedCount: 1,
  recentDeployments: [
    createMockDeployment('1'),
    createMockDeployment('2', { status: 'failed' }),
    createMockDeployment('3'),
  ],
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

describe('DashboardDeploymentsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deploymentsService.getStats).mockResolvedValue(mockStats);
  });

  describe('Header', () => {
    it('should display widget title', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      expect(screen.getByText('Recent Deployments')).toBeInTheDocument();
    });

    it('should display View All link', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      const viewAllLink = screen.getByText('View All →');
      expect(viewAllLink).toBeInTheDocument();
    });

    it('should navigate to deployments page on View All click', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      const viewAllLink = screen.getByText('View All →');
      fireEvent.click(viewAllLink);

      expect(mockNavigate).toHaveBeenCalledWith('/deployments');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching', () => {
      vi.mocked(deploymentsService.getStats).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<DashboardDeploymentsWidget />);

      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no deployments', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue({
        ...mockStats,
        recentDeployments: [],
      });

      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('No deployments yet')).toBeInTheDocument();
      });
    });

    it('should display empty state icon', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue({
        ...mockStats,
        recentDeployments: [],
      });

      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        // SVG should be present
        const svg = document.querySelector('svg[class*="text-muted"]');
        expect(svg).toBeTruthy();
      });
    });
  });

  describe('Deployments Display', () => {
    it('should display recent deployments', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('ST-1')).toBeInTheDocument();
        expect(screen.getByText('ST-2')).toBeInTheDocument();
        expect(screen.getByText('ST-3')).toBeInTheDocument();
      });
    });

    it('should display deployments in compact mode', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        // Compact mode doesn't render a table
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });

    it('should show story column in compact view', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('ST-1')).toBeInTheDocument();
        expect(screen.getByText('Test Story 1')).toBeInTheDocument();
      });
    });
  });

  describe('Footer Stats', () => {
    it('should display today stats when there are deployments today', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('ST-1')).toBeInTheDocument();
      });

      // Now check for footer (text contains "Today:")
      expect(screen.getByText(/Today:/)).toBeInTheDocument();
    });

    it('should display success count', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('4 deployed')).toBeInTheDocument();
      });
    });

    it('should display failed count when > 0', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('1 failed')).toBeInTheDocument();
      });
    });

    it('should not display failed count when 0', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue({
        ...mockStats,
        todayFailedCount: 0,
      });

      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
      });
    });

    it('should not display footer when no deployments today', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue({
        ...mockStats,
        todayCount: 0,
        todaySuccessCount: 0,
        todayFailedCount: 0,
      });

      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.queryByText('Today:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should call getStats on mount', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(deploymentsService.getStats).toHaveBeenCalledTimes(1);
      });
    });

    // Note: Testing refetchInterval with fake timers and React Query is complex
    // The refetchInterval option is configured in the component and is a React Query concern
    // We verify the component uses the query correctly in other tests
  });

  describe('Click Navigation', () => {
    it('should navigate to story on deployment row click', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      await waitFor(() => {
        expect(screen.getByText('ST-1')).toBeInTheDocument();
      });

      // Click on a deployment row
      const storyKey = screen.getByText('ST-1');
      const row = storyKey.closest('div[class*="cursor-pointer"]');
      fireEvent.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith('/stories/ST-1');
    });
  });

  describe('Styling', () => {
    it('should have card styling', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      const widget = document.querySelector('.bg-card');
      expect(widget).toBeTruthy();
    });

    it('should have border styling', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      const widget = document.querySelector('.border-border');
      expect(widget).toBeTruthy();
    });

    it('should have shadow styling', async () => {
      renderWithProviders(<DashboardDeploymentsWidget />);

      const widget = document.querySelector('.shadow');
      expect(widget).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      vi.mocked(deploymentsService.getStats).mockRejectedValue(new Error('API Error'));

      // Should not throw
      expect(() => renderWithProviders(<DashboardDeploymentsWidget />)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null stats gracefully', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue(null as any);

      renderWithProviders(<DashboardDeploymentsWidget />);

      // Should not crash and show empty state
      await waitFor(() => {
        expect(screen.getByText('No deployments yet')).toBeInTheDocument();
      });
    });

    it('should handle undefined recentDeployments', async () => {
      vi.mocked(deploymentsService.getStats).mockResolvedValue({
        ...mockStats,
        recentDeployments: undefined,
      } as any);

      renderWithProviders(<DashboardDeploymentsWidget />);

      // Should not crash and show empty state
      await waitFor(() => {
        expect(screen.getByText('No deployments yet')).toBeInTheDocument();
      });
    });
  });
});
