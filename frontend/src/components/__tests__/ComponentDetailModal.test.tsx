/**
 * Unit Tests for ComponentDetailModal Component (ST-64)
 *
 * Tests all 4 tabs and their functionality:
 * - Overview tab: Instructions, configuration, tools, usage stats
 * - Version History tab: Timeline, activate/deactivate, version comparison
 * - Usage Analytics tab: Metrics, time range filter, workflows, execution history, CSV export
 * - Checksum tab: Checksum display, verification
 *
 * Coverage:
 * - Tab switching
 * - Data fetching and display
 * - User interactions (activate/deactivate, compare, export)
 * - Loading/error/empty states
 * - Mutations and cache invalidation
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsService } from '../../services/analytics.service';
import { versioningService } from '../../services/versioning.service';
import type { Component } from '../../types';
import { ComponentDetailModal } from '../ComponentDetailModal';

// Mock services
vi.mock('../../services/versioning.service');
vi.mock('../../services/analytics.service');

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date, options?: any) => '2 hours ago',
}));

const mockComponent: Component = {
  id: 'component-1',
  projectId: 'project-1',
  name: 'Test Component',
  description: 'Test component description',
  inputInstructions: 'Input instructions here',
  operationInstructions: 'Operation instructions here',
  outputInstructions: 'Output instructions here',
  config: {
    modelId: 'claude-3-sonnet',
    temperature: 0.7,
    maxInputTokens: 10000,
    maxOutputTokens: 4000,
    timeout: 300,
    costLimit: 1.0,
  },
  tools: ['tool1', 'tool2', 'tool3'],
  version: 'v1.0',
  versionMajor: 1,
  versionMinor: 0,
  active: true,
  tags: ['tag1', 'tag2'],
  onFailure: 'stop',
  usageStats: {
    totalRuns: 150,
    successRate: 95.5,
    avgRuntime: 45.2,
    avgCost: 0.05,
  },
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-15').toISOString(),
};

const mockVersions = [
  {
    id: 'version-1',
    componentId: 'component-1',
    versionMajor: 1,
    versionMinor: 0,
    version: 'v1.0',
    inputInstructions: 'Input v1.0',
    operationInstructions: 'Operation v1.0',
    outputInstructions: 'Output v1.0',
    config: {
      modelId: 'claude-3-sonnet',
      temperature: 0.7,
    },
    tools: ['tool1', 'tool2'],
    active: false,
    checksum: 'abc123def456',
    checksumAlgorithm: 'MD5',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user1',
  },
  {
    id: 'version-2',
    componentId: 'component-1',
    versionMajor: 1,
    versionMinor: 1,
    version: 'v1.1',
    inputInstructions: 'Input v1.1',
    operationInstructions: 'Operation v1.1',
    outputInstructions: 'Output v1.1',
    config: {
      modelId: 'claude-3-opus',
      temperature: 0.8,
    },
    tools: ['tool1', 'tool2', 'tool3'],
    active: true,
    checksum: 'def789ghi012',
    checksumAlgorithm: 'MD5',
    changeDescription: 'Updated model and added tool3',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    createdBy: 'user2',
  },
];

const mockAnalytics = {
  versionId: 'version-2',
  version: 'v1.1',
  metrics: {
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 5,
    successRate: 95.0,
    avgDuration: 30.5,
    totalCost: 4.5,
    avgCost: 0.045,
  },
  workflowsUsing: [
    {
      workflowId: 'workflow-1',
      workflowName: 'Test Workflow 1',
      version: 'v1.0',
      lastUsed: '2024-01-15T10:00:00Z',
      executionCount: 50,
    },
    {
      workflowId: 'workflow-2',
      workflowName: 'Test Workflow 2',
      version: 'v2.0',
      lastUsed: '2024-01-14T15:00:00Z',
      executionCount: 30,
    },
  ],
  executionHistory: [
    {
      id: 'exec-1',
      workflowRunId: 'run-1',
      workflowName: 'Test Workflow 1',
      status: 'completed' as const,
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:00:30Z',
      duration: 30,
      cost: 0.05,
      triggeredBy: 'user1',
    },
    {
      id: 'exec-2',
      workflowRunId: 'run-2',
      workflowName: 'Test Workflow 2',
      status: 'failed' as const,
      startTime: '2024-01-14T15:00:00Z',
      endTime: '2024-01-14T15:00:20Z',
      duration: 20,
      cost: 0.03,
      triggeredBy: 'user2',
    },
  ],
  executionTrend: [],
  costTrend: [],
};

const mockChecksumVerification = {
  verified: true,
  expectedChecksum: 'def789ghi012',
  actualChecksum: 'def789ghi012',
  algorithm: 'MD5',
  verifiedAt: '2024-01-15T12:00:00Z',
};

describe('ComponentDetailModal', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClose = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Reset mocks
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(versioningService.getComponentVersionHistory).mockResolvedValue(mockVersions);
    vi.mocked(analyticsService.getComponentAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(versioningService.activateComponentVersion).mockResolvedValue(mockVersions[1]);
    vi.mocked(versioningService.deactivateComponentVersion).mockResolvedValue({
      ...mockVersions[1],
      active: false,
    });
    vi.mocked(versioningService.verifyComponentChecksum).mockResolvedValue(mockChecksumVerification);
    vi.mocked(analyticsService.exportExecutionHistory).mockResolvedValue(new Blob(['test,data'], { type: 'text/csv' }));
  });

  const renderModal = (props: Partial<Parameters<typeof ComponentDetailModal>[0]> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ComponentDetailModal
          component={mockComponent}
          isOpen={true}
          onClose={mockOnClose}
          onEdit={mockOnEdit}
          onUpdate={mockOnUpdate}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  // ============================================================================
  // MODAL RENDERING TESTS
  // ============================================================================

  describe('Modal Rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display component name and description', () => {
      renderModal();
      expect(screen.getByText('Test Component')).toBeInTheDocument();
      expect(screen.getByText('Test component description')).toBeInTheDocument();
    });

    it('should display component status badges', () => {
      renderModal();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('v1.0')).toBeInTheDocument();
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    it('should render all 4 tabs', () => {
      renderModal();
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /version history/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /usage analytics/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /checksum/i })).toBeInTheDocument();
    });

    it('should render close and edit buttons', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit component/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TAB SWITCHING TESTS
  // ============================================================================

  describe('Tab Switching', () => {
    it('should switch to Version History tab when clicked', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText(/Version v1.0/)).toBeInTheDocument();
      });
    });

    it('should switch to Usage Analytics tab when clicked', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Performance Metrics/i)).toBeInTheDocument();
      });
    });

    it('should switch to Checksum tab when clicked', async () => {
      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByText(/Checksum/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // OVERVIEW TAB TESTS
  // ============================================================================

  describe('Overview Tab', () => {
    it('should display all instruction sets', () => {
      renderModal();

      expect(screen.getByText('Input Instructions')).toBeInTheDocument();
      expect(screen.getByText('Input instructions here')).toBeInTheDocument();
      expect(screen.getByText('Operation Instructions')).toBeInTheDocument();
      expect(screen.getByText('Operation instructions here')).toBeInTheDocument();
      expect(screen.getByText('Output Instructions')).toBeInTheDocument();
      expect(screen.getByText('Output instructions here')).toBeInTheDocument();
    });

    it('should display configuration details', () => {
      renderModal();

      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();
      expect(screen.getByText('0.7')).toBeInTheDocument();
      expect(screen.getByText('10000 / 4000')).toBeInTheDocument();
      expect(screen.getByText('300s')).toBeInTheDocument();
      expect(screen.getByText('stop')).toBeInTheDocument();
      expect(screen.getByText('$1')).toBeInTheDocument();
    });

    it('should display MCP tools', () => {
      renderModal();

      expect(screen.getByText('tool1')).toBeInTheDocument();
      expect(screen.getByText('tool2')).toBeInTheDocument();
      expect(screen.getByText('tool3')).toBeInTheDocument();
    });

    it('should display usage statistics when available', () => {
      renderModal();

      expect(screen.getByText('150')).toBeInTheDocument(); // Total Runs
      expect(screen.getByText('95.5%')).toBeInTheDocument(); // Success Rate
      expect(screen.getByText('45s')).toBeInTheDocument(); // Avg Runtime
      expect(screen.getByText('$0.05')).toBeInTheDocument(); // Avg Cost
    });

    it('should not display usage stats section when unavailable', () => {
      renderModal({
        component: { ...mockComponent, usageStats: undefined },
      });

      expect(screen.queryByText('Usage Statistics')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // VERSION HISTORY TAB TESTS
  // ============================================================================

  describe('Version History Tab', () => {
    it('should display loading state while fetching versions', async () => {
      vi.mocked(versioningService.getComponentVersionHistory).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
    });

    it('should display empty state when no versions exist', async () => {
      vi.mocked(versioningService.getComponentVersionHistory).mockResolvedValue([]);

      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText(/No version history/i)).toBeInTheDocument();
      });
    });

    it('should display version timeline with all versions', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
        expect(screen.getByText('Version v1.1')).toBeInTheDocument();
      });
    });

    it('should show active badge for active version', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activeBadges = screen.getAllByText('Active');
        expect(activeBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display change description when available', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText('Updated model and added tool3')).toBeInTheDocument();
      });
    });

    it('should show activate button for inactive versions', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        expect(activateButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show deactivate button for active version', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const deactivateButton = screen.getByRole('button', { name: /deactivate/i });
        expect(deactivateButton).toBeInTheDocument();
      });
    });

    it('should call activate mutation when activate button clicked', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /activate/i });
      await user.click(activateButtons[0]);

      expect(versioningService.activateComponentVersion).toHaveBeenCalledWith('version-1');
    });

    it('should call deactivate mutation when deactivate button clicked', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });

      const deactivateButton = screen.getByRole('button', { name: /deactivate/i });
      await user.click(deactivateButton);

      expect(versioningService.deactivateComponentVersion).toHaveBeenCalledWith('version-2');
    });

    it('should enable version selection with checkboxes', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBe(2);
      });
    });

    it('should show compare button when two versions selected', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        return checkboxes.length === 2;
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare selected versions/i })).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // USAGE ANALYTICS TAB TESTS
  // ============================================================================

  describe('Usage Analytics Tab', () => {
    it('should display loading state while fetching analytics', async () => {
      vi.mocked(analyticsService.getComponentAnalytics).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should display error state when analytics fetch fails', async () => {
      vi.mocked(analyticsService.getComponentAnalytics).mockRejectedValue(new Error('Failed'));

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();
      });
    });

    it('should display time range selector buttons', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /all time/i })).toBeInTheDocument();
      });
    });

    it('should update analytics when time range changed', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: /7d/i });
      await user.click(sevenDayButton);

      await waitFor(() => {
        expect(analyticsService.getComponentAnalytics).toHaveBeenCalledWith(
          'component-1',
          undefined,
          '7d'
        );
      });
    });

    it('should display performance metrics cards', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('95.0%')).toBeInTheDocument(); // Success Rate
        expect(screen.getByText('30.5s')).toBeInTheDocument(); // Avg Duration
        expect(screen.getByText('$4.50')).toBeInTheDocument(); // Total Cost
      });
    });

    it('should display workflows using this component', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
        expect(screen.getByText('Test Workflow 2')).toBeInTheDocument();
      });
    });

    it('should show empty state when no workflows use component', async () => {
      vi.mocked(analyticsService.getComponentAnalytics).mockResolvedValue({
        ...mockAnalytics,
        workflowsUsing: [],
      });

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/No workflows are using this component/i)).toBeInTheDocument();
      });
    });

    it('should display execution history table', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
      });
    });

    it('should show empty state when no execution history', async () => {
      vi.mocked(analyticsService.getComponentAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [],
      });

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/No execution history for selected time range/i)).toBeInTheDocument();
      });
    });

    it('should export CSV when export button clicked', async () => {
      // Mock URL.createObjectURL and friends
      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
      global.URL.revokeObjectURL = vi.fn();

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(analyticsService.exportExecutionHistory).toHaveBeenCalledWith(
          'component',
          'component-1',
          'csv',
          { timeRange: '30d' }
        );
      });
    });
  });

  // ============================================================================
  // CHECKSUM TAB TESTS
  // ============================================================================

  describe('Checksum Tab', () => {
    it('should display checksum for active version', async () => {
      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByText('def789ghi012')).toBeInTheDocument();
        expect(screen.getByText(/MD5/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no checksum available', async () => {
      vi.mocked(versioningService.getComponentVersionHistory).mockResolvedValue([
        { ...mockVersions[1], checksum: undefined },
      ]);

      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByText(/No checksum available/i)).toBeInTheDocument();
      });
    });

    it('should display integrity status', async () => {
      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByText(/Integrity Status: Valid/i)).toBeInTheDocument();
      });
    });

    it('should call verify mutation when re-verify button clicked', async () => {
      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /re-verify checksum/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /re-verify checksum/i });
      await user.click(verifyButton);

      expect(versioningService.verifyComponentChecksum).toHaveBeenCalledWith('version-2');
    });

    it('should display verification result after verify', async () => {
      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /re-verify checksum/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /re-verify checksum/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText(/Verification Successful/i)).toBeInTheDocument();
      });
    });

    it('should display failure state when verification fails', async () => {
      vi.mocked(versioningService.verifyComponentChecksum).mockResolvedValue({
        verified: false,
        expectedChecksum: 'abc123',
        actualChecksum: 'def456',
        algorithm: 'MD5',
        verifiedAt: '2024-01-15T12:00:00Z',
        mismatchDetails: 'Checksum mismatch detected',
      });

      renderModal();

      const checksumTab = screen.getByRole('tab', { name: /checksum/i });
      await user.click(checksumTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /re-verify checksum/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /re-verify checksum/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText(/Verification Failed/i)).toBeInTheDocument();
        expect(screen.getByText(/Checksum mismatch detected/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // USER INTERACTION TESTS
  // ============================================================================

  describe('User Interactions', () => {
    it('should call onClose when close button clicked', async () => {
      renderModal();

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onEdit when edit button clicked', async () => {
      renderModal();

      const editButton = screen.getByRole('button', { name: /edit component/i });
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should call onUpdate after successful activation', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /activate/i });
      await user.click(activateButtons[0]);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('should close modal when clicking overlay', async () => {
      renderModal();

      const overlay = screen.getByRole('dialog').parentElement?.querySelector('.bg-black');
      if (overlay) {
        await user.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // LOADING & ERROR STATES TESTS
  // ============================================================================

  describe('Loading and Error States', () => {
    it('should show loading spinner in version history tab', async () => {
      vi.mocked(versioningService.getComponentVersionHistory).mockImplementation(
        () => new Promise(() => {})
      );

      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should show loading spinner in analytics tab', async () => {
      vi.mocked(analyticsService.getComponentAnalytics).mockImplementation(
        () => new Promise(() => {})
      );

      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /usage analytics/i });
      await user.click(analyticsTab);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should disable buttons while mutations are pending', async () => {
      vi.mocked(versioningService.activateComponentVersion).mockImplementation(
        () => new Promise(() => {})
      );

      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /activate/i });
      await user.click(activateButtons[0]);

      await waitFor(() => {
        expect(activateButtons[0]).toBeDisabled();
      });
    });
  });
});
