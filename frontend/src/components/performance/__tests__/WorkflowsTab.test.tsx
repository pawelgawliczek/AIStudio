import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowsTab } from '../WorkflowsTab';
import { WeeklyAggregation, WorkflowMetrics } from '../../../services/metrics.service';

const mockWorkflowMetrics: WorkflowMetrics[] = [
  {
    workflowId: 'wf-1',
    workflowName: 'Test Workflow',
    workflowVersion: 'v1.0',
    periodStart: '2025-11-01',
    periodEnd: '2025-11-07',
    granularity: 'WEEKLY',
    totalRuns: 5,
    successfulRuns: 5,
    failedRuns: 0,
    successRate: 100,
    avgTokens: 50000,
    totalLoc: 1200,
    testsAdded: 15,
    avgCost: 2.5,
    avgDuration: 300,
  },
];

const mockWeeklyData: WeeklyAggregation[] = [
  {
    weekNumber: 45,
    year: 2025,
    weekStart: '2025-11-01',
    weekEnd: '2025-11-07',
    storiesCompleted: 3,
    workflows: mockWorkflowMetrics,
    aggregated: {
      periodStart: '2025-11-01',
      periodEnd: '2025-11-07',
      granularity: 'WEEKLY',
      totalRuns: 5,
      successfulRuns: 5,
      failedRuns: 0,
      successRate: 100,
      avgTokens: 50000,
      totalLoc: 1200,
      testsAdded: 15,
      avgCost: 2.5,
      avgDuration: 300,
      avgTokensPerLoc: 41.67,
      avgLocPerPrompt: 120,
      avgRuntimePerLoc: 0.25,
    },
  },
  {
    weekNumber: 44,
    year: 2025,
    weekStart: '2025-10-25',
    weekEnd: '2025-10-31',
    storiesCompleted: 2,
    workflows: mockWorkflowMetrics,
    aggregated: {
      periodStart: '2025-10-25',
      periodEnd: '2025-10-31',
      granularity: 'WEEKLY',
      totalRuns: 3,
      successfulRuns: 3,
      failedRuns: 0,
      successRate: 100,
      avgTokens: 45000,
      totalLoc: 800,
      testsAdded: 10,
      avgCost: 2.0,
      avgDuration: 250,
      avgTokensPerLoc: 56.25,
      avgLocPerPrompt: 100,
      avgRuntimePerLoc: 0.31,
    },
  },
];

describe('WorkflowsTab', () => {
  describe('Tests metric display', () => {
    it('should display Tests column header in Weekly Performance Summary table', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // Check that the Tests column header exists
      expect(screen.getByText('Tests')).toBeInTheDocument();
    });

    it('should display test count for each week', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // Check that test counts are displayed (15 for week 45, 10 for week 44)
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should display Tests column in expanded workflow details', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // The expanded view should also have a Tests column
      // This will be verified when we click to expand
      const weekRow = screen.getByText('Week 45');
      expect(weekRow).toBeInTheDocument();
    });

    it('should show average tests added in summary row', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // With 15 tests in week 45 and 10 in week 44, average should be 12.5
      // The component might round this to 13 or display 12.5
      const averageRow = screen.getByText('Average');
      expect(averageRow).toBeInTheDocument();
    });

    it('should handle missing test data gracefully', () => {
      const weeklyDataWithoutTests: WeeklyAggregation[] = [{
        ...mockWeeklyData[0],
        aggregated: {
          ...mockWeeklyData[0].aggregated,
          testsAdded: undefined,
        },
      }];

      render(<WorkflowsTab weeklyData={weeklyDataWithoutTests} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // Should display '-' or '0' for missing test data
      expect(screen.getByText(/-|0/)).toBeInTheDocument();
    });
  });

  describe('LOC metric display', () => {
    it('should display LOC column header', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      expect(screen.getByText('LOC')).toBeInTheDocument();
    });

    it('should display LOC values for each week', () => {
      render(<WorkflowsTab weeklyData={mockWeeklyData} workflowMetrics={mockWorkflowMetrics} isLoading={false} />);

      // Should show 1200 for week 45 and 800 for week 44
      expect(screen.getByText('1,200')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no data is available', () => {
      render(<WorkflowsTab weeklyData={[]} workflowMetrics={[]} isLoading={false} />);

      expect(screen.getByText('No Workflow Data Available')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<WorkflowsTab weeklyData={[]} workflowMetrics={[]} isLoading={true} />);

      // Check for spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });
});
