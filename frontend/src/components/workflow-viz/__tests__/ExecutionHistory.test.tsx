/**
 * Unit tests for ExecutionHistory component
 * ST-168: Execution history display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionHistory, ExecutionRun } from '../ExecutionHistory';

describe('ExecutionHistory', () => {
  const mockRuns: ExecutionRun[] = [
    {
      id: 'run_abc123',
      status: 'completed',
      startedAt: '2025-12-03T14:30:01Z',
      completedAt: '2025-12-03T14:38:35Z',
      totalTokens: 45230,
      statesExecuted: [
        { order: 1, name: 'Analysis', status: 'completed', duration: 45 },
        { order: 2, name: 'Architecture', status: 'completed', duration: 132 },
        { order: 3, name: 'Implementation', status: 'completed', duration: 270 },
        { order: 4, name: 'Review', status: 'approved', duration: 67 },
      ],
      artifacts: ['BA_ANALYSIS', 'ARCH_DOC', 'IMPL_CODE', 'TEST_RESULTS'],
    },
    {
      id: 'run_xyz789',
      status: 'failed',
      startedAt: '2025-12-03T10:15:22Z',
      completedAt: '2025-12-03T10:18:34Z',
      totalTokens: 18450,
      statesExecuted: [
        { order: 1, name: 'Analysis', status: 'completed', duration: 48 },
        { order: 2, name: 'Architecture', status: 'failed', duration: 144 },
      ],
      artifacts: [],
      error: 'Agent exceeded max turns without completing task',
    },
    {
      id: 'run_running',
      status: 'running',
      startedAt: '2025-12-03T15:00:00Z',
      completedAt: null,
      totalTokens: 12000,
      statesExecuted: [
        { order: 1, name: 'Analysis', status: 'completed', duration: 50 },
        { order: 2, name: 'Architecture', status: 'running', duration: 30 },
      ],
      artifacts: [],
    },
  ];

  const defaultHandlers = {
    onViewTranscript: vi.fn(),
    onViewLogs: vi.fn(),
    onViewArtifacts: vi.fn(),
    onDownloadTranscript: vi.fn(),
    onViewError: vi.fn(),
    onResume: vi.fn(),
  };

  describe('TC-HISTORY-001: Basic rendering of run list', () => {
    it('should render execution history panel', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('execution-history')).toBeInTheDocument();
      expect(screen.getByText('Execution History')).toBeInTheDocument();
    });

    it('should display all runs', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('run-run_abc123')).toBeInTheDocument();
      expect(screen.getByTestId('run-run_xyz789')).toBeInTheDocument();
      expect(screen.getByTestId('run-run_running')).toBeInTheDocument();
    });

    it('should show run ID (truncated)', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByText(/Run: run_abc1/)).toBeInTheDocument();
    });

    it('should display start timestamp', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('run-start-run_abc123')).toHaveTextContent('Started:');
    });

    it('should display duration', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('run-duration-run_abc123')).toHaveTextContent('Duration:');
    });

    it('should display total tokens with formatting', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('run-tokens-run_abc123')).toHaveTextContent('Tokens: 45,230');
    });
  });

  describe('TC-HISTORY-002: Run status indicators', () => {
    it('should show completed status with green badge', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      const statusBadge = screen.getByTestId('run-status-run_abc123');
      expect(statusBadge).toHaveTextContent('COMPLETED');
      expect(statusBadge).toHaveClass('text-green-400');
    });

    it('should show failed status with red badge', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      const statusBadge = screen.getByTestId('run-status-run_xyz789');
      expect(statusBadge).toHaveTextContent('FAILED');
      expect(statusBadge).toHaveClass('text-red-400');
    });

    it('should show running status with blue animated badge', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      const statusBadge = screen.getByTestId('run-status-run_running');
      expect(statusBadge).toHaveTextContent('RUNNING');
      expect(statusBadge).toHaveClass('text-blue-400', 'animate-pulse');
    });
  });

  describe('TC-HISTORY-003: State execution table display', () => {
    it('should show states table when run is expanded', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByText('States Executed:')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Architecture')).toBeInTheDocument();
      expect(screen.getByText('Implementation')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('should display state order numbers', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      const stateRow = screen.getByTestId('state-row-run_abc123-1');
      expect(stateRow).toHaveTextContent('1');
    });

    it('should show state status with correct color', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      const completedStatus = screen.getByTestId('state-status-run_abc123-1');
      expect(completedStatus).toHaveTextContent('Complete');
      expect(completedStatus).toHaveClass('text-green-400');
    });

    it('should display state duration', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByText('45s')).toBeInTheDocument();
      expect(screen.getByText('2m 12s')).toBeInTheDocument();
    });

    it('should show approved status for review states', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      const reviewStatus = screen.getByTestId('state-status-run_abc123-4');
      expect(reviewStatus).toHaveTextContent('Approved');
    });
  });

  describe('TC-HISTORY-004: Duration and token formatting', () => {
    it('should format duration in seconds for short durations', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('should format duration in minutes and seconds', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByText('2m 12s')).toBeInTheDocument();
    });

    it('should format large token numbers with commas', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.getByTestId('run-tokens-run_abc123')).toHaveTextContent('45,230');
    });

    it('should calculate duration for running tasks', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      const durationElement = screen.getByTestId('run-duration-run_running');
      expect(durationElement).toHaveTextContent('Duration:');
    });
  });

  describe('TC-HISTORY-005: Action button callbacks', () => {
    it('should call onViewTranscript when Transcript button clicked', () => {
      const onViewTranscript = vi.fn();

      render(
        <ExecutionHistory
          runs={mockRuns}
          {...defaultHandlers}
          onViewTranscript={onViewTranscript}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));
      fireEvent.click(screen.getByTestId('transcript-run_abc123-1'));

      expect(onViewTranscript).toHaveBeenCalledWith('run_abc123', 1);
    });

    it('should call onViewLogs when Logs button clicked', () => {
      const onViewLogs = vi.fn();

      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} onViewLogs={onViewLogs} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));
      fireEvent.click(screen.getByTestId('logs-run_abc123-1'));

      expect(onViewLogs).toHaveBeenCalledWith('run_abc123', 1);
    });

    it('should call onViewArtifacts when View All Artifacts clicked', () => {
      const onViewArtifacts = vi.fn();

      render(
        <ExecutionHistory
          runs={mockRuns}
          {...defaultHandlers}
          onViewArtifacts={onViewArtifacts}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));
      fireEvent.click(screen.getByTestId('view-artifacts-run_abc123'));

      expect(onViewArtifacts).toHaveBeenCalledWith('run_abc123');
    });

    it('should call onDownloadTranscript when Download button clicked', () => {
      const onDownloadTranscript = vi.fn();

      render(
        <ExecutionHistory
          runs={mockRuns}
          {...defaultHandlers}
          onDownloadTranscript={onDownloadTranscript}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));
      fireEvent.click(screen.getByTestId('download-transcript-run_abc123'));

      expect(onDownloadTranscript).toHaveBeenCalledWith('run_abc123');
    });

    it('should call onViewError when View Error Details clicked', () => {
      const onViewError = vi.fn();

      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} onViewError={onViewError} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));
      fireEvent.click(screen.getByTestId('view-error-run_xyz789'));

      expect(onViewError).toHaveBeenCalledWith('run_xyz789');
    });

    it('should call onResume when Resume button clicked', () => {
      const onResume = vi.fn();

      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} onResume={onResume} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));
      fireEvent.click(screen.getByTestId('resume-run_xyz789'));

      expect(onResume).toHaveBeenCalledWith('run_xyz789');
    });
  });

  describe('TC-HISTORY-006: Error display for failed runs', () => {
    it('should show error message for failed runs', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));

      expect(screen.getByTestId('error-run_xyz789')).toBeInTheDocument();
      expect(
        screen.getByText('Agent exceeded max turns without completing task')
      ).toBeInTheDocument();
    });

    it('should display View Error Details button for failed runs', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));

      expect(screen.getByTestId('view-error-run_xyz789')).toBeInTheDocument();
      expect(screen.getByText('[View Error Details]')).toBeInTheDocument();
    });

    it('should display Resume from Checkpoint button for failed runs', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));

      expect(screen.getByTestId('resume-run_xyz789')).toBeInTheDocument();
      expect(screen.getByText('[Resume from Checkpoint]')).toBeInTheDocument();
    });

    it('should not show error section for successful runs', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.queryByTestId('error-run_abc123')).not.toBeInTheDocument();
    });
  });

  describe('TC-HISTORY-007: Empty state when no runs', () => {
    it('should show empty message when no runs', () => {
      render(<ExecutionHistory runs={[]} {...defaultHandlers} />);

      expect(screen.getByTestId('execution-history-empty')).toBeInTheDocument();
      expect(screen.getByText('No execution history available')).toBeInTheDocument();
    });

    it('should not render run list when empty', () => {
      render(<ExecutionHistory runs={[]} {...defaultHandlers} />);

      expect(screen.queryByText('Execution History')).not.toBeInTheDocument();
    });
  });

  describe('TC-HISTORY-008: Artifacts list display', () => {
    it('should show artifacts list when run has artifacts', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByTestId('artifacts-run_abc123')).toBeInTheDocument();
      expect(screen.getByText(/BA_ANALYSIS, ARCH_DOC, IMPL_CODE, TEST_RESULTS/)).toBeInTheDocument();
    });

    it('should not show artifacts section when no artifacts', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));

      expect(screen.queryByTestId('artifacts-run_xyz789')).not.toBeInTheDocument();
    });

    it('should show View All Artifacts button when artifacts exist', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByTestId('view-artifacts-run_abc123')).toBeInTheDocument();
    });

    it('should show Download Full Transcript button when artifacts exist', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByTestId('download-transcript-run_abc123')).toBeInTheDocument();
    });
  });

  describe('TC-HISTORY-009: Collapsible run details', () => {
    it('should not show run details initially', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      expect(screen.queryByTestId('run-details-run_abc123')).not.toBeInTheDocument();
    });

    it('should expand run details when toggle clicked', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));

      expect(screen.getByTestId('run-details-run_abc123')).toBeInTheDocument();
    });

    it('should collapse run details when toggle clicked again', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123')); // Expand
      fireEvent.click(screen.getByTestId('toggle-run-run_abc123')); // Collapse

      expect(screen.queryByTestId('run-details-run_abc123')).not.toBeInTheDocument();
    });

    it('should allow multiple runs to be expanded simultaneously', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      fireEvent.click(screen.getByTestId('toggle-run-run_abc123'));
      fireEvent.click(screen.getByTestId('toggle-run-run_xyz789'));

      expect(screen.getByTestId('run-details-run_abc123')).toBeInTheDocument();
      expect(screen.getByTestId('run-details-run_xyz789')).toBeInTheDocument();
    });

    it('should update toggle icon when expanded', () => {
      render(<ExecutionHistory runs={mockRuns} {...defaultHandlers} />);

      const toggle = screen.getByTestId('toggle-run-run_abc123');
      expect(toggle).toHaveTextContent('▶');

      fireEvent.click(toggle);
      expect(toggle).toHaveTextContent('▼');
    });
  });
});
