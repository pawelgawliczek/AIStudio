/**
 * ST-137: FlakyTestsPanel Component Tests
 * Tests for the flaky tests analytics panel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FlakyTestsPanel } from '../FlakyTestsPanel';
import { testExecutionService, FlakyTest } from '../../services/test-execution.service';

vi.mock('../../services/test-execution.service');

const mockFlakyTests: FlakyTest[] = [
  {
    testKey: 'TC-AUTH-001',
    title: 'User login with valid credentials',
    testLevel: 'integration',
    totalRuns: 100,
    passCount: 60,
    failCount: 40,
    passRate: 0.6,
    failRate: 0.4,
    lastFailedAt: '2025-01-15T10:30:00Z',
  },
  {
    testKey: 'TC-AUTH-002',
    title: 'Password reset flow',
    testLevel: 'e2e',
    totalRuns: 50,
    passCount: 40,
    failCount: 10,
    passRate: 0.8,
    failRate: 0.2,
    lastFailedAt: '2025-01-14T08:00:00Z',
  },
  {
    testKey: 'TC-DB-001',
    title: 'Database connection pooling',
    testLevel: 'unit',
    totalRuns: 200,
    passCount: 195,
    failCount: 5,
    passRate: 0.975,
    failRate: 0.025,
    lastFailedAt: '2025-01-10T14:45:00Z',
  },
];

describe('FlakyTestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue(mockFlakyTests);
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe('Loading State', () => {
    it('should render loading state initially', () => {
      vi.mocked(testExecutionService.getFlakyTests).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<FlakyTestsPanel projectId="project-1" />);

      // Check for loading animation
      const loadingDots = document.querySelectorAll('.animate-pulse');
      expect(loadingDots.length).toBeGreaterThan(0);
    });

    it('should display loading spinner with three animated dots', () => {
      vi.mocked(testExecutionService.getFlakyTests).mockImplementation(
        () => new Promise(() => {})
      );

      render(<FlakyTestsPanel projectId="project-1" />);

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
    it('should render flaky tests table when data loads', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('TC-AUTH-001')).toBeInTheDocument();
        expect(screen.getByText('TC-AUTH-002')).toBeInTheDocument();
        expect(screen.getByText('TC-DB-001')).toBeInTheDocument();
      });
    });

    it('should display test titles', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('User login with valid credentials')).toBeInTheDocument();
        expect(screen.getByText('Password reset flow')).toBeInTheDocument();
        expect(screen.getByText('Database connection pooling')).toBeInTheDocument();
      });
    });

    it('should display test level badges', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('integration')).toBeInTheDocument();
        expect(screen.getByText('e2e')).toBeInTheDocument();
        expect(screen.getByText('unit')).toBeInTheDocument();
      });
    });

    it('should display total runs for each test', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
      });
    });

    it('should display pass rates as percentages', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('60.0%')).toBeInTheDocument();
        expect(screen.getByText('80.0%')).toBeInTheDocument();
        expect(screen.getByText('97.5%')).toBeInTheDocument();
      });
    });

    it('should display fail rates as percentages', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('40.0%')).toBeInTheDocument();
        expect(screen.getByText('20.0%')).toBeInTheDocument();
        expect(screen.getByText('2.5%')).toBeInTheDocument();
      });
    });

    it('should display header with count of flaky tests', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Flaky Tests (3)')).toBeInTheDocument();
      });
    });

    it('should display time range in subtitle', async () => {
      render(<FlakyTestsPanel projectId="project-1" days={30} />);

      await waitFor(() => {
        expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
      });
    });

    it('should display custom time range when provided', async () => {
      render(<FlakyTestsPanel projectId="project-1" days={7} />);

      await waitFor(() => {
        expect(screen.getByText(/last 7 days/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================

  describe('Empty State', () => {
    it('should show empty state when no flaky tests', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('No Flaky Tests Detected')).toBeInTheDocument();
      });
    });

    it('should display check_circle icon in empty state', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('check_circle')).toBeInTheDocument();
      });
    });

    it('should display encouraging message in empty state', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([]);

      render(<FlakyTestsPanel projectId="project-1" days={30} />);

      await waitFor(() => {
        expect(screen.getByText(/All tests have consistent pass\/fail results over the last 30 days/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // COLOR CODING TESTS
  // ============================================================================

  describe('Color Coding', () => {
    it('should color-code fail rate > 30% as red', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const failRateCell = screen.getByText('40.0%');
        expect(failRateCell.className).toContain('text-red-600');
      });
    });

    it('should color-code fail rate > 10% and <= 30% as yellow', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const failRateCell = screen.getByText('20.0%');
        expect(failRateCell.className).toContain('text-yellow-600');
      });
    });

    it('should color-code fail rate <= 10% as green', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const failRateCell = screen.getByText('2.5%');
        expect(failRateCell.className).toContain('text-green-600');
      });
    });

    it('should apply test level badge colors correctly for unit tests', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const unitBadge = screen.getByText('unit');
        expect(unitBadge.className).toContain('bg-blue-100');
      });
    });

    it('should apply test level badge colors correctly for integration tests', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const integrationBadge = screen.getByText('integration');
        expect(integrationBadge.className).toContain('bg-purple-100');
      });
    });

    it('should apply test level badge colors correctly for e2e tests', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const e2eBadge = screen.getByText('e2e');
        expect(e2eBadge.className).toContain('bg-orange-100');
      });
    });
  });

  // ============================================================================
  // DATE FORMATTING TESTS
  // ============================================================================

  describe('Date Formatting', () => {
    it('should format dates correctly', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        // Check that dates are formatted (should include month abbreviation)
        const dateElements = screen.getAllByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });

    it('should display "Never" for null lastFailedAt', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([
        {
          ...mockFlakyTests[0],
          lastFailedAt: null,
        },
      ]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    it('should include time in formatted dates', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        // Check for time format (should include colon for hours:minutes)
        const dateElements = screen.getAllByText(/\d{1,2}:\d{2}/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(testExecutionService.getFlakyTests).mockRejectedValue(new Error('API Error'));

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load flaky tests')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch flaky tests:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should display error message in red border box', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockRejectedValue(new Error('API Error'));

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const errorBox = screen.getByText('Failed to load flaky tests');
        expect(errorBox.className).toMatch(/text-red-600|dark:text-red-400/);
      });
    });

    it('should not crash when API returns malformed data', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue(null as any);

      expect(() => render(<FlakyTestsPanel projectId="project-1" />)).not.toThrow();
    });
  });

  // ============================================================================
  // API CALL TESTS
  // ============================================================================

  describe('API Calls', () => {
    it('should call getFlakyTests with correct projectId', async () => {
      render(<FlakyTestsPanel projectId="project-123" />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-123', 30, 0.1);
      });
    });

    it('should call getFlakyTests with custom days parameter', async () => {
      render(<FlakyTestsPanel projectId="project-1" days={7} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 7, 0.1);
      });
    });

    it('should call getFlakyTests with custom threshold parameter', async () => {
      render(<FlakyTestsPanel projectId="project-1" threshold={0.2} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 30, 0.2);
      });
    });

    it('should not call API when projectId is empty', async () => {
      render(<FlakyTestsPanel projectId="" />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).not.toHaveBeenCalled();
      });
    });

    it('should refetch when projectId changes', async () => {
      const { rerender } = render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 30, 0.1);
      });

      vi.clearAllMocks();

      rerender(<FlakyTestsPanel projectId="project-2" />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-2', 30, 0.1);
      });
    });

    it('should refetch when days parameter changes', async () => {
      const { rerender } = render(<FlakyTestsPanel projectId="project-1" days={30} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 30, 0.1);
      });

      vi.clearAllMocks();

      rerender(<FlakyTestsPanel projectId="project-1" days={7} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 7, 0.1);
      });
    });

    it('should refetch when threshold parameter changes', async () => {
      const { rerender } = render(<FlakyTestsPanel projectId="project-1" threshold={0.1} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 30, 0.1);
      });

      vi.clearAllMocks();

      rerender(<FlakyTestsPanel projectId="project-1" threshold={0.2} />);

      await waitFor(() => {
        expect(testExecutionService.getFlakyTests).toHaveBeenCalledWith('project-1', 30, 0.2);
      });
    });
  });

  // ============================================================================
  // TABLE STRUCTURE TESTS
  // ============================================================================

  describe('Table Structure', () => {
    it('should render table with correct headers', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Test Key')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Level')).toBeInTheDocument();
        expect(screen.getByText('Total Runs')).toBeInTheDocument();
        expect(screen.getByText('Pass Rate')).toBeInTheDocument();
        expect(screen.getByText('Fail Rate')).toBeInTheDocument();
        expect(screen.getByText('Last Failed')).toBeInTheDocument();
      });
    });

    it('should render table rows with hover effect', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const rows = document.querySelectorAll('tbody tr');
        expect(rows.length).toBe(3);
        rows.forEach(row => {
          expect(row.className).toMatch(/hover:bg-gray-50|dark:hover:bg-gray-800/);
        });
      });
    });

    it('should render test keys in monospace font', async () => {
      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const testKey = screen.getByText('TC-AUTH-001');
        expect(testKey.className).toMatch(/font-mono/);
      });
    });
  });

  // ============================================================================
  // EDGE CASES TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single flaky test', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([mockFlakyTests[0]]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Flaky Tests (1)')).toBeInTheDocument();
        expect(screen.getByText('TC-AUTH-001')).toBeInTheDocument();
      });
    });

    it('should handle large number of flaky tests', async () => {
      const manyTests = Array.from({ length: 50 }, (_, i) => ({
        ...mockFlakyTests[0],
        testKey: `TC-TEST-${i.toString().padStart(3, '0')}`,
      }));
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue(manyTests);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Flaky Tests (50)')).toBeInTheDocument();
      });
    });

    it('should handle 100% fail rate', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([
        {
          ...mockFlakyTests[0],
          passCount: 0,
          failCount: 100,
          passRate: 0,
          failRate: 1.0,
        },
      ]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });
    });

    it('should handle tests with unknown test level', async () => {
      vi.mocked(testExecutionService.getFlakyTests).mockResolvedValue([
        {
          ...mockFlakyTests[0],
          testLevel: 'custom',
        },
      ]);

      render(<FlakyTestsPanel projectId="project-1" />);

      await waitFor(() => {
        const customBadge = screen.getByText('custom');
        expect(customBadge.className).toMatch(/bg-gray-100|text-gray-800/);
      });
    });
  });
});
