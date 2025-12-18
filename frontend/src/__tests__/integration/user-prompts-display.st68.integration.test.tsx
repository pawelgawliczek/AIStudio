/**
 * ST-68: Integration tests for User Prompts KPI display
 * Tests end-to-end flow from API to frontend rendering
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectProvider } from '../../context/ProjectContext';
import { PerformanceDashboard } from '../../pages/PerformanceDashboard';
import { apiClient } from '../../services/api.client';

// Mock dependencies
vi.mock('../../services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProjectProvider>{children}</ProjectProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('User Prompts KPI - End-to-End Integration (ST-68)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should display user prompts from API through to frontend KPI card', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 15,
        storiesChange: 8.5,
        tokensPerLOC: 145.2,
        tokensPerLOCChange: -5.3,
        promptsPerStory: 7.8,
        promptsPerStoryChange: -12.1,
        timePerLOC: 0.45,
        timePerLOCChange: 2.8,
        totalUserPrompts: 127,
        totalUserPromptsChange: -18.5,
      },
      trends: {
        storiesImplemented: [
          { date: '2025-01-01', allWorkflows: 5, selectedWorkflows: 5 },
          { date: '2025-01-08', allWorkflows: 10, selectedWorkflows: 10 },
          { date: '2025-01-15', allWorkflows: 15, selectedWorkflows: 15 },
        ],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [
        { id: 'workflow-1', name: 'Full Stack Workflow' },
        { id: 'workflow-2', name: 'Backend Only' },
      ],
      workflowsWithMetrics: [
        {
          id: 'workflow-1',
          name: 'Full Stack Workflow',
          storiesCount: 10,
          bugsCount: 2,
          avgPromptsPerStory: 8.5,
          avgTokensPerLOC: 150.0,
        },
        {
          id: 'workflow-2',
          name: 'Backend Only',
          storiesCount: 5,
          bugsCount: 0,
          avgPromptsPerStory: 6.2,
          avgTokensPerLOC: 120.0,
        },
      ],
      counts: {
        filteredStories: 15,
        totalStories: 20,
        filteredBugs: 2,
        totalBugs: 3,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      // Verify KPI card is rendered
      expect(screen.getByText('Human Prompts')).toBeInTheDocument();

      // Verify value is displayed
      expect(screen.getByText('127')).toBeInTheDocument();

      // Verify trend is negative (good - decreasing intervention)
      expect(screen.getByText(/-18\.5%/)).toBeInTheDocument();

      // Verify other KPI cards are also rendered (context check)
      expect(screen.getByText('Stories Implemented')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('should show automation improvement when prompts decrease over time', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 20,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 5.5,
        promptsPerStoryChange: -30.0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 110,
        totalUserPromptsChange: -30.0, // 30% reduction = automation improvement
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 20,
        totalStories: 20,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      const trendElement = screen.getByText(/-30\.0%/);
      expect(trendElement).toBeInTheDocument();

      // Negative trend should have green color (improvement)
      expect(trendElement.className).toMatch(/green/i);
    });
  });

  it('should show warning when prompts increase (more intervention needed)', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 12,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 12.5,
        promptsPerStoryChange: 50.0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 225,
        totalUserPromptsChange: 50.0, // 50% increase = needs investigation
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 12,
        totalStories: 12,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      const trendElement = screen.getByText(/\+50\.0%/);
      expect(trendElement).toBeInTheDocument();

      // Positive trend should have red color (warning)
      expect(trendElement.className).toMatch(/red/i);
    });
  });

  it('should celebrate fully automated workflows (zero prompts)', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 8,
        storiesChange: 0,
        tokensPerLOC: 120,
        tokensPerLOCChange: 0,
        promptsPerStory: 0,
        promptsPerStoryChange: -100.0,
        timePerLOC: 0.4,
        timePerLOCChange: 0,
        totalUserPrompts: 0, // Perfect automation!
        totalUserPromptsChange: -100.0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 8,
        totalStories: 8,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Human Prompts')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText(/-100\.0%/)).toBeInTheDocument();
    });
  });

  it('should handle workflow filtering and update prompts count', async () => {
    const allWorkflowsResponse = {
      kpis: {
        storiesImplemented: 15,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8.0,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 200,
        totalUserPromptsChange: 0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [
        { id: 'workflow-1', name: 'High Automation' },
        { id: 'workflow-2', name: 'Manual Heavy' },
      ],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 15,
        totalStories: 15,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    const filteredWorkflowResponse = {
      ...allWorkflowsResponse,
      kpis: {
        ...allWorkflowsResponse.kpis,
        storiesImplemented: 10,
        totalUserPrompts: 50, // Much lower with filtered workflow
      },
      counts: {
        filteredStories: 10,
        totalStories: 15,
        filteredBugs: 0,
        totalBugs: 0,
      },
    };

    // Initial load - all workflows
    (apiClient.get as any).mockResolvedValueOnce({ data: allWorkflowsResponse });

    const { rerender } = render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    // Filter to specific workflow
    (apiClient.get as any).mockResolvedValueOnce({ data: filteredWorkflowResponse });

    rerender(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  it('should handle date range changes and recalculate metrics', async () => {
    const weekResponse = {
      kpis: {
        storiesImplemented: 5,
        storiesChange: 0,
        tokensPerLOC: 140,
        tokensPerLOCChange: 0,
        promptsPerStory: 7.0,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 35,
        totalUserPromptsChange: -10.0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 5,
        totalStories: 5,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    const monthResponse = {
      ...weekResponse,
      kpis: {
        ...weekResponse.kpis,
        storiesImplemented: 20,
        totalUserPrompts: 160,
        totalUserPromptsChange: -15.0,
      },
      counts: {
        filteredStories: 20,
        totalStories: 20,
        filteredBugs: 0,
        totalBugs: 0,
      },
    };

    // Week view
    (apiClient.get as any).mockResolvedValueOnce({ data: weekResponse });

    const { rerender } = render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(screen.getByText('35')).toBeInTheDocument();
    });

    // Month view
    (apiClient.get as any).mockResolvedValueOnce({ data: monthResponse });

    rerender(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('160')).toBeInTheDocument();
    });
  });

  it('should gracefully handle backend errors', async () => {
    (apiClient.get as any).mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      // Should show error state
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });
  });

  it('should handle slow API responses with loading state', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 100,
        totalUserPromptsChange: 0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 10,
        totalStories: 10,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    // Delay API response
    (apiClient.get as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: mockApiResponse }), 1000))
    );

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    // Should show loading state initially
    expect(screen.queryByText('Human Prompts')).not.toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(screen.getByText('Human Prompts')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should maintain accessibility with proper ARIA labels', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 100,
        totalUserPromptsChange: -10.0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 10,
        totalStories: 10,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    const { container } = render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      // Check for accessibility attributes
      const elements = container.querySelectorAll('[aria-label], [role], [title]');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('should format numbers correctly with locale formatting', async () => {
    const mockApiResponse = {
      kpis: {
        storiesImplemented: 100,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 1234567, // Large number
        totalUserPromptsChange: 0,
      },
      trends: {
        storiesImplemented: [],
        tokensPerLOC: [],
        promptsPerStory: [],
        timePerLOC: [],
      },
      workflows: [],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 100,
        totalStories: 100,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: '2025-01-20T10:00:00Z',
    };

    (apiClient.get as any).mockResolvedValue({ data: mockApiResponse });

    render(<PerformanceDashboard />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      // Should format with thousand separators
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });
  });
});
