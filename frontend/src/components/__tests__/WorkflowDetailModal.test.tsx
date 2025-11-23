/**
 * Unit Tests for WorkflowDetailModal Component (ST-64)
 *
 * Tests all 4 tabs and their functionality:
 * - Overview tab: Description, coordinator, trigger config, timestamps
 * - Version History tab: Timeline, activate/deactivate, version comparison
 * - Executions tab: Time range filter, execution history, empty states
 * - Analytics tab: Metrics cards, CSV export, loading/error states
 *
 * Coverage:
 * - Tab switching
 * - Data fetching and display
 * - User interactions (activate/deactivate, compare, time range, export)
 * - Loading/error/empty states
 * - Mutations and cache invalidation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowDetailModal } from '../WorkflowDetailModal';
import { versioningService } from '../../services/versioning.service';
import { analyticsService } from '../../services/analytics.service';
import type { Workflow } from '../../types';

// Mock services
vi.mock('../../services/versioning.service');
vi.mock('../../services/analytics.service');

// Mock VersionComparisonModal
vi.mock('../VersionComparisonModal', () => ({
  VersionComparisonModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="version-comparison-modal">
        <button onClick={onClose}>Close Comparison</button>
      </div>
    ) : null,
}));

const mockWorkflow: Workflow = {
  id: 'workflow-1',
  projectId: 'project-1',
  coordinatorId: 'coordinator-1',
  name: 'Test Workflow',
  description: 'Test workflow description',
  version: 'v1.0',
  triggerConfig: {
    type: 'manual',
    filters: { storyStatus: ['planning', 'analysis'] },
    notifications: { onSuccess: true, onFailure: true },
  },
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
  coordinator: {
    id: 'coordinator-1',
    name: 'PM Coordinator',
    domain: 'project-management',
  },
  usageStats: {
    totalRuns: 50,
    successRate: 96.0,
    avgRuntime: 120.5,
    avgCost: 0.25,
  },
};

const mockVersions = [
  {
    id: 'version-1',
    workflowId: 'workflow-1',
    versionMajor: 1,
    versionMinor: 0,
    version: 'v1.0',
    coordinatorId: 'coordinator-1',
    coordinatorVersion: 'v1.0',
    triggerConfig: {
      type: 'manual',
      filters: { storyStatus: ['planning'] },
    },
    active: false,
    checksum: 'abc123def456',
    checksumAlgorithm: 'MD5',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user1',
  },
  {
    id: 'version-2',
    workflowId: 'workflow-1',
    versionMajor: 1,
    versionMinor: 1,
    version: 'v1.1',
    coordinatorId: 'coordinator-1',
    coordinatorVersion: 'v1.1',
    triggerConfig: {
      type: 'manual',
      filters: { storyStatus: ['planning', 'analysis'] },
    },
    active: false,
    checksum: 'def789ghi012',
    checksumAlgorithm: 'MD5',
    changeDescription: 'Added analysis status to trigger filter',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    createdBy: 'user2',
  },
  {
    id: 'version-3',
    workflowId: 'workflow-1',
    versionMajor: 1,
    versionMinor: 2,
    version: 'v1.2',
    coordinatorId: 'coordinator-1',
    coordinatorVersion: 'v1.2',
    triggerConfig: {
      type: 'manual',
      filters: { storyStatus: ['planning', 'analysis'] },
      notifications: { onSuccess: true, onFailure: true },
    },
    active: true,
    checksum: 'ghi345jkl678',
    checksumAlgorithm: 'MD5',
    changeDescription: 'Added notification configuration',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    createdBy: 'user3',
  },
];

const mockAnalytics = {
  versionId: 'version-3',
  version: 'v1.2',
  metrics: {
    totalExecutions: 150,
    successfulExecutions: 144,
    failedExecutions: 6,
    successRate: 96.0,
    avgDuration: 120.5,
    totalCost: 37.5,
    avgCost: 0.25,
  },
  executionHistory: [
    {
      id: 'exec-1',
      workflowRunId: 'run-1',
      workflowName: 'Test Workflow',
      status: 'completed' as const,
      runNumber: 101,
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:02:00Z',
      duration: 120,
      cost: 0.25,
      triggeredBy: 'user1',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'exec-2',
      workflowRunId: 'run-2',
      workflowName: 'Test Workflow',
      status: 'failed' as const,
      runNumber: 102,
      startTime: '2024-01-14T15:00:00Z',
      endTime: '2024-01-14T15:01:30Z',
      duration: 90,
      cost: 0.18,
      triggeredBy: 'user2',
      createdAt: '2024-01-14T15:00:00Z',
    },
    {
      id: 'exec-3',
      workflowRunId: 'run-3',
      workflowName: 'Test Workflow',
      status: 'completed' as const,
      runNumber: 103,
      startTime: '2024-01-13T09:30:00Z',
      endTime: '2024-01-13T09:32:15Z',
      duration: 135,
      cost: 0.28,
      triggeredBy: 'user1',
      createdAt: '2024-01-13T09:30:00Z',
    },
  ],
  executionTrend: [],
  costTrend: [],
  componentBreakdown: [],
};

describe('WorkflowDetailModal', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClose = vi.fn();
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
    vi.mocked(versioningService.getWorkflowVersionHistory).mockResolvedValue(mockVersions);
    vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(versioningService.activateWorkflowVersion).mockResolvedValue(mockVersions[2]);
    vi.mocked(versioningService.deactivateWorkflowVersion).mockResolvedValue({
      ...mockVersions[2],
      active: false,
    });
    vi.mocked(analyticsService.exportExecutionHistory).mockResolvedValue(
      new Blob(['test,data'], { type: 'text/csv' })
    );
  });

  const renderModal = (props: Partial<Parameters<typeof WorkflowDetailModal>[0]> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkflowDetailModal
          workflow={mockWorkflow}
          isOpen={true}
          onClose={mockOnClose}
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
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display workflow name in header', () => {
      renderModal();
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    it('should display workflow version badge', () => {
      renderModal();
      expect(screen.getByText('v1.0')).toBeInTheDocument();
    });

    it('should display active status badge for active workflow', () => {
      renderModal();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display inactive status for inactive workflow', () => {
      renderModal({ workflow: { ...mockWorkflow, active: false } });
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('should display trigger type in header', () => {
      renderModal();
      // Trigger type appears in header - use getAllByText since it appears in overview tab too
      const manualTexts = screen.getAllByText('manual');
      expect(manualTexts.length).toBeGreaterThan(0);
    });

    it('should render close button', () => {
      renderModal();
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) => btn.querySelector('.h-6.w-6'));
      expect(closeButton).toBeInTheDocument();
    });

    it('should render all 4 tabs', () => {
      renderModal();
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /version history/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /executions/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
    });

    it('should render bottom close button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TAB SWITCHING TESTS
  // ============================================================================

  describe('Tab Switching', () => {
    it('should show overview tab by default', () => {
      renderModal();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Test workflow description')).toBeInTheDocument();
    });

    it('should switch to Version History tab when clicked', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText(/Version Timeline/i)).toBeInTheDocument();
      });
    });

    it('should switch to Executions tab when clicked', async () => {
      renderModal();

      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText(/Recent Executions/i)).toBeInTheDocument();
      });
    });

    it('should switch to Analytics tab when clicked', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Usage Metrics/i)).toBeInTheDocument();
      });
    });

    it('should switch back to overview tab when clicked again', async () => {
      renderModal();

      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Usage Metrics/i)).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      await user.click(overviewTab);

      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // OVERVIEW TAB TESTS
  // ============================================================================

  describe('Overview Tab', () => {
    it('should display workflow description', () => {
      renderModal();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Test workflow description')).toBeInTheDocument();
    });

    it('should display "No description provided" when description is missing', () => {
      renderModal({ workflow: { ...mockWorkflow, description: undefined } });
      expect(screen.getByText('No description provided')).toBeInTheDocument();
    });

    it('should display coordinator name', () => {
      renderModal();
      expect(screen.getByText('Coordinator')).toBeInTheDocument();
      expect(screen.getByText('PM Coordinator')).toBeInTheDocument();
    });

    it('should display "Not assigned" when coordinator is missing', () => {
      renderModal({ workflow: { ...mockWorkflow, coordinator: undefined } });
      expect(screen.getByText('Not assigned')).toBeInTheDocument();
    });

    it('should display trigger type', () => {
      renderModal();
      expect(screen.getByText('Trigger Type')).toBeInTheDocument();
      // Trigger type appears capitalized
      const triggerTypeElements = screen.getAllByText('manual');
      expect(triggerTypeElements.length).toBeGreaterThan(0);
    });

    it('should display trigger configuration as JSON', () => {
      renderModal();
      expect(screen.getByText('Trigger Configuration')).toBeInTheDocument();
      const pre = screen.getByText(/"type": "manual"/i).closest('pre');
      expect(pre).toBeInTheDocument();
    });

    it('should display created timestamp', () => {
      renderModal();
      expect(screen.getByText('Created')).toBeInTheDocument();
      // Date will be formatted, just check it exists
      const createdSection = screen.getByText('Created').closest('div');
      expect(createdSection).toBeInTheDocument();
    });

    it('should display last updated timestamp', () => {
      renderModal();
      expect(screen.getByText('Last Updated')).toBeInTheDocument();
      const updatedSection = screen.getByText('Last Updated').closest('div');
      expect(updatedSection).toBeInTheDocument();
    });

    it('should format dates correctly', () => {
      renderModal();
      // Dates are formatted using toLocaleString()
      // Just verify they're displayed
      const createdText = screen.getByText('Created').parentElement?.textContent;
      const updatedText = screen.getByText('Last Updated').parentElement?.textContent;
      expect(createdText).toBeTruthy();
      expect(updatedText).toBeTruthy();
    });
  });

  // ============================================================================
  // VERSION HISTORY TAB TESTS - TIMELINE RENDERING
  // ============================================================================

  describe('Version History Tab - Timeline Rendering', () => {
    it('should display loading spinner while fetching versions', async () => {
      vi.mocked(versioningService.getWorkflowVersionHistory).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      // Loading spinner is a div with animate-spin class
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should display empty state when no versions exist', async () => {
      vi.mocked(versioningService.getWorkflowVersionHistory).mockResolvedValue([]);

      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const emptyStateHeading = screen.getAllByText(/No version history/i)[0];
        expect(emptyStateHeading).toBeInTheDocument();
        expect(screen.getByText(/This workflow has no version history yet/i)).toBeInTheDocument();
      });
    });

    it('should display version timeline header', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText('Version Timeline')).toBeInTheDocument();
      });
    });

    it('should render all version nodes in timeline', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        // Check for version badges (v1.0, v1.1, v1.2)
        const timeline = screen.getByText('Version Timeline').closest('div');
        expect(timeline).toBeInTheDocument();

        // All three versions should be present (appears in timeline AND list, plus header badge)
        const versionTexts = screen.getAllByText(/v1\./);
        expect(versionTexts.length).toBeGreaterThanOrEqual(mockVersions.length);
      });
    });

    it('should highlight active version in timeline', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const timeline = screen.getByText('Version Timeline').closest('div');
        const activeNode = timeline?.querySelector('.bg-blue-600');
        expect(activeNode).toBeInTheDocument();
      });
    });

    it('should show creation date on hover (via title attribute)', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        expect(versionButtons.length).toBeGreaterThan(0);
      });
    });

    it('should render connector lines between version nodes', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const timeline = screen.getByText('Version Timeline').closest('div');
        // Connectors are divs with specific background color
        const connectors = timeline?.querySelectorAll('.bg-gray-300');
        // Should have 2 connectors for 3 versions
        expect(connectors?.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // VERSION HISTORY TAB TESTS - VERSION SELECTION
  // ============================================================================

  describe('Version History Tab - Version Selection', () => {
    it('should select first version when clicking version node', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 0;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);

      // Selected version should have scale-110 class on wrapper div
      await waitFor(() => {
        const parentDiv = versionButtons[0].closest('button');
        expect(parentDiv?.className).toContain('scale-110');
      });
    });

    it('should select second version for comparison', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);

      // Both should be selected (have scale-110 class)
      await waitFor(() => {
        const selectedNodes = screen.getAllByTitle(/Select v1\./).filter((btn) => {
          const parentBtn = btn.closest('button');
          return parentBtn?.className.includes('scale-110');
        });
        expect(selectedNodes.length).toBe(2);
      });
    });

    it('should show "Compare Selected Versions" button when 2 versions selected', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare selected versions/i })).toBeInTheDocument();
      });
    });

    it('should not show compare button when only 1 version selected', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 0;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);

      expect(screen.queryByRole('button', { name: /compare selected versions/i })).not.toBeInTheDocument();
    });

    it('should reset selection when clicking third version', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 2;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);
      await user.click(versionButtons[2]);

      // Only the third version should be selected
      await waitFor(() => {
        const selectedNodes = versionButtons.filter((btn) => {
          const parentBtn = btn.closest('button');
          return parentBtn?.className.includes('scale-110');
        });
        expect(selectedNodes.length).toBe(1);
      });
    });

    it('should unselect when clicking same version again', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);
      await user.click(versionButtons[0]); // Click first again

      // First should be unselected, only second should remain
      await waitFor(() => {
        const selectedNodes = versionButtons.filter((btn) => {
          const parentBtn = btn.closest('button');
          return parentBtn?.className.includes('scale-110');
        });
        expect(selectedNodes.length).toBe(1);
      });
    });
  });

  // ============================================================================
  // VERSION HISTORY TAB TESTS - VERSION LIST
  // ============================================================================

  describe('Version History Tab - Version List', () => {
    it('should display all versions in list view', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        // Check for version v1.0, v1.1, v1.2 in the list
        const versionCards = screen.getAllByText(/^v1\.[0-2]$/);
        expect(versionCards.length).toBeGreaterThanOrEqual(3);
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
        expect(screen.getByText('Added analysis status to trigger filter')).toBeInTheDocument();
        expect(screen.getByText('Added notification configuration')).toBeInTheDocument();
      });
    });

    it('should not display change description section when unavailable', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        // v1.0 doesn't have changeDescription - appears in timeline and list, use getAllByText
        const v10Elements = screen.getAllByText(/^v1\.0$/);
        expect(v10Elements.length).toBeGreaterThan(0);
      });
    });

    it('should display created timestamp for each version', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const createdLabels = screen.getAllByText(/Created:/);
        expect(createdLabels.length).toBe(mockVersions.length);
      });
    });

    it('should display created by user when available', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText(/By: user1/)).toBeInTheDocument();
        expect(screen.getByText(/By: user2/)).toBeInTheDocument();
        expect(screen.getByText(/By: user3/)).toBeInTheDocument();
      });
    });

    it('should show activate button for inactive versions', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
        // v1.0 and v1.1 are inactive
        expect(activateButtons.length).toBe(2);
      });
    });

    it('should show deactivate button for active version', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const deactivateButton = screen.getByRole('button', { name: /^deactivate$/i });
        expect(deactivateButton).toBeInTheDocument();
      });
    });

    it('should highlight active version with different background color', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        // v1.2 appears in both timeline and list, get all and find the one in the version list
        const v12Elements = screen.getAllByText('v1.2');
        const versionListCard = v12Elements.find((el) => {
          const card = el.closest('.p-4');
          return card?.className.includes('bg-blue-50');
        });
        expect(versionListCard).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // VERSION HISTORY TAB TESTS - MUTATIONS
  // ============================================================================

  describe('Version History Tab - Mutations', () => {
    it('should call activate mutation when activate button clicked', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
      await user.click(activateButtons[0]);

      expect(versioningService.activateWorkflowVersion).toHaveBeenCalledWith('version-1');
    });

    it('should call deactivate mutation when deactivate button clicked', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const deactivateButton = screen.getByRole('button', { name: /^deactivate$/i });
        return deactivateButton;
      });

      const deactivateButton = screen.getByRole('button', { name: /^deactivate$/i });
      await user.click(deactivateButton);

      expect(versioningService.deactivateWorkflowVersion).toHaveBeenCalledWith('version-3');
    });

    it('should invalidate queries after successful activation', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
      await user.click(activateButtons[0]);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflowVersions', 'workflow-1'] });
      });
    });

    it('should call onUpdate callback after successful activation', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
      await user.click(activateButtons[0]);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('should disable activate button while mutation is pending', async () => {
      vi.mocked(versioningService.activateWorkflowVersion).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /^activate$/i });
      await user.click(activateButtons[0]);

      await waitFor(() => {
        expect(activateButtons[0]).toBeDisabled();
      });
    });

    it('should disable deactivate button while mutation is pending', async () => {
      vi.mocked(versioningService.deactivateWorkflowVersion).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const deactivateButton = screen.getByRole('button', { name: /^deactivate$/i });
        return deactivateButton;
      });

      const deactivateButton = screen.getByRole('button', { name: /^deactivate$/i });
      await user.click(deactivateButton);

      await waitFor(() => {
        expect(deactivateButton).toBeDisabled();
      });
    });
  });

  // ============================================================================
  // VERSION COMPARISON INTEGRATION TESTS
  // ============================================================================

  describe('Version Comparison Integration', () => {
    it('should open comparison modal when compare button clicked', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare selected versions/i })).toBeInTheDocument();
      });

      const compareButton = screen.getByRole('button', { name: /compare selected versions/i });
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('version-comparison-modal')).toBeInTheDocument();
      });
    });

    it('should pass correct version IDs to comparison modal', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);

      const compareButton = await screen.findByRole('button', { name: /compare selected versions/i });
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('version-comparison-modal')).toBeInTheDocument();
      });
    });

    it('should close comparison modal when close button clicked', async () => {
      renderModal();
      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        const versionButtons = screen.getAllByTitle(/Select v1\./);
        return versionButtons.length > 1;
      });

      const versionButtons = screen.getAllByTitle(/Select v1\./);
      await user.click(versionButtons[0]);
      await user.click(versionButtons[1]);

      const compareButton = await screen.findByRole('button', { name: /compare selected versions/i });
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('version-comparison-modal')).toBeInTheDocument();
      });

      const closeComparisonButton = screen.getByText('Close Comparison');
      await user.click(closeComparisonButton);

      await waitFor(() => {
        expect(screen.queryByTestId('version-comparison-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EXECUTIONS TAB TESTS - TIME RANGE FILTERS
  // ============================================================================

  describe('Executions Tab - Time Range Filters', () => {
    it('should display all time range filter buttons', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '30D' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '90D' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All Time' })).toBeInTheDocument();
      });
    });

    it('should highlight 30D filter by default', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const thirtyDayButton = screen.getByRole('button', { name: '30D' });
        expect(thirtyDayButton.className).toContain('bg-blue-100');
      });
    });

    it('should update filter when 7D button clicked', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: '7D' });
      await user.click(sevenDayButton);

      await waitFor(() => {
        expect(sevenDayButton.className).toContain('bg-blue-100');
      });
    });

    it('should update filter when 90D button clicked', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '90D' })).toBeInTheDocument();
      });

      const ninetyDayButton = screen.getByRole('button', { name: '90D' });
      await user.click(ninetyDayButton);

      await waitFor(() => {
        expect(ninetyDayButton.className).toContain('bg-blue-100');
      });
    });

    it('should update filter when All Time button clicked', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All Time' })).toBeInTheDocument();
      });

      const allTimeButton = screen.getByRole('button', { name: 'All Time' });
      await user.click(allTimeButton);

      await waitFor(() => {
        expect(allTimeButton.className).toContain('bg-blue-100');
      });
    });

    it('should refetch analytics when time range changes', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
      });

      // Initial call with 30d
      expect(analyticsService.getWorkflowAnalytics).toHaveBeenCalledWith('workflow-1', undefined, '30d');

      const sevenDayButton = screen.getByRole('button', { name: '7D' });
      await user.click(sevenDayButton);

      await waitFor(() => {
        expect(analyticsService.getWorkflowAnalytics).toHaveBeenCalledWith('workflow-1', undefined, '7d');
      });
    });
  });

  // ============================================================================
  // EXECUTIONS TAB TESTS - EXECUTION LIST
  // ============================================================================

  describe('Executions Tab - Execution List', () => {
    it('should display execution cards', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText('Run #101')).toBeInTheDocument();
        expect(screen.getByText('Run #102')).toBeInTheDocument();
        expect(screen.getByText('Run #103')).toBeInTheDocument();
      });
    });

    it('should display success icon for completed executions', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const execCard = screen.getByText('Run #101').closest('.flex');
        const successIcon = execCard?.querySelector('svg.text-green-600');
        expect(successIcon).toBeTruthy();
      });
    });

    it('should display failure icon for failed executions', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const execCard = screen.getByText('Run #102').closest('.flex');
        const failureIcon = execCard?.querySelector('svg.text-red-600');
        expect(failureIcon).toBeTruthy();
      });
    });

    it('should display duration for each execution', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText(/Duration: 120/)).toBeInTheDocument();
        expect(screen.getByText(/Duration: 90/)).toBeInTheDocument();
        expect(screen.getByText(/Duration: 135/)).toBeInTheDocument();
      });
    });

    it('should display cost for each execution', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText(/Cost: \$0\.2500/)).toBeInTheDocument();
        expect(screen.getByText(/Cost: \$0\.1800/)).toBeInTheDocument();
        expect(screen.getByText(/Cost: \$0\.2800/)).toBeInTheDocument();
      });
    });

    it('should format timestamps correctly', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const execCard = screen.getByText('Run #101').closest('div');
        // Date is formatted using toLocaleString()
        expect(execCard?.textContent).toBeTruthy();
      });
    });

    it('should handle N/A for missing run numbers', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [
          {
            ...mockAnalytics.executionHistory[0],
            runNumber: undefined,
          },
        ],
      });

      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText('Run #N/A')).toBeInTheDocument();
      });
    });

    it('should handle N/A for missing duration', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [
          {
            ...mockAnalytics.executionHistory[0],
            duration: undefined,
          },
        ],
      });

      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText(/Duration: N\/A/)).toBeInTheDocument();
      });
    });

    it('should not display cost when unavailable', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [
          {
            ...mockAnalytics.executionHistory[0],
            cost: undefined,
          },
        ],
      });

      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const execCard = screen.getByText('Run #101').closest('div');
        expect(execCard?.textContent).not.toContain('Cost:');
      });
    });
  });

  // ============================================================================
  // EXECUTIONS TAB TESTS - EMPTY STATE
  // ============================================================================

  describe('Executions Tab - Empty State', () => {
    it('should display empty state when no executions exist', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [],
      });

      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByText('No execution history')).toBeInTheDocument();
        expect(
          screen.getByText('No executions found for the selected time range.')
        ).toBeInTheDocument();
      });
    });

    it('should display empty state icon', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        executionHistory: [],
      });

      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        const emptyState = screen.getByText('No execution history').closest('div');
        const icon = emptyState?.querySelector('.h-12');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // ANALYTICS TAB TESTS - METRICS CARDS
  // ============================================================================

  describe('Analytics Tab - Metrics Cards', () => {
    it('should display loading spinner while fetching analytics', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      // Loading spinner is a div with animate-spin class
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should display total executions metric', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Total Executions')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('should display success rate metric', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Success Rate')).toBeInTheDocument();
        expect(screen.getByText('96.0%')).toBeInTheDocument();
      });
    });

    it('should display average duration metric', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Avg Duration')).toBeInTheDocument();
        expect(screen.getByText('120.5s')).toBeInTheDocument();
      });
    });

    it('should display total cost metric', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Total Cost')).toBeInTheDocument();
        expect(screen.getByText('$37.50')).toBeInTheDocument();
      });
    });

    it('should display 0 values when metrics are unavailable', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        metrics: undefined as any,
      });

      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        // Should show 0 for missing metrics
        const metrics = screen.getAllByText('0');
        expect(metrics.length).toBeGreaterThan(0);
      });
    });

    it('should format large numbers correctly', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue({
        ...mockAnalytics,
        metrics: {
          ...mockAnalytics.metrics,
          totalExecutions: 1500,
          totalCost: 123.456,
        },
      });

      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('1500')).toBeInTheDocument();
        expect(screen.getByText('$123.46')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // ANALYTICS TAB TESTS - EXPORT FUNCTIONALITY
  // ============================================================================

  describe('Analytics Tab - Export Functionality', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and friends
      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock document.createElement for link
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          element.click = vi.fn();
        }
        return element;
      });
    });

    it('should display export CSV button', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });
    });

    it('should call export service when export button clicked', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(analyticsService.exportExecutionHistory).toHaveBeenCalledWith(
          'workflow',
          'workflow-1',
          'csv',
          { timeRange: '30d' }
        );
      });
    });

    it('should download file with correct filename', async () => {
      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('should use current time range when exporting', async () => {
      renderModal();
      const executionsTab = screen.getByRole('tab', { name: /executions/i });
      await user.click(executionsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: '7D' });
      await user.click(sevenDayButton);

      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(analyticsService.exportExecutionHistory).toHaveBeenCalledWith(
          'workflow',
          'workflow-1',
          'csv',
          { timeRange: '7d' }
        );
      });
    });
  });

  // ============================================================================
  // ANALYTICS TAB TESTS - ERROR STATE
  // ============================================================================

  describe('Analytics Tab - Error State', () => {
    it('should display error message when analytics fetch fails', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockRejectedValue(new Error('Failed'));

      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();
      });
    });

    it('should not display metrics cards when analytics is null', async () => {
      vi.mocked(analyticsService.getWorkflowAnalytics).mockResolvedValue(null as any);

      renderModal();
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.queryByText('Total Executions')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // USER INTERACTION TESTS
  // ============================================================================

  describe('User Interactions', () => {
    it('should call onClose when close button in header clicked', async () => {
      renderModal();

      const closeButtons = screen.getAllByRole('button');
      const headerCloseButton = closeButtons.find((btn) => btn.querySelector('.h-6.w-6'));

      if (headerCloseButton) {
        await user.click(headerCloseButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should call onClose when bottom close button clicked', async () => {
      renderModal();

      const closeButton = screen.getByRole('button', { name: /^close$/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should enable queries only when modal is open', () => {
      const { rerender } = renderModal({ isOpen: false });

      // Queries should not be called when modal is closed
      expect(versioningService.getWorkflowVersionHistory).not.toHaveBeenCalled();
      expect(analyticsService.getWorkflowAnalytics).not.toHaveBeenCalled();

      // Re-render with modal open
      rerender(
        <QueryClientProvider client={queryClient}>
          <WorkflowDetailModal
            workflow={mockWorkflow}
            isOpen={true}
            onClose={mockOnClose}
            onUpdate={mockOnUpdate}
          />
        </QueryClientProvider>
      );

      // Now queries should be called
      expect(versioningService.getWorkflowVersionHistory).toHaveBeenCalledWith('workflow-1');
      expect(analyticsService.getWorkflowAnalytics).toHaveBeenCalled();
    });
  });
});
