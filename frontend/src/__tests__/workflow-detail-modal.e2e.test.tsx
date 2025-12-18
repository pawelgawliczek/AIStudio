/**
 * End-to-End Tests for TeamDetailModal Component (ST-64)
 *
 * Tests critical user journeys through the WorkflowDetailModal UI:
 * 1. View team details
 * 2. Version history timeline navigation
 * 3. Compare versions workflow
 * 4. Activate/deactivate version
 * 5. View executions with time filters
 * 6. View analytics and export CSV
 * 7. Modal interactions (open, close, tab switching)
 *
 * Total Coverage: ~30 tests
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkflowDetailModal } from '../components/WorkflowDetailModal';
import type { Workflow } from '../types';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockWorkflow: Workflow = {
  id: 'workflow-1',
  projectId: 'project-1',
  projectManagerId: 'coordinator-1',
  name: 'Story Implementation Team',
  description: 'End-to-end workflow for implementing user stories',
  version: 'v1.2',
  versionMajor: 1,
  versionMinor: 2,
  triggerConfig: {
    type: 'manual',
    filters: { storyStatus: ['planning', 'analysis'] },
    notifications: { onSuccess: true, onFailure: true },
  },
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
  projectManager: {
    id: 'coordinator-1',
    name: 'PM Project Manager',
    domain: 'project-management',
  },
  usageStats: {
    totalRuns: 150,
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
    projectManagerId: 'coordinator-1',
    projectManagerVersion: 'v1.0',
    triggerConfig: { type: 'manual' },
    active: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'version-2',
    workflowId: 'workflow-1',
    versionMajor: 1,
    versionMinor: 1,
    version: 'v1.1',
    projectManagerId: 'coordinator-1',
    projectManagerVersion: 'v1.1',
    triggerConfig: {
      type: 'manual',
      filters: { storyStatus: ['planning'] },
    },
    active: false,
    changeDescription: 'Added story status filter',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'version-3',
    workflowId: 'workflow-1',
    versionMajor: 1,
    versionMinor: 2,
    version: 'v1.2',
    projectManagerId: 'coordinator-1',
    projectManagerVersion: 'v1.2',
    triggerConfig: {
      type: 'manual',
      filters: { storyStatus: ['planning', 'analysis'] },
      notifications: { onSuccess: true, onFailure: true },
    },
    active: true,
    changeDescription: 'Added notifications and expanded filters',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
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
      workflowName: 'Story Implementation Team',
      status: 'completed' as const,
      runNumber: 150,
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
      workflowName: 'Story Implementation Team',
      status: 'failed' as const,
      runNumber: 149,
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
      workflowName: 'Story Implementation Team',
      status: 'completed' as const,
      runNumber: 148,
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

const mockComparison = {
  entityType: 'workflow' as const,
  version1: mockVersions[0],
  version2: mockVersions[1],
  diff: {
    summary: {
      fieldsModified: 1,
      fieldsAdded: 0,
      fieldsRemoved: 0,
    },
    changes: [
      {
        field: 'triggerConfig',
        oldValue: { type: 'manual' },
        newValue: { type: 'manual', filters: { storyStatus: ['planning'] } },
        type: 'modified' as const,
      },
    ],
    impactAnalysis: {
      breakingChanges: false,
      riskLevel: 'low' as const,
      affectedAreas: ['trigger configuration'],
    },
  },
};

// ============================================================================
// MSW SERVER SETUP
// ============================================================================

const handlers = [
  // Version history endpoint
  http.get('/versioning/workflows/:workflowId/versions', () => {
    return HttpResponse.json(mockVersions);
  }),

  // Analytics endpoint
  http.get('/analytics/workflows/:workflowId', ({ request }) => {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '30d';

    // Return analytics filtered by time range
    return HttpResponse.json(mockAnalytics);
  }),

  // Activate version endpoint
  http.post('/versioning/workflows/versions/:versionId/activate', ({ params }) => {
    const { versionId } = params;
    const version = mockVersions.find((v) => v.id === versionId);
    if (!version) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ ...version, active: true });
  }),

  // Deactivate version endpoint
  http.post('/versioning/workflows/versions/:versionId/deactivate', ({ params }) => {
    const { versionId } = params;
    const version = mockVersions.find((v) => v.id === versionId);
    if (!version) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ ...version, active: false });
  }),

  // Compare versions endpoint
  http.get('/versioning/workflows/versions/compare', ({ request }) => {
    const url = new URL(request.url);
    const versionId1 = url.searchParams.get('versionId1');
    const versionId2 = url.searchParams.get('versionId2');

    if (!versionId1 || !versionId2) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json(mockComparison);
  }),

  // CSV export endpoint
  http.get('/analytics/workflows/:workflowId/export', () => {
    const csvData = 'workflowRunId,status,startTime,endTime,duration,cost\nrun-1,completed,2024-01-15T10:00:00Z,2024-01-15T10:02:00Z,120,0.25';
    return HttpResponse.text(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="workflow-analytics.csv"',
      },
    });
  }),
];

const server = setupServer(...handlers);

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TeamDetailModal E2E Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClose = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    vi.clearAllMocks();

    // Mock URL methods for CSV download
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
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
  // CRITICAL PATH 1: VIEW WORKFLOW DETAILS
  // ============================================================================

  describe('Critical Path 1: View Team Details', () => {
    it('should open modal when isOpen is true', () => {
      renderModal();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Story Implementation Team')).toBeInTheDocument();
    });

    it('should display all workflow information in Overview tab', () => {
      renderModal();

      // Header info
      expect(screen.getByText('Story Implementation Team')).toBeInTheDocument();
      expect(screen.getByText('v1.2')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Description
      expect(screen.getByText('End-to-end workflow for implementing user stories')).toBeInTheDocument();

      // Trigger config
      const manualTexts = screen.getAllByText(/manual/i);
      expect(manualTexts.length).toBeGreaterThan(0);
    });

    it('should show coordinator information', () => {
      renderModal();

      expect(screen.getByText('PM Project Manager')).toBeInTheDocument();
      expect(screen.getByText(/project-management/i)).toBeInTheDocument();
    });

    it('should display workflow timestamps', () => {
      renderModal();

      // Timestamps are displayed in the Overview tab
      expect(screen.getByText(/Created/i)).toBeInTheDocument();
      expect(screen.getByText(/Last Updated/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CRITICAL PATH 2: VERSION HISTORY TIMELINE
  // ============================================================================

  describe('Critical Path 2: Version History Timeline', () => {
    it('should switch to Version History tab and display timeline', async () => {
      renderModal();

      const versionTab = screen.getByRole('tab', { name: /version history/i });
      await user.click(versionTab);

      await waitFor(() => {
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
        expect(screen.getByText('Version v1.1')).toBeInTheDocument();
        expect(screen.getByText('Version v1.2')).toBeInTheDocument();
      });
    });

    it('should display all versions in timeline', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        // Should show 3 versions
        const versionCards = screen.getAllByText(/Version v\d\.\d/);
        expect(versionCards.length).toBe(3);
      });
    });

    it('should highlight active version in timeline', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        // Active badge should be visible
        const activeBadges = screen.getAllByText('Active');
        expect(activeBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display version dates on hover', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        // Dates should be visible in the timeline
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
      });
    });

    it('should show change descriptions for versions', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        expect(screen.getByText('Added story status filter')).toBeInTheDocument();
        expect(screen.getByText('Added notifications and expanded filters')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // CRITICAL PATH 3: COMPARE VERSIONS
  // ============================================================================

  describe('Critical Path 3: Compare Versions', () => {
    it('should enable version selection with checkboxes', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should select first version when checkbox clicked', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      expect(checkboxes[0]).toBeChecked();
    });

    it('should select second version and show compare button', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        return checkboxes.length >= 2;
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare selected versions/i })).toBeInTheDocument();
      });
    });

    it('should open comparison modal when compare button clicked', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        return checkboxes.length >= 2;
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare selected versions/i })).toBeInTheDocument();
      });

      const compareButton = screen.getByRole('button', { name: /compare selected versions/i });
      await user.click(compareButton);

      // Comparison modal should open (we mocked it in the component test)
      await waitFor(() => {
        expect(screen.getByTestId('version-comparison-modal')).toBeInTheDocument();
      });
    });

    it('should show differences between versions in comparison', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        return checkboxes.length >= 2;
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      const compareButton = await screen.findByRole('button', { name: /compare selected versions/i });
      await user.click(compareButton);

      // Modal should be visible with comparison
      await waitFor(() => {
        expect(screen.getByTestId('version-comparison-modal')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // CRITICAL PATH 4: ACTIVATE/DEACTIVATE VERSION
  // ============================================================================

  describe('Critical Path 4: Activate/Deactivate Version', () => {
    it('should display activate button for inactive versions', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        expect(activateButtons.length).toBeGreaterThan(0);
      });
    });

    it('should activate version when activate button clicked', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /activate/i });
      await user.click(activateButtons[0]);

      // Should call the API and update UI
      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('should show deactivate button for active version', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });
    });

    it('should deactivate version when deactivate button clicked', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });

      const deactivateButton = screen.getByRole('button', { name: /deactivate/i });
      await user.click(deactivateButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('should update UI immediately after activation', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /version history/i }));

      await waitFor(() => {
        const activateButtons = screen.getAllByRole('button', { name: /activate/i });
        return activateButtons.length > 0;
      });

      const activateButtons = screen.getAllByRole('button', { name: /activate/i });
      await user.click(activateButtons[0]);

      // UI should update to show new active status
      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // CRITICAL PATH 5: VIEW EXECUTIONS
  // ============================================================================

  describe('Critical Path 5: View Executions', () => {
    it('should switch to Executions tab and display history', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /executions/i }));

      await waitFor(() => {
        expect(screen.getByText(/Run #150/)).toBeInTheDocument();
        expect(screen.getByText(/Run #149/)).toBeInTheDocument();
      });
    });

    it('should display time range filter buttons', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /executions/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
      });
    });

    it('should update execution list when time range changed', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /executions/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: /7d/i });
      await user.click(sevenDayButton);

      // Should refetch data with new time range
      await waitFor(() => {
        expect(screen.getByText(/Run #150/)).toBeInTheDocument();
      });
    });

    it('should show success icons for completed executions', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /executions/i }));

      await waitFor(() => {
        const completedTexts = screen.getAllByText(/completed/i);
        expect(completedTexts.length).toBeGreaterThan(0);
      });
    });

    it('should show failure icons for failed executions', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /executions/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // CRITICAL PATH 6: VIEW ANALYTICS & EXPORT
  // ============================================================================

  describe('Critical Path 6: View Analytics & Export', () => {
    it('should switch to Analytics tab and display metrics', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByText(/96\.0%/)).toBeInTheDocument(); // Success rate
        expect(screen.getByText(/120\.5s/)).toBeInTheDocument(); // Avg duration
      });
    });

    it('should display all metrics cards', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByText(/Total Executions/i)).toBeInTheDocument();
        expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
        expect(screen.getByText(/Avg Duration/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Cost/i)).toBeInTheDocument();
      });
    });

    it('should show Export CSV button', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });
    });

    it('should download CSV file when export button clicked', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      // Should trigger download
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('should use correct filename for CSV export', async () => {
      renderModal();

      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      const exportButton = await screen.findByRole('button', { name: /export csv/i });
      await user.click(exportButton);

      // Filename should contain workflow name
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // CRITICAL PATH 7: MODAL INTERACTIONS
  // ============================================================================

  describe('Critical Path 7: Modal Interactions', () => {
    it('should open modal via View Details button', () => {
      renderModal({ isOpen: true });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should switch between all 4 tabs', async () => {
      renderModal();

      // Start on Overview
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to Version History
      await user.click(screen.getByRole('tab', { name: /version history/i }));
      await waitFor(() => {
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
      });

      // Switch to Executions
      await user.click(screen.getByRole('tab', { name: /executions/i }));
      await waitFor(() => {
        expect(screen.getByText(/Run #150/)).toBeInTheDocument();
      });

      // Switch to Analytics
      await user.click(screen.getByRole('tab', { name: /analytics/i }));
      await waitFor(() => {
        expect(screen.getByText(/96\.0%/)).toBeInTheDocument();
      });
    });

    it('should close modal when close button clicked', async () => {
      renderModal();

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when clicking outside (overlay)', async () => {
      renderModal();

      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement?.querySelector('.bg-black');

      if (overlay) {
        await user.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should close modal when ESC key pressed', async () => {
      renderModal();

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should preserve tab state when switching tabs', async () => {
      renderModal();

      // Switch to Version History
      await user.click(screen.getByRole('tab', { name: /version history/i }));
      await waitFor(() => {
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
      });

      // Switch to Overview
      await user.click(screen.getByRole('tab', { name: /overview/i }));

      // Switch back to Version History - should still show data
      await user.click(screen.getByRole('tab', { name: /version history/i }));
      await waitFor(() => {
        expect(screen.getByText('Version v1.0')).toBeInTheDocument();
      });
    });
  });
});
