/**
 * ST-137: SlowTestsPanel Component Tests
 * Tests for the slow tests analytics panel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SlowTestsPanel } from '../SlowTestsPanel';
import { testExecutionService, SlowTest } from '../../services/test-execution.service';

vi.mock('../../services/test-execution.service');

const mockSlowTests: SlowTest[] = [
  {
    testKey: 'TC-E2E-001',
    title: 'Full checkout flow test',
    testLevel: 'e2e',
    avgDurationMs: 15000,
    maxDurationMs: 18000,
    runCount: 50,
  },
  {
    testKey: 'TC-INT-001',
    title: 'Database migration test',
    testLevel: 'integration',
    avgDurationMs: 7500,
    maxDurationMs: 9000,
    runCount: 30,
  },
  {
    testKey: 'TC-UNIT-001',
    title: 'Complex algorithm validation',
    testLevel: 'unit',
    avgDurationMs: 800,
    maxDurationMs: 1200,
    runCount: 100,
  },
];

describe('SlowTestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(testExecutionService.getSlowTests).mockResolvedValue(mockSlowTests);
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe('Loading State', () => {
    it('should render loading state initially', () => {
      vi.mocked(testExecutionService.getSlowTests).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<SlowTestsPanel projectId="project-1" />);

      // Check for loading animation
      const loadingDots = document.querySelectorAll('.animate-pulse');
      expect(loadingDots.length).toBeGreaterThan(0);
    });

    it('should display loading spinner with three animated dots', () => {
      vi.mocked(testExecutionService.getSlowTests).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SlowTestsPanel projectId="project-1" />);

      const container = screen.getByText((content, element) => {
        return element?.className?.includes('flex items-center gap-2') || false;
      }, { selector: 'div' }).parentElement;

      const dots = container?.querySelectorAll('.bg-primary');
      expect(dots?.length).toBe(3);
    });
  });

  // ============================================================================
  // DATA RENDERING TESTS
  // ============================================================================

  describe('Data Rendering', () => {
    it('should render slow tests table when data loads', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('TC-E2E-001')).toBeInTheDocument();
        expect(screen.getByText('TC-INT-001')).toBeInTheDocument();
        expect(screen.getByText('TC-UNIT-001')).toBeInTheDocument();
      });
    });

    it('should display test titles', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Full checkout flow test')).toBeInTheDocument();
        expect(screen.getByText('Database migration test')).toBeInTheDocument();
        expect(screen.getByText('Complex algorithm validation')).toBeInTheDocument();
      });
    });

    it('should display test level badges', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('e2e')).toBeInTheDocument();
        expect(screen.getByText('integration')).toBeInTheDocument();
        expect(screen.getByText('unit')).toBeInTheDocument();
      });
    });

    it('should display run counts', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      });
    });

    it('should display header with limit', async () => {
      render(<SlowTestsPanel projectId="project-1" limit={10} />);

      await waitFor(() => {
        expect(screen.getByText('Slowest Tests (Top 10)')).toBeInTheDocument();
      });
    });

    it('should display custom limit in header', async () => {
      render(<SlowTestsPanel projectId="project-1" limit={20} />);

      await waitFor(() => {
        expect(screen.getByText('Slowest Tests (Top 20)')).toBeInTheDocument();
      });
    });

    it('should display subtitle', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Tests with the longest average execution times/i)).toBeInTheDocument();
      });
    });

    it('should display rank numbers', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================

  describe('Empty State', () => {
    it('should show empty state when no slow tests', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('No Slow Tests Detected')).toBeInTheDocument();
      });
    });

    it('should display speed icon in empty state', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('speed')).toBeInTheDocument();
      });
    });

    it('should display encouraging message in empty state', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText(/All tests are running efficiently/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // DURATION FORMATTING TESTS
  // ============================================================================

  describe('Duration Formatting', () => {
    it('should format durations < 1000ms as milliseconds', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('800ms')).toBeInTheDocument();
      });
    });

    it('should format durations >= 1000ms as seconds', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('15.00s')).toBeInTheDocument();
        expect(screen.getByText('7.50s')).toBeInTheDocument();
      });
    });

    it('should format max durations correctly', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('18.00s')).toBeInTheDocument();
        expect(screen.getByText('9.00s')).toBeInTheDocument();
        expect(screen.getByText('1.20s')).toBeInTheDocument(); // 1200ms = 1.20s
      });
    });

    it('should handle edge case: exactly 1000ms', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          avgDurationMs: 1000,
          maxDurationMs: 1000,
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const allText = screen.getAllByText('1.00s');
        expect(allText.length).toBeGreaterThanOrEqual(2); // Both avg and max
      });
    });

    it('should handle edge case: 0ms', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          avgDurationMs: 0,
          maxDurationMs: 0,
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const allZeros = screen.getAllByText('0ms');
        expect(allZeros.length).toBeGreaterThanOrEqual(2); // Both avg and max
      });
    });
  });

  // ============================================================================
  // COLOR CODING TESTS
  // ============================================================================

  describe('Color Coding', () => {
    it('should color-code duration > 10000ms as red', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const durationCell = screen.getByText('15.00s');
        expect(durationCell.className).toContain('text-red-600');
      });
    });

    it('should color-code duration > 5000ms and <= 10000ms as yellow', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const durationCell = screen.getByText('7.50s');
        expect(durationCell.className).toContain('text-yellow-600');
      });
    });

    it('should color-code duration <= 5000ms as default gray', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const durationCell = screen.getByText('800ms');
        expect(durationCell.className).toContain('text-gray-900');
      });
    });

    it('should apply test level badge colors correctly for unit tests', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const unitBadge = screen.getByText('unit');
        expect(unitBadge.className).toContain('bg-blue-100');
      });
    });

    it('should apply test level badge colors correctly for integration tests', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const integrationBadge = screen.getByText('integration');
        expect(integrationBadge.className).toContain('bg-purple-100');
      });
    });

    it('should apply test level badge colors correctly for e2e tests', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const e2eBadge = screen.getByText('e2e');
        expect(e2eBadge.className).toContain('bg-orange-100');
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(testExecutionService.getSlowTests).mockRejectedValue(new Error('API Error'));

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load slow tests')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch slow tests:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should display error message in red border box', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockRejectedValue(new Error('API Error'));

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const errorBox = screen.getByText('Failed to load slow tests');
        expect(errorBox.className).toMatch(/text-red-600|dark:text-red-400/);
      });
    });

    it('should not crash when API returns malformed data', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue(null as any);

      expect(() => render(<SlowTestsPanel projectId="project-1" />)).not.toThrow();
    });
  });

  // ============================================================================
  // API CALL TESTS
  // ============================================================================

  describe('API Calls', () => {
    it('should call getSlowTests with correct projectId', async () => {
      render(<SlowTestsPanel projectId="project-123" />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-123', 10);
      });
    });

    it('should call getSlowTests with custom limit parameter', async () => {
      render(<SlowTestsPanel projectId="project-1" limit={20} />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-1', 20);
      });
    });

    it('should not call API when projectId is empty', async () => {
      render(<SlowTestsPanel projectId="" />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).not.toHaveBeenCalled();
      });
    });

    it('should refetch when projectId changes', async () => {
      const { rerender } = render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-1', 10);
      });

      vi.clearAllMocks();

      rerender(<SlowTestsPanel projectId="project-2" />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-2', 10);
      });
    });

    it('should refetch when limit parameter changes', async () => {
      const { rerender } = render(<SlowTestsPanel projectId="project-1" limit={10} />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-1', 10);
      });

      vi.clearAllMocks();

      rerender(<SlowTestsPanel projectId="project-1" limit={20} />);

      await waitFor(() => {
        expect(testExecutionService.getSlowTests).toHaveBeenCalledWith('project-1', 20);
      });
    });
  });

  // ============================================================================
  // TABLE STRUCTURE TESTS
  // ============================================================================

  describe('Table Structure', () => {
    it('should render table with correct headers', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Rank')).toBeInTheDocument();
        expect(screen.getByText('Test Key')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Level')).toBeInTheDocument();
        expect(screen.getByText('Avg Duration')).toBeInTheDocument();
        expect(screen.getByText('Max Duration')).toBeInTheDocument();
        expect(screen.getByText('Run Count')).toBeInTheDocument();
      });
    });

    it('should render table rows with hover effect', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const rows = document.querySelectorAll('tbody tr');
        expect(rows.length).toBe(3);
        rows.forEach(row => {
          expect(row.className).toMatch(/hover:bg-gray-50|dark:hover:bg-gray-800/);
        });
      });
    });

    it('should render test keys in monospace font', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const testKey = screen.getByText('TC-E2E-001');
        expect(testKey.className).toMatch(/font-mono/);
      });
    });

    it('should render rank badges with circular styling', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const rankBadges = document.querySelectorAll('.rounded-full');
        expect(rankBadges.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ============================================================================
  // PERFORMANCE TIPS TESTS
  // ============================================================================

  describe('Performance Tips', () => {
    it('should display performance tips info box', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Performance Tips')).toBeInTheDocument();
      });
    });

    it('should display info icon for performance tips', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('info')).toBeInTheDocument();
      });
    });

    it('should display all three performance tips', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Tests over 10s are highlighted in red/i)).toBeInTheDocument();
        expect(screen.getByText(/Consider splitting large E2E tests/i)).toBeInTheDocument();
        expect(screen.getByText(/Use test fixtures and mocks/i)).toBeInTheDocument();
      });
    });

    it('should display performance tips in blue info box', async () => {
      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const tipsBox = screen.getByText('Performance Tips').closest('div')?.parentElement?.parentElement;
        expect(tipsBox?.className).toContain('bg-blue-50');
      });
    });
  });

  // ============================================================================
  // EDGE CASES TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single slow test', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([mockSlowTests[0]]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('TC-E2E-001')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should handle large limit value', async () => {
      const manyTests = Array.from({ length: 50 }, (_, i) => ({
        ...mockSlowTests[0],
        testKey: `TC-TEST-${i.toString().padStart(3, '0')}`,
      }));
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue(manyTests);

      render(<SlowTestsPanel projectId="project-1" limit={50} />);

      await waitFor(() => {
        expect(screen.getByText('Slowest Tests (Top 50)')).toBeInTheDocument();
      });
    });

    it('should handle tests with unknown test level', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          testLevel: 'custom',
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const customBadge = screen.getByText('custom');
        expect(customBadge.className).toMatch(/bg-gray-100|text-gray-800/);
      });
    });

    it('should handle very fast tests (< 1ms)', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          avgDurationMs: 0.5,
          maxDurationMs: 0.8,
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        // Both should round to 0ms or 1ms
        const textContent = document.body.textContent || '';
        expect(textContent).toMatch(/0ms|1ms/);
      });
    });

    it('should handle very slow tests (> 60s)', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          avgDurationMs: 75000,
          maxDurationMs: 90000,
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('75.00s')).toBeInTheDocument();
        expect(screen.getByText('90.00s')).toBeInTheDocument();
      });
    });

    it('should handle decimal precision in seconds', async () => {
      vi.mocked(testExecutionService.getSlowTests).mockResolvedValue([
        {
          ...mockSlowTests[0],
          avgDurationMs: 1234.567,
          maxDurationMs: 5678.901,
        },
      ]);

      render(<SlowTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('1.23s')).toBeInTheDocument();
        expect(screen.getByText('5.68s')).toBeInTheDocument();
      });
    });
  });
});
