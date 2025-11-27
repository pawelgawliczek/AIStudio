/**
 * ST-127: DeploymentHistoryPage Tests
 * Tests for the deployment history page with filters and pagination
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { DeploymentHistoryPage } from '../DeploymentHistoryPage';
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

describe('DeploymentHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deploymentsService.getAll).mockResolvedValue({
      data: [createMockDeployment('1'), createMockDeployment('2')],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });

  describe('Page Header', () => {
    it('should display page title', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText('Deployments')).toBeInTheDocument();
    });

    it('should display page description', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText(/View deployment history across all stories/)).toBeInTheDocument();
    });

    it('should display refresh button', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('should display status filter dropdown', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
    });

    it('should display environment filter dropdown', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText('Environment:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Environments')).toBeInTheDocument();
    });

    it('should have all status options', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      const statusSelect = screen.getByDisplayValue('All Statuses');
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'All Statuses' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Deployed' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Failed' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Rolled Back' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Deploying' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Pending' }));
      expect(statusSelect).toContainElement(screen.getByRole('option', { name: 'Approved' }));
    });

    it('should have environment options', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      const envSelect = screen.getByDisplayValue('All Environments');
      expect(envSelect).toContainElement(screen.getByRole('option', { name: 'All Environments' }));
      expect(envSelect).toContainElement(screen.getByRole('option', { name: 'Production' }));
      expect(envSelect).toContainElement(screen.getByRole('option', { name: 'Test' }));
    });

    it('should filter by status when selected', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'deployed' } });

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'deployed' })
        );
      });
    });

    it('should filter by environment when selected', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      const envSelect = screen.getByDisplayValue('All Environments');
      fireEvent.change(envSelect, { target: { value: 'production' } });

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ environment: 'production' })
        );
      });
    });

    it('should show clear filters button when filters are active', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      // Initially no clear button
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

      // Apply a filter
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeInTheDocument();
      });
    });

    it('should clear all filters when clear button is clicked', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      // Apply filters
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeInTheDocument();
      });

      // Click clear
      fireEvent.click(screen.getByText('Clear filters'));

      await waitFor(() => {
        expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
      });
    });

    it('should reset page to 0 when filter changes', async () => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: Array(20).fill(null).map((_, i) => createMockDeployment(String(i))),
        total: 50,
        limit: 20,
        offset: 0,
      });

      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for pagination to be visible
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      // Navigate to page 2
      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });

      // Change filter - should reset to page 0
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'deployed' } });

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0, status: 'deployed' })
        );
      });
    });
  });

  describe('Results Count', () => {
    it('should display total count', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Found 2 deployments/)).toBeInTheDocument();
      });
    });

    it('should show singular form for 1 deployment', async () => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: [createMockDeployment('1')],
        total: 1,
        limit: 20,
        offset: 0,
      });

      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Found 1 deployment(?!s)/)).toBeInTheDocument();
      });
    });

    it('should indicate when filters are applied', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        expect(screen.getByText(/matching filters/)).toBeInTheDocument();
      });
    });

    it('should show loading message while fetching', () => {
      vi.mocked(deploymentsService.getAll).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<DeploymentHistoryPage />);

      expect(screen.getByText('Loading deployments...')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: Array(20).fill(null).map((_, i) => createMockDeployment(String(i))),
        total: 100,
        limit: 20,
        offset: 0,
      });
    });

    it('should display pagination controls when there are deployments', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 5/)).toBeInTheDocument();
      });
    });

    it('should display showing range', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Showing/)).toBeInTheDocument();
        expect(screen.getByText(/results/)).toBeInTheDocument();
      });
    });

    it('should disable previous button on first page', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      // Find the desktop previous button (with sr-only text)
      const prevButtons = screen.getAllByRole('button', { name: /previous/i });
      // At least one should be disabled (desktop version)
      expect(prevButtons.some(btn => btn.disabled)).toBe(true);
    });

    it('should enable next button when more pages exist', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      // At least one should be enabled (desktop version)
      expect(nextButtons.some(btn => !btn.disabled)).toBe(true);
    });

    it('should navigate to next page', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for pagination to be visible
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });
    });

    it('should navigate to previous page', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for pagination to be visible
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      // Navigate to page 2 first
      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        const prevButtons = screen.getAllByRole('button', { name: /previous/i });
        expect(prevButtons.some(btn => !btn.disabled)).toBe(true);
      });

      const prevButtons = screen.getAllByRole('button', { name: /previous/i });
      fireEvent.click(prevButtons.find(btn => !btn.disabled)!);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0 })
        );
      });
    });

    it('should allow changing rows per page', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for pagination to be visible (which includes rows per page select)
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      const rowsSelect = screen.getByDisplayValue('20');
      fireEvent.change(rowsSelect, { target: { value: '50' } });

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 50 })
        );
      });
    });

    it('should reset to page 0 when rows per page changes', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for pagination to be visible
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      });

      // Go to page 2
      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });

      // Wait for data to load on page 2 (pagination still visible)
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
      });

      // Change rows per page
      const rowsSelect = screen.getByDisplayValue('20');
      fireEvent.change(rowsSelect, { target: { value: '50' } });

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0, limit: 50 })
        );
      });
    });
  });

  describe('Refresh', () => {
    it('should refetch data when refresh is clicked', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Clear mock call history
      vi.mocked(deploymentsService.getAll).mockClear();

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalledTimes(1);
      });
    });

    it('should show spinning icon while fetching', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(deploymentsService.getAll).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithProviders(<DeploymentHistoryPage />);

      // Click refresh while still loading
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      // Check for spinning icon class
      const icon = refreshButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');

      // Resolve the promise
      resolvePromise!({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
    });

    it('should disable refresh button while fetching', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(deploymentsService.getAll).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithProviders(<DeploymentHistoryPage />);

      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeDisabled();

      // Resolve
      resolvePromise!({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no deployments', async () => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText('No deployments found')).toBeInTheDocument();
      });
    });

    it('should show filter-specific empty message', async () => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(deploymentsService.getAll).toHaveBeenCalled();
      });

      // Apply filter
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        expect(screen.getByText('No deployments match your filters')).toBeInTheDocument();
      });
    });

    it('should not show pagination when no deployments', async () => {
      vi.mocked(deploymentsService.getAll).mockResolvedValue({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Table Display', () => {
    it('should show story column by default', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Story')).toBeInTheDocument();
      });
    });

    it('should display deployment data in table', async () => {
      renderWithProviders(<DeploymentHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText('ST-1')).toBeInTheDocument();
        expect(screen.getByText('ST-2')).toBeInTheDocument();
      });
    });
  });
});
