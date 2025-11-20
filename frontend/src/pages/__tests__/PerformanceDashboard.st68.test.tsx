/**
 * ST-68: Tests for User Interactions KPI display on Performance Dashboard
 * Tests frontend rendering of totalUserPrompts and trend indicators
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { ProjectProvider } from '../../context/ProjectContext';
import { apiClient } from '../../services/api.client';

// Mock API client
vi.mock('../../services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock recharts to avoid rendering issues in tests
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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>{children}</ProjectProvider>
    </QueryClientProvider>
  );
};

describe('PerformanceDashboard - User Interactions KPI (ST-68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display totalUserPrompts KPI card with correct value', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 5.0,
        tokensPerLOC: 150.5,
        tokensPerLOCChange: -2.3,
        promptsPerStory: 8.2,
        promptsPerStoryChange: -10.5,
        timePerLOC: 0.5,
        timePerLOCChange: 3.2,
        totalUserPrompts: 127,
        totalUserPromptsChange: -12.5,
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
        totalStories: 15,
        filteredBugs: 2,
        totalBugs: 3,
      },
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check that Human Prompts KPI card is rendered
      expect(screen.getByText('Human Prompts')).toBeInTheDocument();

      // Check the value is displayed correctly with formatting
      expect(screen.getByText('127')).toBeInTheDocument();
    });
  });

  it('should display negative trend indicator (green) when prompts decrease', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 85,
        totalUserPromptsChange: -25.0, // Negative = improvement
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Negative change should show with green styling (improvement)
      const trendElement = screen.getByText(/-25\.0%/);
      expect(trendElement).toBeInTheDocument();

      // Should have green color class (improvement indicator)
      expect(trendElement.className).toMatch(/green|success/i);
    });
  });

  it('should display positive trend indicator (red) when prompts increase', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 200,
        totalUserPromptsChange: 45.5, // Positive = more intervention needed
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Positive change should show with red styling (more intervention)
      const trendElement = screen.getByText(/\+45\.5%/);
      expect(trendElement).toBeInTheDocument();

      // Should have red color class (warning indicator)
      expect(trendElement.className).toMatch(/red|danger|warning/i);
    });
  });

  it('should display zero prompts (fully automated workflows)', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 5,
        storiesChange: 0,
        tokensPerLOC: 120,
        tokensPerLOCChange: 0,
        promptsPerStory: 0,
        promptsPerStoryChange: 0,
        timePerLOC: 0.4,
        timePerLOCChange: 0,
        totalUserPrompts: 0, // Fully automated!
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
        filteredStories: 5,
        totalStories: 5,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Human Prompts')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should format large numbers with thousand separators', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 100,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        totalUserPrompts: 12345, // Large number
        totalUserPromptsChange: 5.0,
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should format with thousand separator
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });
  });

  it('should display info tooltip with explanation', async () => {
    const mockData = {
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
        totalUserPromptsChange: -5.0,
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    const { container } = render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should have info icon with tooltip
      const infoIcons = container.querySelectorAll('svg[data-tooltip], [title*="human"], [title*="prompt"]');
      expect(infoIcons.length).toBeGreaterThan(0);
    });
  });

  it('should handle missing totalUserPrompts field gracefully (backward compatibility)', async () => {
    const mockData = {
      kpis: {
        storiesImplemented: 10,
        storiesChange: 0,
        tokensPerLOC: 150,
        tokensPerLOCChange: 0,
        promptsPerStory: 8,
        promptsPerStoryChange: 0,
        timePerLOC: 0.5,
        timePerLOCChange: 0,
        // totalUserPrompts missing (old API response)
        // totalUserPromptsChange missing
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should default to 0 when field is missing
      expect(screen.getByText('Human Prompts')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should be positioned in 5-column grid layout on desktop', async () => {
    const mockData = {
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
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockData });

    const { container } = render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should have grid with 5 columns
      const gridElement = container.querySelector('[class*="lg:grid-cols-5"]');
      expect(gridElement).toBeTruthy();
    });
  });

  it('should handle API errors gracefully', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('API Error'));

    render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should show error state
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });
  });

  it('should update when filters change (workflow selection)', async () => {
    const mockDataInitial = {
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
      workflows: [
        { id: 'workflow-1', name: 'Workflow 1' },
        { id: 'workflow-2', name: 'Workflow 2' },
      ],
      workflowsWithMetrics: [],
      counts: {
        filteredStories: 10,
        totalStories: 10,
        filteredBugs: 0,
        totalBugs: 0,
      },
      generatedAt: new Date().toISOString(),
    };

    (apiClient.get as any).mockResolvedValue({ data: mockDataInitial });

    const { rerender } = render(<PerformanceDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    // Simulate filter change
    const mockDataFiltered = {
      ...mockDataInitial,
      kpis: {
        ...mockDataInitial.kpis,
        totalUserPrompts: 50, // Filtered result
      },
    };

    (apiClient.get as any).mockResolvedValue({ data: mockDataFiltered });

    rerender(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });
});
