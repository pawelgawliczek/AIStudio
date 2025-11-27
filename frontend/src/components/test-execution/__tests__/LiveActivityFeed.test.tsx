import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiveActivityFeed } from '../LiveActivityFeed';
import { TestExecutionEvent } from '../../../hooks/useTestExecutionWebSocket';

describe('LiveActivityFeed', () => {
  const mockItems: TestExecutionEvent[] = [
    {
      executionId: 'exec-1',
      projectId: 'project-uuid',
      testCaseKey: 'TC-AUTH-042',
      testCaseTitle: 'Login with valid credentials',
      status: 'pass',
      durationMs: 2400,
      startedAt: '2025-11-27T14:32:15Z',
      completedAt: '2025-11-27T14:32:17Z',
    },
    {
      executionId: 'exec-2',
      projectId: 'project-uuid',
      testCaseKey: 'TC-AUTH-041',
      testCaseTitle: 'Password reset flow',
      status: undefined, // Running
      startedAt: '2025-11-27T14:32:10Z',
    },
    {
      executionId: 'exec-3',
      projectId: 'project-uuid',
      testCaseKey: 'TC-E2E-015',
      testCaseTitle: 'Checkout flow end-to-end',
      status: 'fail',
      durationMs: 12800,
      errorMessage: 'Element not found',
      startedAt: '2025-11-27T14:32:05Z',
      completedAt: '2025-11-27T14:32:18Z',
    },
  ];

  describe('rendering', () => {
    it('should render live activity feed with items', () => {
      render(<LiveActivityFeed items={mockItems} />);

      expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
      expect(screen.getByText('TC-AUTH-042')).toBeInTheDocument();
      expect(screen.getByText('Login with valid credentials')).toBeInTheDocument();
      expect(screen.getByText('TC-E2E-015')).toBeInTheDocument();
    });

    it('should render empty state when no items', () => {
      render(<LiveActivityFeed items={[]} />);

      expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
    });

    it('should render LIVE indicator', () => {
      render(<LiveActivityFeed items={mockItems} />);

      expect(screen.getByText(/LIVE/i)).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('should show passed test with green icon', () => {
      const passedItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'Passed test',
          status: 'pass',
          durationMs: 1000,
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:01Z',
        },
      ];

      render(<LiveActivityFeed items={passedItems} />);

      expect(screen.getByText('✅')).toBeInTheDocument();
      expect(screen.getByText('1.0s')).toBeInTheDocument();
      expect(screen.getByText('Pass')).toBeInTheDocument();
    });

    it('should show failed test with red icon', () => {
      const failedItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-2',
          projectId: 'project-uuid',
          testCaseKey: 'TC-002',
          testCaseTitle: 'Failed test',
          status: 'fail',
          durationMs: 2500,
          errorMessage: 'Assertion failed',
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:02Z',
        },
      ];

      render(<LiveActivityFeed items={failedItems} />);

      expect(screen.getByText('❌')).toBeInTheDocument();
      expect(screen.getByText('2.5s')).toBeInTheDocument();
      expect(screen.getByText('Fail')).toBeInTheDocument();
    });

    it('should show running test with spinning icon', () => {
      const runningItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-3',
          projectId: 'project-uuid',
          testCaseKey: 'TC-003',
          testCaseTitle: 'Running test',
          status: undefined,
          startedAt: '2025-11-27T14:00:00Z',
        },
      ];

      render(<LiveActivityFeed items={runningItems} />);

      expect(screen.getByText('⏳')).toBeInTheDocument();
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });

    it('should show skipped test with skip icon', () => {
      const skippedItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-4',
          projectId: 'project-uuid',
          testCaseKey: 'TC-004',
          testCaseTitle: 'Skipped test',
          status: 'skip',
          durationMs: 0,
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:00Z',
        },
      ];

      render(<LiveActivityFeed items={skippedItems} />);

      expect(screen.getByText('⏭️')).toBeInTheDocument();
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('should show error status with error icon', () => {
      const errorItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-5',
          projectId: 'project-uuid',
          testCaseKey: 'TC-005',
          testCaseTitle: 'Error test',
          status: 'error',
          durationMs: 500,
          errorMessage: 'Timeout',
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:00Z',
        },
      ];

      render(<LiveActivityFeed items={errorItems} />);

      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('auto-scroll functionality', () => {
    it('should render auto-scroll toggle', () => {
      render(<LiveActivityFeed items={mockItems} />);

      const toggleButton = screen.getByRole('button', { name: /Auto-scroll/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle auto-scroll on button click', () => {
      render(<LiveActivityFeed items={mockItems} />);

      const toggleButton = screen.getByRole('button', { name: /Auto-scroll/i });

      // Initially ON
      expect(toggleButton).toHaveTextContent(/ON/i);

      // Click to turn OFF
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveTextContent(/OFF/i);

      // Click to turn ON again
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveTextContent(/ON/i);
    });
  });

  describe('timestamp formatting', () => {
    it('should display relative timestamps', () => {
      const recentItem: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'Recent test',
          status: 'pass',
          durationMs: 1000,
          startedAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
          completedAt: new Date(Date.now() - 4000).toISOString(),
        },
      ];

      render(<LiveActivityFeed items={recentItem} />);

      // Should show relative time like "5s ago" or "just now"
      expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
    });

    it('should format duration in seconds', () => {
      const item: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'Test with duration',
          status: 'pass',
          durationMs: 3456,
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:03Z',
        },
      ];

      render(<LiveActivityFeed items={item} />);

      expect(screen.getByText('3.5s')).toBeInTheDocument(); // Rounded to 1 decimal
    });

    it('should handle zero duration', () => {
      const item: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'Instant test',
          status: 'skip',
          durationMs: 0,
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:00Z',
        },
      ];

      render(<LiveActivityFeed items={item} />);

      expect(screen.getByText('0.0s')).toBeInTheDocument();
    });
  });

  describe('item limit', () => {
    it('should limit display to 10 most recent items', () => {
      const manyItems: TestExecutionEvent[] = Array.from({ length: 15 }, (_, i) => ({
        executionId: `exec-${i}`,
        projectId: 'project-uuid',
        testCaseKey: `TC-${i.toString().padStart(3, '0')}`,
        testCaseTitle: `Test ${i}`,
        status: 'pass' as const,
        durationMs: 1000,
        startedAt: new Date(Date.now() - i * 1000).toISOString(),
        completedAt: new Date(Date.now() - i * 1000 + 1000).toISOString(),
      }));

      render(<LiveActivityFeed items={manyItems} />);

      // Should only show first 10
      expect(screen.getAllByText(/TC-/)).toHaveLength(10);
      expect(screen.getByText('TC-000')).toBeInTheDocument();
      expect(screen.getByText('TC-009')).toBeInTheDocument();
      expect(screen.queryByText('TC-010')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<LiveActivityFeed items={mockItems} />);

      expect(screen.getByLabelText(/Recent test activity/i)).toBeInTheDocument();
    });

    it('should have keyboard accessible toggle', () => {
      render(<LiveActivityFeed items={mockItems} />);

      const toggleButton = screen.getByRole('button', { name: /Auto-scroll/i });
      expect(toggleButton).toHaveAttribute('type', 'button');
    });
  });

  describe('edge cases', () => {
    it('should handle items with missing optional fields', () => {
      const minimalItem: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'Minimal test',
          startedAt: '2025-11-27T14:00:00Z',
        },
      ];

      render(<LiveActivityFeed items={minimalItem} />);

      expect(screen.getByText('TC-001')).toBeInTheDocument();
      expect(screen.getByText('Minimal test')).toBeInTheDocument();
    });

    it('should handle very long test titles gracefully', () => {
      const longTitleItem: TestExecutionEvent[] = [
        {
          executionId: 'exec-1',
          projectId: 'project-uuid',
          testCaseKey: 'TC-001',
          testCaseTitle: 'This is an extremely long test title that should be truncated or wrapped properly to avoid breaking the layout',
          status: 'pass',
          durationMs: 1000,
          startedAt: '2025-11-27T14:00:00Z',
          completedAt: '2025-11-27T14:00:01Z',
        },
      ];

      render(<LiveActivityFeed items={longTitleItem} />);

      expect(screen.getByText(/This is an extremely long/)).toBeInTheDocument();
    });

    it('should update when items prop changes', () => {
      const { rerender } = render(<LiveActivityFeed items={mockItems} />);

      expect(screen.getByText('TC-AUTH-042')).toBeInTheDocument();

      const newItems: TestExecutionEvent[] = [
        {
          executionId: 'exec-new',
          projectId: 'project-uuid',
          testCaseKey: 'TC-NEW-001',
          testCaseTitle: 'New test',
          status: 'pass',
          durationMs: 500,
          startedAt: '2025-11-27T14:35:00Z',
          completedAt: '2025-11-27T14:35:00Z',
        },
      ];

      rerender(<LiveActivityFeed items={newItems} />);

      expect(screen.queryByText('TC-AUTH-042')).not.toBeInTheDocument();
      expect(screen.getByText('TC-NEW-001')).toBeInTheDocument();
    });
  });
});
