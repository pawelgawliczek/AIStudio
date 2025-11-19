/**
 * ST-68: Tests for User Interactions display in TokenMetricsPanel
 * Tests story details summary card and orchestrator detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenMetricsPanel } from '../TokenMetricsPanel';
import { api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('TokenMetricsPanel - User Interactions (ST-68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display total user interactions summary card', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 50000,
      totalCost: 2.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 30000,
          cost: 1.50,
          components: [
            {
              componentName: 'Orchestrator',
              tokens: 10000,
              cost: 0.50,
              userPrompts: 8,
              iterations: 3,
            },
            {
              componentName: 'Developer',
              tokens: 20000,
              cost: 1.00,
              userPrompts: 2,
              iterations: 1,
            },
          ],
        },
        {
          workflowRunId: 'run-2',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T11:00:00Z',
          completedAt: '2025-01-01T11:20:00Z',
          tokens: 20000,
          cost: 1.00,
          components: [
            {
              componentName: 'Coordinator',
              tokens: 8000,
              cost: 0.40,
              userPrompts: 5,
              iterations: 2,
            },
            {
              componentName: 'QA',
              tokens: 12000,
              cost: 0.60,
              userPrompts: 1,
              iterations: 1,
            },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Should display User Interactions card
      expect(screen.getByText('User Interactions')).toBeInTheDocument();

      // Total prompts: 8 + 2 + 5 + 1 = 16
      expect(screen.getByText('16')).toBeInTheDocument();

      // Should show ChatBubbleLeftIcon
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  it('should calculate and display orchestrator prompts separately', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 30000,
      totalCost: 1.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 30000,
          cost: 1.50,
          components: [
            {
              componentName: 'Orchestrator',
              tokens: 10000,
              cost: 0.50,
              userPrompts: 12,
              iterations: 4,
            },
            {
              componentName: 'Developer',
              tokens: 15000,
              cost: 0.75,
              userPrompts: 3,
              iterations: 1,
            },
            {
              componentName: 'QA',
              tokens: 5000,
              cost: 0.25,
              userPrompts: 1,
              iterations: 1,
            },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Total: 12 + 3 + 1 = 16
      expect(screen.getByText('16')).toBeInTheDocument();

      // Orchestrator only: 12
      expect(screen.getByText(/Orchestrator:\s*12/)).toBeInTheDocument();
    });
  });

  it('should detect orchestrator by multiple naming patterns', async () => {
    const namingVariants = [
      'Orchestrator',
      'orchestrator',
      'Coordinator',
      'coordinator',
      'OrchestrationAgent',
      'CoordinatorAgent',
    ];

    for (const name of namingVariants) {
      vi.clearAllMocks();

      const mockMetrics = {
        storyId: 'story-123',
        storyKey: 'ST-68',
        totalTokens: 10000,
        totalCost: 0.50,
        breakdown: [
          {
            workflowRunId: 'run-1',
            workflowName: 'Test Workflow',
            status: 'completed',
            startedAt: '2025-01-01T10:00:00Z',
            completedAt: '2025-01-01T10:30:00Z',
            tokens: 10000,
            cost: 0.50,
            components: [
              {
                componentName: name,
                tokens: 10000,
                cost: 0.50,
                userPrompts: 7,
                iterations: 2,
              },
            ],
          },
        ],
      };

      (api.get as any).mockResolvedValue({ data: mockMetrics });

      const { unmount } = render(<TokenMetricsPanel storyId="story-123" />);

      await waitFor(() => {
        // Should detect as orchestrator regardless of naming
        expect(screen.getByText(/Orchestrator:\s*7/)).toBeInTheDocument();
      });

      unmount();
    }
  });

  it('should handle zero user prompts (fully automated)', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 20000,
      totalCost: 1.00,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 20000,
          cost: 1.00,
          components: [
            {
              componentName: 'Orchestrator',
              tokens: 5000,
              cost: 0.25,
              userPrompts: 0, // Fully automated
              iterations: 1,
            },
            {
              componentName: 'Developer',
              tokens: 15000,
              cost: 0.75,
              userPrompts: 0,
              iterations: 1,
            },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      expect(screen.getByText('User Interactions')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText(/Orchestrator:\s*0/)).toBeInTheDocument();
    });
  });

  it('should handle missing userPrompts field gracefully', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 10000,
      totalCost: 0.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 10000,
          cost: 0.50,
          components: [
            {
              componentName: 'Orchestrator',
              tokens: 10000,
              cost: 0.50,
              // userPrompts missing (old data)
              iterations: 1,
            },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Should default to 0
      expect(screen.getByText('User Interactions')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should aggregate across multiple workflow runs', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 90000,
      totalCost: 4.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Workflow 1',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 30000,
          cost: 1.50,
          components: [
            { componentName: 'Orchestrator', tokens: 10000, cost: 0.50, userPrompts: 5, iterations: 2 },
            { componentName: 'Developer', tokens: 20000, cost: 1.00, userPrompts: 2, iterations: 1 },
          ],
        },
        {
          workflowRunId: 'run-2',
          workflowName: 'Workflow 2',
          status: 'completed',
          startedAt: '2025-01-01T11:00:00Z',
          completedAt: '2025-01-01T11:20:00Z',
          tokens: 20000,
          cost: 1.00,
          components: [
            { componentName: 'Coordinator', tokens: 8000, cost: 0.40, userPrompts: 3, iterations: 1 },
            { componentName: 'QA', tokens: 12000, cost: 0.60, userPrompts: 1, iterations: 1 },
          ],
        },
        {
          workflowRunId: 'run-3',
          workflowName: 'Workflow 3',
          status: 'completed',
          startedAt: '2025-01-01T12:00:00Z',
          completedAt: '2025-01-01T12:15:00Z',
          tokens: 40000,
          cost: 2.00,
          components: [
            { componentName: 'Orchestration', tokens: 15000, cost: 0.75, userPrompts: 7, iterations: 3 },
            { componentName: 'Developer', tokens: 25000, cost: 1.25, userPrompts: 4, iterations: 2 },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Total: 5+2+3+1+7+4 = 22
      expect(screen.getByText('22')).toBeInTheDocument();

      // Orchestrator only: 5+3+7 = 15
      expect(screen.getByText(/Orchestrator:\s*15/)).toBeInTheDocument();
    });
  });

  it('should handle no workflow runs (no data)', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 0,
      totalCost: 0,
      breakdown: [],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Should show "No execution data" message
      expect(screen.getByText(/No execution data available/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    (api.get as any).mockRejectedValue({
      response: { data: { message: 'Story not found' } },
    });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText(/Story not found/)).toBeInTheDocument();
    });
  });

  it('should display info tooltip explaining the metric', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 10000,
      totalCost: 0.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 10000,
          cost: 0.50,
          components: [
            { componentName: 'Orchestrator', tokens: 10000, cost: 0.50, userPrompts: 5, iterations: 1 },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    const { container } = render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Should have info icon with tooltip
      const tooltips = container.querySelectorAll('[title*="interactions"], [title*="prompts"]');
      expect(tooltips.length).toBeGreaterThan(0);
    });
  });

  it('should be part of 4-card grid layout', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 10000,
      totalCost: 0.50,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 10000,
          cost: 0.50,
          components: [
            { componentName: 'Orchestrator', tokens: 10000, cost: 0.50, userPrompts: 5, iterations: 1 },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    const { container } = render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Should verify grid layout includes user interactions card
      const summaryCards = container.querySelectorAll('.bg-card');
      expect(summaryCards.length).toBeGreaterThanOrEqual(4); // Total Tokens, Total Cost, Workflow Runs, User Interactions
    });
  });

  it('should handle workflows with no orchestrator component', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 20000,
      totalCost: 1.00,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Test Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T10:30:00Z',
          tokens: 20000,
          cost: 1.00,
          components: [
            { componentName: 'Developer', tokens: 10000, cost: 0.50, userPrompts: 3, iterations: 1 },
            { componentName: 'QA', tokens: 10000, cost: 0.50, userPrompts: 2, iterations: 1 },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Total prompts: 3 + 2 = 5
      expect(screen.getByText('5')).toBeInTheDocument();

      // Orchestrator: 0 (none found)
      expect(screen.getByText(/Orchestrator:\s*0/)).toBeInTheDocument();
    });
  });

  it('should handle high numbers of user prompts correctly', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 500000,
      totalCost: 25.00,
      breakdown: [
        {
          workflowRunId: 'run-1',
          workflowName: 'Complex Workflow',
          status: 'completed',
          startedAt: '2025-01-01T10:00:00Z',
          completedAt: '2025-01-01T12:00:00Z',
          tokens: 500000,
          cost: 25.00,
          components: [
            { componentName: 'Orchestrator', tokens: 200000, cost: 10.00, userPrompts: 150, iterations: 50 },
            { componentName: 'Developer', tokens: 300000, cost: 15.00, userPrompts: 75, iterations: 25 },
          ],
        },
      ],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      // Total: 150 + 75 = 225
      expect(screen.getByText('225')).toBeInTheDocument();

      // Orchestrator: 150
      expect(screen.getByText(/Orchestrator:\s*150/)).toBeInTheDocument();
    });
  });
});

describe('TokenMetricsPanel - calculateTotalUserPrompts helper', () => {
  it('should return 0 for empty breakdown', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 0,
      totalCost: 0,
      breakdown: [],
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No execution data available/i)).toBeInTheDocument();
    });
  });

  it('should return 0 for null breakdown', async () => {
    const mockMetrics = {
      storyId: 'story-123',
      storyKey: 'ST-68',
      totalTokens: 0,
      totalCost: 0,
      breakdown: null,
    };

    (api.get as any).mockResolvedValue({ data: mockMetrics });

    render(<TokenMetricsPanel storyId="story-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No execution data available/i)).toBeInTheDocument();
    });
  });
});
